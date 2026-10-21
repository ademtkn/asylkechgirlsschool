// Asylkech school assistant: a chat panel in the bottom-right corner that answers
// questions about the school only, from the knowledge base built out of the site content.
// Answer sources, in order:
//   1. the school's own backend (config.endpoint, see server/worker.mjs) → Claude
//   2. inside a Claude artifact viewer: the viewer's Claude (window.claude "sample")
//   3. offline: keyword search over the knowledge base
(function () {
  var cfgEl = document.getElementById('ai-config');
  if (!cfgEl) return;
  var cfg = JSON.parse(cfgEl.textContent);
  var ui = cfg.ui;
  var STORE = 'asylkech-ai-' + cfg.lang;
  var MAX_TURNS = 10;

  var kbPromise = fetch(cfg.kb).then(function (r) { return r.json(); }).catch(function () { return null; });
  var samplePromise = !cfg.endpoint && window.claude && window.claude.use
    ? window.claude.use('sample').catch(function () { return null; })
    : Promise.resolve(null);
  var sampleOff = false;

  var history = [];
  try { history = JSON.parse(sessionStorage.getItem(STORE) || '[]'); } catch (e) {}
  var save = function () { try { sessionStorage.setItem(STORE, JSON.stringify(history.slice(-MAX_TURNS * 2))); } catch (e) {} };

  // ---------- markup ----------
  var ico = function (d) { return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'ai-fab';
  fab.setAttribute('aria-expanded', 'false'); fab.setAttribute('aria-controls', 'ai-panel');
  fab.innerHTML = '<span class="ai-fab-icon" aria-hidden="true"></span><span class="ai-fab-label"></span>';
  fab.querySelector('.ai-fab-label').textContent = ui.open;
  fab.setAttribute('aria-label', ui.open);

  var panel = document.createElement('section');
  panel.id = 'ai-panel'; panel.className = 'ai-panel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', ui.title);
  panel.innerHTML =
    '<header class="ai-head"><span class="ai-avatar" aria-hidden="true"></span>' +
    '<span class="ai-head-text"><strong></strong><span></span></span>' +
    '<button type="button" class="ai-close">' + ico('<path d="M6 6l12 12M18 6L6 18"/>') + '</button></header>' +
    '<div class="ai-log" aria-live="polite"></div>' +
    '<div class="ai-sugs"></div>' +
    '<div><form class="ai-form"><textarea class="ai-input" id="ai-input" rows="1" maxlength="600"></textarea>' +
    '<button type="submit" class="ai-send">' + ico('<path d="M4 12h15M13 6l6 6-6 6"/>') + '</button></form>' +
    '<p class="ai-note"></p></div>';
  panel.querySelector('.ai-head-text strong').textContent = ui.title;
  panel.querySelector('.ai-head-text span').textContent = ui.status;
  panel.querySelector('.ai-close').setAttribute('aria-label', ui.close);
  panel.querySelector('.ai-send').setAttribute('aria-label', ui.send);
  panel.querySelector('.ai-note').textContent = ui.disclaimer;
  var input = panel.querySelector('.ai-input');
  input.placeholder = ui.placeholder; input.setAttribute('aria-label', ui.placeholder);
  var log = panel.querySelector('.ai-log');
  var sugs = panel.querySelector('.ai-sugs');
  var form = panel.querySelector('.ai-form');
  var sendBtn = panel.querySelector('.ai-send');

  ui.suggestions.forEach(function (q) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'ai-sug'; b.textContent = q;
    b.addEventListener('click', function () { ask(q); });
    sugs.appendChild(b);
  });

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  // ---------- rendering ----------
  var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var safeUrl = function (u) { return /^(https:\/\/|[a-z0-9-]+\.html(#[\w-]+)?$)/i.test(u) ? u : null; };
  function inline(s) {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, u) {
        var href = safeUrl(u);
        if (!href) return t;
        return '<a href="' + href + '"' + (/^https/.test(href) ? ' target="_blank" rel="noopener"' : '') + '>' + t + '</a>';
      });
  }
  function md(text) {
    var out = [], list = null;
    text.split(/\n/).forEach(function (line) {
      var l = line.trim();
      var li = l.match(/^[-*•]\s+(.*)/);
      if (li) { if (!list) { list = []; out.push(list); } list.push(inline(li[1])); return; }
      list = null;
      if (l) out.push('<p>' + inline(l) + '</p>');
    });
    return out.map(function (x) { return Array.isArray(x) ? '<ul>' + x.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>' : x; }).join('');
  }
  function bubble(role, text) {
    var el = document.createElement('div');
    el.className = 'ai-msg ai-msg--' + (role === 'user' ? 'me' : 'bot');
    if (role === 'user') el.textContent = text; else el.innerHTML = md(text);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  function renderAll() {
    log.innerHTML = '';
    bubble('assistant', ui.hello);
    history.forEach(function (m) { bubble(m.role, m.content); });
  }

  // ---------- answering ----------
  // Words that say nothing about the topic (question words, particles) in the three languages.
  var STOP = ('как какой какие какая каком кто что когда сколько есть ли или для это ваш ваша ваши вас вам мне можно нужно нужны будет '
    + 'кантип кандай кайсы ким эмне качан канча барбы бар деген үчүн менен сиздин биздин жана керек болобу '
    + 'how what which when who does do offer tell about are the you your can for and with there have need school мектеп школа школе школы').split(' ');
  function stems(s) {
    return (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
      .filter(function (w) { return w.length > 2 && STOP.indexOf(w) === -1; })
      .map(function (w) { return w.length > 5 ? w.slice(0, 5) : w.slice(0, 4); });
  }
  var index = null;
  function buildIndex(kb) {
    var docs = kb.chunks.map(function (c) {
      var s = stems(c.title + ' ' + c.text + ' ' + (c.keys || ''));
      return { c: c, s: s, t: stems(c.title) };
    });
    var df = {};
    docs.forEach(function (d) {
      d.s.filter(function (w, i, a) { return a.indexOf(w) === i; }).forEach(function (w) { df[w] = (df[w] || 0) + 1; });
    });
    return { docs: docs, df: df };
  }
  // Prefix match both ways, so "стоит" finds "стоимость" (both stem to "стои"/"стоим").
  var has = function (list, w) { for (var i = 0; i < list.length; i++) { if (list[i].indexOf(w.slice(0, 4)) === 0) return true; } return false; };
  function localAnswer(q, kb) {
    if (!kb) return ui.error;
    index = index || buildIndex(kb);
    var qs = stems(q).filter(function (w, i, a) { return a.indexOf(w) === i; });
    if (!qs.length) return ui.offTopic + '\n' + ui.noAnswer;
    var N = index.docs.length, best = null, bestScore = 0, bestCover = 0;
    var weight = function (w) {
      var n = 0; for (var k in index.df) { if (k.indexOf(w.slice(0, 4)) === 0) n = Math.max(n, index.df[k]); }
      return n ? Math.log(1 + N / n) : 0.3; // unknown words barely count
    };
    var ws = qs.map(weight), total = ws.reduce(function (a, b) { return a + b; }, 0);
    index.docs.forEach(function (d) {
      var score = 0, cover = 0;
      qs.forEach(function (w, i) {
        if (has(d.s, w)) { score += ws[i]; cover += ws[i]; }
        if (has(d.t, w)) score += ws[i] * 1.5;
      });
      score = score / Math.pow(1 + d.s.length / 60, 0.3);
      cover = total ? cover / total : 0;
      if (cover >= 0.5 && (cover > bestCover + 0.15 || (cover >= bestCover - 0.15 && score > bestScore))) { bestScore = score; best = d.c; bestCover = Math.max(cover, bestCover); }
    });
    if (!best) return ui.noAnswer;
    var lines = best.text.split('\n').filter(Boolean).slice(0, 7);
    var body = lines.length > 2 ? lines.map(function (l) { return '- ' + l; }).join('\n') : lines.join('\n');
    return '**' + best.title + '**\n' + body + '\n[' + ui.source + ': ' + best.page + '](' + best.url + ')';
  }

  function remoteAnswer(turns) {
    return fetch(cfg.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: cfg.lang, messages: turns }),
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) { if (!d || typeof d.text !== 'string') throw new Error('bad reply'); return d.text; });
  }

  function sampleAnswer(sample, kb, turns, onText) {
    var convo = turns.map(function (m) { return (m.role === 'user' ? 'Visitor: ' : 'Assistant: ') + m.content; }).join('\n\n');
    var prompt = kb.prompt + '\n\nCONVERSATION SO FAR\n\n' + convo +
      '\n\nWrite only the assistant\'s next reply to the visitor\'s last message, following the rules above.';
    return sample(prompt, { cache: false, modelTier: 'quick', onText: function (e) { onText(e.text); } })
      .then(function (r) { return r.text; });
  }

  var busy = false;
  function ask(q) {
    q = (q || '').trim();
    if (!q || busy) return;
    busy = true; sendBtn.disabled = true;
    history.push({ role: 'user', content: q });
    bubble('user', q);
    input.value = ''; input.style.height = '';
    var wait = bubble('assistant', ui.thinking);
    wait.classList.add('ai-msg--wait');
    var turns = history.slice(-MAX_TURNS * 2);

    var finish = function (text) {
      wait.classList.remove('ai-msg--wait');
      wait.innerHTML = md(text);
      history.push({ role: 'assistant', content: text });
      save();
      log.scrollTop = log.scrollHeight;
      busy = false; sendBtn.disabled = false;
    };

    kbPromise.then(function (kb) {
      if (cfg.endpoint) {
        return remoteAnswer(turns).catch(function () { return localAnswer(q, kb); });
      }
      return samplePromise.then(function (sample) {
        if (!sample || sampleOff || !kb) return localAnswer(q, kb);
        return sampleAnswer(sample, kb, turns, function (t) {
          wait.classList.remove('ai-msg--wait'); wait.innerHTML = md(t); log.scrollTop = log.scrollHeight;
        }).catch(function (e) {
          if (e && (e.code === 'not_granted' || e.code === 'unavailable')) sampleOff = true;
          return localAnswer(q, kb);
        });
      });
    }).then(finish, function () { finish(ui.error); });
  }

  // ---------- open / close ----------
  function setOpen(open) {
    panel.hidden = !open;
    fab.setAttribute('aria-expanded', String(open));
    if (open) { if (!log.children.length) renderAll(); setTimeout(function () { input.focus(); }, 50); }
    else fab.focus();
  }
  fab.addEventListener('click', function () { setOpen(true); });
  panel.querySelector('.ai-close').addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });
  form.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input.value); }
  });
  input.addEventListener('input', function () { input.style.height = ''; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
})();
