# Nez Scent Agen Dashboard — Versi Standalone (Netlify + Apps Script API)

Arsitektur baru: **Spreadsheet tetap jadi database**, **Google Apps
Script cuma jadi API JSON** (bukan lagi server tampilan), dan
**tampilan (HTML/CSS/JS) berdiri sendiri**, di-hosting di Netlify.
Tema: elegant, kombinasi warna **orange terracotta & peach**.

```
nez-scent-standalone/
├── apps-script-backend/    <- upload ke Apps Script (backend/API)
│   ├── Code.gs               (doPost dispatcher - PENGGANTI Code.gs lama)
│   ├── Config.gs, Utils.gs, Auth.gs, Installer.gs
│   └── ...Service.gs (semua sama seperti versi sebelumnya)
└── netlify-frontend/       <- drag & drop ke Netlify (tampilan)
    ├── index.html
    ├── styles.css             (tema orange & peach)
    ├── app.js                 (SAMA logic-nya, cuma cara manggil server beda)
    └── netlify.toml
```

Kalau kamu sudah punya project Apps Script dari sebelumnya (yang lama,
model HtmlService), **timpa semua file `.gs`-nya** dengan isi folder
`apps-script-backend/` di atas — terutama `Code.gs` yang paling
berbeda. File `Index.html`, `Stylesheet.html`, `JavaScript.html` yang
lama **boleh dihapus** dari project Apps Script, sudah tidak dipakai lagi.

---

## 1. Deploy Backend (Apps Script)

1. Buka spreadsheet Nez Scent → **Extensions → Apps Script**.
2. Kalau masih ada file `Index.html`, `Stylesheet.html`,
   `JavaScript.html` dari versi lama, **hapus ketiganya** (klik titik
   tiga di sebelah nama file → Delete). Backend baru ini API-only,
   tidak butuh file HTML sama sekali.
3. Timpa semua file `.gs` dengan isi folder `apps-script-backend/`
   (kalau ada file yang namanya sama, replace isinya; kalau belum ada,
   buat file baru dengan nama yang sama).
4. **Deploy → New deployment** (atau kalau sudah pernah deploy sebelumnya:
   **Manage deployments → pensil → New version**):
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Klik **Deploy**, copy URL-nya (harus diakhiri `/exec`). Contoh:
   `https://script.google.com/macros/s/AKfycb.../exec`
6. Test dulu: buka URL itu langsung di browser. Harus muncul JSON:
   `{"ok":true,"message":"Nez Scent API aktif. ..."}` — kalau muncul,
   backend sudah siap.

> Kalau sebelumnya belum pernah jalankan `runInitialSetup` (bikin Sheet
> Users + akun awal), jalankan dulu: pilih fungsi `runInitialSetup` di
> toolbar editor Apps Script → **Run**.

---

## 2. Sambungkan Frontend ke Backend

1. Buka file `netlify-frontend/app.js`.
2. Cari baris paling atas:
   ```js
   var API_URL = 'PASTE_URL_WEB_APP_APPS_SCRIPT_KAMU_DI_SINI';
   ```
3. Ganti dengan URL `/exec` dari Langkah 1 tadi, contoh:
   ```js
   var API_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```
4. Simpan file.

---

## 3. Deploy Frontend ke Netlify

