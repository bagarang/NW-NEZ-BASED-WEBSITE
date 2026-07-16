## 9. Changelog — Update Permintaan Boss

Update berikut sudah diterapkan ke semua modul terkait (Task, PI, SO):

1. **Task → Actual Date** sekarang otomatis diambil dari tanggal Activity
   terakhir untuk agen yang sama (bukan input manual lagi). Tampil sebagai
   kolom read-only di list Task.
2. **Status PI** tidak lagi dropdown manual — otomatis **"Belum SO"** /
   **"Sudah SO"**, dihitung dari ada-tidaknya SO yang link ke nomor PI itu.
3. **Sales Order → Linked Nomor PI**: setelah pilih Contact Agen, pilihan
   PI otomatis hanya menampilkan PI milik agen itu. Pilih PI-nya, **Amount
   otomatis terisi** dari nominal PI tersebut (masih bisa diedit manual
   untuk kasus split payment).
4. **Terms** otomatis terisi default **"30 Hari"** saat menambah SO baru
   (tetap bisa diubah).
5. Dropdown Linked Nomor PI di form SO **hanya menampilkan PI yang belum
   dipakai SO lain** ("Belum SO"); PI yang sudah "Sudah SO" tidak muncul
   lagi sebagai pilihan (kecuali PI yang sedang dipakai SO yang sedang
   diedit).
6. **Status Klien** di form/list SO dihapus, diganti kolom **"Sisa Hari"**
   (Days Until Due). Kalau Due Date sudah lewat, Status otomatis tampil
   **"Overdue"** berwarna merah.
7. Kolom **"Tanggal"** di list & Dashboard Sales Order sekarang menampilkan
   **Due Date** (bukan SO Date lagi), sekaligus jadi patokan urutan list
   (paling mendesak di atas).
8. List SO menampilkan kolom **Sisa Hari (Days Until Due)**; SO yang lewat
   due date langsung tampil badge **Overdue** merah supaya gampang
   di-follow-up.
9. Saat **Payment Date** diisi di form SO, **Status otomatis jadi "Paid"**.
10. Kolom **Notes** ditambahkan sebagai header baru di list Sales Order,
    jadi kalau Status = **Split Payment**, detail informasinya kelihatan
    langsung dari list tanpa buka form.
11. Form Proforma Invoice disederhanakan:
    - Field **Deal Name** dan **Payment Date** dihapus dari form.
    - Field **Sales Rep** di-relabel jadi **Admin**.
    - Field **Status Klien** dihapus.
    - Kolom **Notes** sekarang ditampilkan di list Proforma Invoice.

> Kolom lama (`Deal Name`, `Payment Date` di PI; `Status Klien`/`CLIENT
> STATUS` di PI & SO) tetap ada di Sheet untuk kompatibilitas data lama,
> hanya saja tidak lagi diisi/ditampilkan lewat web app.

**Cara update:** copy ulang isi `PIService.gs`, `SOService.gs`,
`TaskService.gs`, `DashboardService.gs`, `SetupService.gs`, `Utils.gs`,
dan `JavaScript.html` ke project Apps Script kamu (timpa file lama yang
namanya sama), lalu **Deploy → Manage deployments → edit → Version: New
→ Deploy** supaya perubahan tayang di URL yang sama.

---

## 10. Changelog v3 — Update Lanjutan

1. Header list Task **"Actual Date (dari Activity)"** disederhanakan jadi
   **"Actual Date"** saja.
2. Task dengan status **Done*** kini **disembunyikan dari list Task**
   (biar list tetap bersih/fokus ke yang aktif), tapi tetap tersimpan di
   Sheet dan tetap terhitung di chart **Task Status** Dashboard.
3. Task yang **overdue** (Sisa Hari negatif) sekarang punya tombol
   **"Recreate"**: task lama otomatis ditandai **Failed** (tetap
   terhitung sebagai task gagal di Dashboard) dan task baru dibuat
   dengan data sama tapi Due Date baru. Chart Task Status Dashboard
   sekarang 3 kategori: **Scheduled / Completed / Failed**.
4. List **Activity Log** menampilkan kolom **Notes** (sebelumnya cuma
   ada di form, tidak tampil di tabel).
5. Popup **Tambah/Edit Sales Order**:
   - Field **Invoice Description dihapus**.
   - Field **Contact Agen** sekarang berupa **kotak pencarian** (ketik
     nama/kode agen, muncul daftar hasil pencarian, klik untuk pilih) —
     bukan cuma dropdown biasa. Setelah pilih, daftar Linked Nomor PI
     otomatis mengikuti agen yang dipilih (perilaku lama tetap jalan).

**File yang berubah di update ini:** `TaskService.gs`,
`DashboardService.gs`, `SOService.gs`, `JavaScript.html`,
`Stylesheet.html`. Timpa isinya ke project Apps Script kamu, lalu
**Deploy → Manage deployments → New version → Deploy**.

---

## 11. Changelog v4 — Search Box untuk Semua Dropdown Agen/PI

Field yang tadinya cuma dropdown `<select>` biasa (harus di-scroll),
sekarang jadi **kotak ketik + cari** (search combo): ketik nama/kode
agen atau nomor PI, hasil muncul di bawahnya, klik untuk pilih.

Diterapkan di:
- **Activity Log** → Contact Agen
- **Task Tracker** → Contact Agen
- **Proforma Invoice** → Contact Agen
- **Gifts** → Penerima (Agen)
- **Sales Order** → Contact Agen **dan** Linked Nomor PI (dua-duanya
  sekarang bisa diketik, bukan cuma Contact Agen seperti sebelumnya)

> Catatan soal **"No PI" yang tidak ada di Activity Log**: itu memang
> disengaja. Activity Log dipakai untuk mencatat aktivitas komunikasi ke
> agen (telepon, kunjungan, dsb), bukan transaksi invoice — jadi tidak
> ada field Nomor PI di sana. No PI hanya relevan di modul Proforma
> Invoice & Sales Order. Kalau ke depannya mau ada fitur "link Activity
> ke PI tertentu", tinggal bilang, nanti saya tambahkan.

**File yang berubah:** `JavaScript.html` saja (tambah helper
`searchComboHtml_` / `wireSearchCombo_`, field type baru
`search-select`, dan form Sales Order dirombak pakai helper ini).
Timpa file itu ke project Apps Script → **Deploy → Manage deployments →
New version → Deploy**.

---

## 12. Changelog v5 — Konversi ke Standalone (Netlify) + Tema Orange & Peach

- **Arsitektur diubah**: tampilan (HTML/CSS/JS) dipisah total dari Apps
  Script, sekarang di-hosting sendiri (Netlify). Apps Script jadi API
  JSON murni lewat `doPost` + whitelist `API_FUNCTIONS` (lihat
  `Code.gs` baru).
- **Tema visual dirombak**: dari ungu terang → **orange terracotta +
  peach hangat**, pakai font **Fraunces** (judul, kesan elegan) +
  **Plus Jakarta Sans** (isi). Semua warna chart, badge, sidebar, dsb
  disesuaikan.
- **Semua fitur & logic tetap sama persis** — tidak ada modul yang
  hilang atau berubah perilaku. Yang berubah cuma cara frontend
  "ngobrol" ke server (`fetch()` menggantikan `google.script.run`) dan
  tampilannya.
- Detail teknis, cara deploy, dan troubleshooting ada di `README.md` di
  root folder ini.
