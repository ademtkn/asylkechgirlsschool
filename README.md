# Asylkech Girls' School — web sitesi

Indigo Academy'ye bağlı Asylkech Girls' School için 3 dilli (Kırgızca, Rusça, İngilizce) statik site.

## Yönetim paneli (admin)
Adres: **https://ademtkn.github.io/asylkechgirlsschool/admin/**

Panelin kendi dili İngilizce, Kırgızca veya Rusça seçilebilir (giriş ekranında ve sol menünün altında EN / KG / RU;
arayüz metinleri `admin/i18n.js` dosyasında).

Panelden kod bilmeden şunlar değiştirilebilir, her metin üç dilde (EN / KG / RU) yan yana:
- **Sayfa metinleri:** tüm sayfalardaki başlıklar, yazılar, SSS, kulüpler, takvim… Listelere öğe eklenip silinebilir, sırası değiştirilebilir.
- **Menü:** sayfaların sırası, menüdeki adı, menüde gösterilip gizlenmesi.
- **Öğretmenler:** ad, görev, bölüm, fotoğraf; yeni öğretmen ekleme ve silme.
- **Haberler:** fotoğraflı haber; son üç haber ana sayfada da görünür, her haberin kendi sayfası olur.
- **Ek sayfalar:** menüye yeni sayfa (ör. Burslar).
- **Resimler:** sayfalardaki fotoğraf alanları (yüklenen resim tarayıcıda otomatik küçültülür).
- **İletişim ve ayarlar:** telefon, WhatsApp, adres, saatler, Instagram, Threads, 2GIS bağlantısı, alan adı.

**Giriş:** Panel bir GitHub erişim anahtarıyla açılır (giriş ekranında adım adım anlatılıyor):
GitHub → Settings → Developer settings → Fine-grained tokens → yalnızca `asylkechgirlsschool` deposu,
izinler **Contents: Read and write** ve **Actions: Read-only**. Her editöre ayrı anahtar verin; ayrılan kişinin anahtarını silin.

**Nasıl çalışır:** “Kaydet ve yayınla”ya basınca panel siteyi tarayıcıda yeniden üretir (`src/site.mjs`, Node'daki
derlemeyle aynı kod) ve içerik dosyalarını, resimleri ve değişen `docs/` sayfalarını depoya tek bir commit olarak yazar.
GitHub Pages `main` dalının `/docs` klasörünü yayınladığı için site 1–2 dakika içinde güncellenir. GitHub Actions gerekmez.

## Yapı
```
content/site.json      İletişim bilgileri, menü sırası/görünürlüğü, alan adı
content/en|ky|ru.json  Her dilin tüm metinleri
content/staff.json     Öğretmenler (ad ve görev 3 dilde, bölüm)
content/news.json      Haberler        content/pages.json   Ek sayfalar
content/images.json    Resimler bölümündeki fotoğraf alanlarının listesi
admin/                 Yönetim paneli
src/site.mjs           Sayfa şablonları (content/ dosyalarından siteyi üretir; panel de bunu kullanır)
src/build.mjs          Node ile derleme: node src/build.mjs → docs/
assets/css, js, img    Tasarım, betikler, logo, yüklenen fotoğraflar
server/                Yapay zeka asistanı için Cloudflare Worker (isteğe bağlı)
docs/                  Derlenmiş site (GitHub Pages bu klasörü yayınlar)
```
Kodda (`src/`, `assets/`, `admin/`) değişiklik yaptıktan sonra `node src/build.mjs` çalıştırıp `docs/` dahil commit edin (Node 18+, bağımlılık yok).

Sayfalar (her dilde ayrı): `index`, `about`, `academics`, `admissions`, `school-life`, `staff`, `news`, `contact`,
ayrıca her haber için `news-<id>.html` ve her ek sayfa için `page-<ad>.html`. Kök `index.html` dil seçim sayfasıdır.

## Fotoğraf dosyaları
Panel fotoğrafları şu adlarla kaydeder: `assets/img/photos/*.jpg` (sayfa fotoğrafları), `assets/img/staff/<id>.jpg`,
`assets/img/news/<id>.jpg`, `assets/img/pages/<ad>.jpg`. Fotoğrafı olmayan alanlarda tasarımdaki renkli desen görünür.

## Yayından önce doğrulanacaklar
- Çalışma saatleri, günlük program saatleri, kabul belgeleri ve SSS cevapları taslaktır.
- WhatsApp numarası olarak +996 702 22 99 99 varsayıldı.
- Hepsi panelden düzeltilebilir.

## Yapay zeka asistanı (sağ alt köşe)
`assets/js/assistant.js`, her sayfanın sağ alt köşesinde açılan sohbet penceresidir. Sadece okulla ilgili soruları,
sitenin kendi içeriğinden üretilen bilgi tabanıyla (`docs/assets/data/kb-*.json`) cevaplar. Konu dışı sorularda
yalnızca okulla ilgili yardım edebileceğini söyler. Bilgi tabanı her `node src/build.mjs` çalıştırmasında metinlerden
yeniden oluşturulur, yani siteyi güncelleyince asistan da güncellenir.

Cevap kaynakları:
1. **Gerçek yapay zeka (önerilen):** `server/` klasöründeki Cloudflare Worker, Claude API'ye bağlanır.
   ```
   cd server && npm install
   npx wrangler secret put ANTHROPIC_API_KEY      # API anahtarı sadece sunucuda durur
   npx wrangler deploy
   ```
   Ardından Worker adresini panelde **İletişim ve ayarlar → Gelişmiş → Asistan sunucusu** alanına yazın
   ve `wrangler.toml` içindeki `ALLOWED_ORIGINS`'e site adresini ekleyin.
2. **Sunucu yoksa:** Asistan sitedeki metinlerde anahtar kelime araması yapar ve ilgili bölümü sayfa bağlantısıyla gösterir.

## Yayın: GitHub Pages + asylkechgirls.edu.kg
Site `docs/` klasöründen yayınlanır. Metinler ve resimler panelden değiştirilir; panel yayını kendisi yapar.

Şu anki adres: **https://ademtkn.github.io/asylkechgirlsschool/**

1. GitHub → depo → **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   **Branch: `main`**, klasör **`/docs`** → **Save**.

Alan adına geçerken: panelde **İletişim ve ayarlar → Gelişmiş** bölümünde sitenin adresini `https://asylkechgirls.edu.kg`,
özel alan adını `asylkechgirls.edu.kg` yapıp yayınlayın (derleme `docs/CNAME` dosyasını yazar), sonra aşağıdakileri yapın.

2. Alan adının DNS kayıtları (cctld.kg panelinde ya da alan adını yönettiğiniz DNS servisinde):

   | Tür | Ad | Değer |
   |---|---|---|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | CNAME | www | ademtkn.github.io |

3. DNS yayıldıktan sonra **Settings → Pages → Custom domain** alanına `asylkechgirls.edu.kg` yazıp kaydedin; **Enforce HTTPS** kutusunu işaretleyin.