**Cara paling gampang (drag & drop, tanpa akun Git):**
1. Buka [app.netlify.com](https://app.netlify.com) → daftar/login (bisa pakai akun Google).
2. Di dashboard, cari area **"Deploy manually"** / **"Drag and drop your site output folder here"**.
3. Drag folder **`netlify-frontend`** (isinya: `index.html`, `styles.css`, `app.js`, `netlify.toml`) ke area itu.
4. Tunggu beberapa detik — Netlify langsung kasih URL publik, contoh:
   `https://random-name-12345.netlify.app`
5. Buka URL itu → coba login (`manager`/`manager123` atau `zahra`/`zahra123`).

**Kalau mau ganti nama domain jadi lebih rapi:**
- Di dashboard situs itu → **Site settings → Change site name** → ganti
  jadi misalnya `nezscent-dashboard` → URL jadi
  `https://nezscent-dashboard.netlify.app`.
- Kalau punya domain sendiri (misal `dashboard.nezscent.com`), bisa
  disambungkan juga lewat **Domain settings → Add custom domain**.

**Update di kemudian hari:** kalau ubah `app.js`/`styles.css` lagi,
tinggal drag & drop ulang folder `netlify-frontend` yang sudah
diperbarui ke situs Netlify yang sama (di halaman **Deploys** situsnya,
ada area drag-drop yang sama).

---

## 4. Kenapa Ini Lebih Ringan & Bisa Lebih "Eye-Catchy"

- **Tidak ada wrapper Google** lagi (sebelumnya tampilan dijalankan di
  dalam iframe `script.google.com`, sekarang murni situs sendiri).
- **Loading lebih cepat** — tidak lewat `google.script.run` (bridge
  Apps Script yang agak lambat), sekarang pakai `fetch()` biasa.
- **Desain 100% bebas** — sudah dipasangkan font **Fraunces** (untuk
  judul/brand, kesan elegan) + **Plus Jakarta Sans** (untuk isi,
  mudah dibaca) dari Google Fonts, plus tema warna orange & peach.
- Bisa pasang **custom domain**, PWA, dsb — semua kemungkinan situs
  web modern kebuka, karena ini situs statis biasa.

---

## 5. Soal Keamanan (CORS & Endpoint)

- Frontend memanggil backend dengan header `Content-Type:
  text/plain;charset=utf-8` (bukan `application/json`). Ini **standar
  workaround** untuk Apps Script Web App: browser tidak melakukan CORS
  preflight (OPTIONS) untuk request "sederhana" seperti ini, sementara
  Apps Script sendiri tidak mendukung preflight. Isi body tetap JSON
  string biasa, cuma header-nya yang disamarkan — Apps Script tetap
  mem-parsing isinya sebagai JSON normal (lihat `doPost` di `Code.gs`).
- Endpoint di-backend dibatasi lewat **whitelist** (`API_FUNCTIONS` di
  `Code.gs`) — cuma fungsi yang memang didaftarkan yang bisa dipanggil
  dari luar, fungsi internal (nama yang diawali garis bawah `_`) tidak
  bisa dipanggil langsung dari frontend.
- Validasi role (Manager vs Staff) & token sesi tetap jalan persis
  seperti sebelumnya di sisi server (`requireSession_` /
  `requireManager_`) — jadi keamanan datanya sama, cuma cara
  frontend "ngobrol" ke backend yang berubah.

---

## 6. Troubleshooting

| Masalah | Solusi |
|---|---|
| Halaman putih / stuck loading | Buka Console browser (F12) → biasanya kelihatan error `Failed to fetch` → cek lagi `API_URL` di `app.js` sudah benar & diakhiri `/exec` |
| Error CORS di Console | Pastikan Web App di-deploy dengan **Who has access: Anyone** (bukan "Only myself") |
| "Endpoint tidak dikenal" | Pastikan `Code.gs` yang dipakai adalah versi baru (ada `API_FUNCTIONS` & `doPost`), bukan versi lama |
| Login gagal terus padahal username/password benar | Jalankan ulang `runInitialSetup` dari editor Apps Script, atau cek Sheet `Users` datanya masih ada |
| Mau tes dari komputer sendiri dulu sebelum upload ke Netlify | Buka `index.html` langsung dari folder (double click / drag ke browser) — tetap jalan karena semua request ke server pakai `fetch()` ke URL Apps Script, bukan file lokal |

---

## 7. Fitur

Semua modul & fitur **identik** dengan versi sebelumnya (tidak ada yang
dikurangi/ditambah): Dashboard, Agen, Tasks (dengan Recreate & Actual
Date otomatis dari Activity), Activity Log, Proforma Invoice (status
otomatis Belum SO/Sudah SO), Sales Order (search Contact Agen & Linked
PI, auto status Paid/Overdue, dsb), Gifts, Agen Lookup, Setup, dan
Users. Lihat riwayat perubahan lengkap di `CHANGELOG.md`.
