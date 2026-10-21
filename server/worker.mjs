// Asylkech school assistant backend (Cloudflare Worker).
// Receives {lang, messages} from assets/js/assistant.js and answers with Claude,
// using only the knowledge base generated from the site content (knowledge.json).
import Anthropic from '@anthropic-ai/sdk';
import knowledge from './knowledge.json';

const MAX_TURNS = 20;
const MAX_CHARS = 600;

function cors(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

// Keep only well-formed user/assistant turns that start and end with the visitor.
function cleanTurns(raw) {
  if (!Array.isArray(raw)) return [];
  let turns = raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, m.role === 'user' ? MAX_CHARS : 2000) }))
    .slice(-MAX_TURNS);
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== 'user') return [];
  return turns;
}

export default {
  async fetch(request, env) {
    const headers = cors(request.headers.get('Origin'), env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400, headers); }
    const lang = ['ky', 'ru', 'en'].includes(body.lang) ? body.lang : 'ky';
    const messages = cleanTurns(body.messages);
    if (!messages.length) return json({ error: 'no_question' }, 400, headers);

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    try {
      const response = await client.beta.messages.create({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        // The knowledge base is identical on every request, so it is cached.
        system: [{ type: 'text', text: knowledge[lang], cache_control: { type: 'ephemeral' } }],
        messages,
      });
      if (response.stop_reason === 'refusal') return json({ text: '' }, 502, headers);
      const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      return json({ text }, 200, headers);
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 429, headers);
      if (err instanceof Anthropic.APIError) return json({ error: 'upstream' }, 502, headers);
      throw err;
    }
  },
};
