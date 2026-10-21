# Asylkech Girls' School — web sitesi

Indigo Academy'ye bağlı Asylkech Girls' School için 3 dilli (Kırgızca, Rusça, İngilizce) statik site.

## Yapı
```
src/build.mjs          Sayfa şablonları + okul bilgileri (telefon, sosyal medya, kadro listesi)
src/content/ky|ru|en   Her dilin tüm metinleri
assets/css, js, img    Tasarım, betikler, logolar
dist/                  Derlenmiş site (sunucuya yüklenecek klasör)
```

Derleme: `node src/build.mjs` (Node 18+, bağımlılık yok).

Sayfalar (her dilde ayrı): `index` (Ana sayfa), `about`, `academics`, `admissions`, `school-life`,
`staff` (Kadro), `news`, `contact`. Adresleri: `/ky/…`, `/ru/…`, `/en/…`. Kök `index.html` dil seçim sayfasıdır.

## Gerçek fotoğrafları eklemek
Dosyayı aşağıdaki adla koyup tekrar derleyin; tasarımdaki yer tutucu otomatik olarak fotoğrafla değişir.

| Dosya | Nerede |
|---|---|
| `assets/img/photos/home-welcome.jpg` | Ana sayfa karşılama |
| `assets/img/photos/stage-1.jpg`, `stage-2.jpg`, `stage-3.jpg` | Kademeler (Ana sayfa + Eğitim) |
| `assets/img/photos/life-1.jpg`, `life-2.jpg`, `life-3.jpg` | Okul hayatı kolajı |
| `assets/img/photos/about-story.jpg`, `director.jpg`, `languages.jpg` | Hakkımızda / Eğitim |
| `assets/img/photos/news-instagram.jpg`, `news-threads.jpg` | Haberler |
| `assets/img/staff/<id>.jpg` | Kadro portreleri (ör. `director.jpg`, `math.jpg`) |

## Kadro
`src/build.mjs` içindeki `STAFF` listesinde her kişinin `name` alanını doldurun:
`name: 'Айгүл Асанова'` veya dile göre `name: { ky: '…', ru: '…', en: '…' }`.
Görev adları `src/content/*.mjs` içinde `staff.roles` altındadır.

## Yayından önce doğrulanacaklar
- Çalışma saatleri, günlük program saatleri, kabul belgeleri ve SSS cevapları taslaktır.
- WhatsApp numarası olarak +996 702 22 99 99 varsayıldı.
- `SITE.url` alanına gerçek alan adını yazın (hreflang ve sitemap için).

## Yapay zeka asistanı (sağ alt köşe)
`assets/js/assistant.js`, her sayfanın sağ alt köşesinde açılan sohbet penceresidir. Sadece okulla ilgili soruları,
sitenin kendi içeriğinden üretilen bilgi tabanıyla (`dist/assets/data/kb-*.json`) cevaplar. Konu dışı sorularda
yalnızca okulla ilgili yardım edebileceğini söyler. Bilgi tabanı her `node src/build.mjs` çalıştırmasında metinlerden
yeniden oluşturulur, yani siteyi güncelleyince asistan da güncellenir.

Cevap kaynakları:
1. **Gerçek yapay zeka (önerilen):** `server/` klasöründeki Cloudflare Worker, Claude API'ye bağlanır.
   ```
   cd server && npm install
   npx wrangler secret put ANTHROPIC_API_KEY      # API anahtarı sadece sunucuda durur
   npx wrangler deploy
   ```
   Ardından `src/build.mjs` içinde `SITE.aiEndpoint` alanına Worker adresini (ör. `/api/chat` ya da
   `https://asylkech-assistant.<hesap>.workers.dev`) yazın, `wrangler.toml` içindeki `ALLOWED_ORIGINS`'e
   site adresini ekleyin ve siteyi tekrar derleyin.
2. **Sunucu yoksa:** Asistan sitedeki metinlerde anahtar kelime araması yapar ve ilgili bölümü sayfa bağlantısıyla gösterir.

## Yayın: GitHub Pages + asylkechgirls.edu.kg
`main` dalına her gönderimde `.github/workflows/pages.yml` siteyi derler ve `dist/` klasörünü GitHub Pages'te yayınlar.
`dist/CNAME` dosyası alan adını (`asylkechgirls.edu.kg`) GitHub'a bildirir.

1. GitHub → depo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Alan adının DNS kayıtları (cctld.kg panelinde ya da alan adını yönettiğiniz DNS servisinde):

   | Tür | Ad | Değer |
   |---|---|---|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | CNAME | www | ademtkn.github.io |

3. DNS yayıldıktan sonra **Settings → Pages → Custom domain** alanında `asylkechgirls.edu.kg` görünür; **Enforce HTTPS** kutusunu işaretleyin.
