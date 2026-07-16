/**
 * ===================================================================
 * INSTALLER.GS
 * Jalankan sekali di awal (dari editor Apps Script) untuk menyiapkan
 * struktur tambahan yang dibutuhkan web app ini:
 *   1. Sheet "Users" + akun awal (manager / zahra)
 *   2. Kolom baru: Tasks!K "KATEGORI", PI!M "STATUS PI"
 *      (dua kolom ini belum ada di spreadsheet asli; ditambahkan agar
 *      Task Categories & Status Transaksi di Setup benar-benar terpakai)
 *   3. Custom menu "Nez Scent App" di Spreadsheet UI
 * ===================================================================
 */

function runInitialSetup() {
  setupInitialUsers();
  ensureExtraColumns_();
  SpreadsheetApp.getUi().alert('Setup selesai! Sheet Users siap, kolom tambahan sudah dibuat.\nSekarang deploy sebagai Web App (Deploy > New deployment > Web app).');
}

function ensureExtraColumns_() {
  var db = getDB_();

  var tasksSheet = db.getSheetByName(SHEETS.TASKS);
  if (tasksSheet && !tasksSheet.getRange(5, 11).getValue()) {
    tasksSheet.getRange(5, 11).setValue('KATEGORI');
  }

  var piSheet = db.getSheetByName(SHEETS.PI);
  if (piSheet && !piSheet.getRange(5, 13).getValue()) {
    piSheet.getRange(5, 13).setValue('STATUS PI');
  }
}

/** Menambahkan menu custom saat spreadsheet dibuka (opsional, memudahkan admin). */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Nez Scent App')
    .addItem('1) Jalankan Setup Awal', 'runInitialSetup')
    .addToUi();
}
