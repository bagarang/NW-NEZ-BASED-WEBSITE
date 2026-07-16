/**
 * ===================================================================
 * UTILS.GS
 * Helper generik untuk baca/tulis sheet berbasis definisi TABLES,
 * plus fungsi bantu lain (format tanggal, generate ID, dsb).
 * ===================================================================
 */

/**
 * Ambil seluruh baris data dari sebuah tabel sebagai array of object.
 * Setiap object otomatis punya properti _row = nomor baris di sheet
 * (dipakai untuk update/delete).
 */
function readTable_(tableDef) {
  var sheet = getDB_().getSheetByName(tableDef.sheet);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < tableDef.dataStart) return [];

  var numRows = lastRow - tableDef.dataStart + 1;
  var range = sheet.getRange(tableDef.dataStart, 1, numRows, tableDef.lastCol);
  var values = range.getValues();

  var fields = Object.keys(tableDef.cols);
  var result = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    // Lewati baris yang benar-benar kosong (kolom kedua kosong)
    var firstColIdx = tableDef.cols[fields[0]] - 1;
    if (row[firstColIdx] === '' || row[firstColIdx] === null) continue;

    var obj = { _row: tableDef.dataStart + i };
    for (var f = 0; f < fields.length; f++) {
      var colIdx = tableDef.cols[fields[f]] - 1;
      obj[fields[f]] = normalizeCell_(row[colIdx]);
    }
    result.push(obj);
  }
  return result;
}

function normalizeCell_(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd');
  }
  return val;
}

/**
 * Tambah baris baru ke tabel. `obj` berisi field sesuai tableDef.cols.
 * Mengembalikan nomor baris baru.
 */
function appendToTable_(tableDef, obj) {
  var sheet = getDB_().getSheetByName(tableDef.sheet);
  var newRow = Math.max(sheet.getLastRow() + 1, tableDef.dataStart);
  writeRow_(sheet, tableDef, newRow, obj);
  return newRow;
}

/**
 * Update baris tertentu (berdasar obj._row) dengan field-field baru.
 * Field yang tidak ada di obj tidak akan ditimpa.
 */
function updateTableRow_(tableDef, rowIndex, obj) {
  var sheet = getDB_().getSheetByName(tableDef.sheet);
  writeRow_(sheet, tableDef, rowIndex, obj, true);
}

function writeRow_(sheet, tableDef, rowIndex, obj, partial) {
  var fields = Object.keys(tableDef.cols);
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (partial && !obj.hasOwnProperty(f)) continue;
    var col = tableDef.cols[f];
    var val = obj[f];
    if (val === undefined) val = '';
    sheet.getRange(rowIndex, col).setValue(val);
  }
}

function deleteTableRow_(tableDef, rowIndex) {
  var sheet = getDB_().getSheetByName(tableDef.sheet);
  sheet.deleteRow(rowIndex);
}

/**
 * Ambil daftar nilai dropdown dari Sheet Setup untuk satu kategori.
 * excludeAll = true akan membuang opsi "All" (dipakai untuk form input,
 * bukan filter).
 */
function getSetupList_(key, excludeAll) {
  var def = SETUP_LISTS[key];
  if (!def) return [];
  var sheet = getDB_().getSheetByName(SHEETS.SETUP);
  if (def.single) {
    return [sheet.getRange(SETUP_LIST_START_ROW, def.col).getValue()];
  }
  var lastRow = sheet.getRange(SETUP_LIST_START_ROW, def.col, 100, 1)
    .getValues()
    .reduce(function (lastNonEmpty, val, idx) {
      return (val[0] !== '' && val[0] !== null) ? SETUP_LIST_START_ROW + idx : lastNonEmpty;
    }, SETUP_LIST_START_ROW - 1);

  if (lastRow < SETUP_LIST_START_ROW) return [];
  var values = sheet.getRange(SETUP_LIST_START_ROW, def.col, lastRow - SETUP_LIST_START_ROW + 1, 1)
    .getValues()
    .map(function (r) { return r[0]; })
    .filter(function (v) { return v !== '' && v !== null; });

  if (excludeAll) {
    values = values.filter(function (v) { return String(v).toLowerCase() !== 'all'; });
  }
  return values;
}

/** Simpan ulang seluruh isi list dropdown (dipakai halaman Setup). */
function setSetupList_(key, items) {
  var def = SETUP_LISTS[key];
  if (!def || def.single) throw new Error('List tidak bisa diubah dengan cara ini.');
  var sheet = getDB_().getSheetByName(SHEETS.SETUP);

  // Bersihkan kolom (100 baris ke bawah) lalu tulis ulang, "All" selalu di baris pertama.
  sheet.getRange(SETUP_LIST_START_ROW, def.col, 100, 1).clearContent();
  var out = ['All'].concat(items.filter(function (v) { return String(v).toLowerCase() !== 'all'; }));
  sheet.getRange(SETUP_LIST_START_ROW, def.col, out.length, 1)
    .setValues(out.map(function (v) { return [v]; }));
}

function setCompanyName_(name) {
  var sheet = getDB_().getSheetByName(SHEETS.SETUP);
  sheet.getRange(SETUP_LIST_START_ROW, SETUP_LISTS.companyName.col).setValue(name);
}

/** Generate ID kontak baru, format NEZ_0001, NEZ_0002, dst. */
function generateContactId_() {
  var rows = readTable_(TABLES.AGEN);
  var maxNum = 0;
  rows.forEach(function (r) {
    var m = /NEZ_(\d+)/.exec(r.contactId || '');
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  });
  var next = maxNum + 1;
  return 'NEZ_' + ('0000' + next).slice(-4);
}

/** Generate nomor PI baru mengikuti pola DNW/PI/{seq}K{YY}/NEZ */
function generatePINumber_() {
  var rows = readTable_(TABLES.PI);
  var maxSeq = 0;
  rows.forEach(function (r) {
    var m = /DNW\/PI\/(\d+)K\d+\/NEZ/.exec(r.nomorPI || '');
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  });
  var next = maxSeq + 1;
  var yy = String(new Date().getFullYear()).slice(-2);
  return 'DNW/PI/' + ('000' + next).slice(-3) + 'K' + yy + '/NEZ';
}

/** Generate nomor SO baru mengikuti pola SO/{seq}/{YY}/NEZ */
function generateSONumber_() {
  var rows = readTable_(TABLES.SO);
  var maxSeq = 0;
  rows.forEach(function (r) {
    var m = /SO\/(\d+)\/\d+\/NEZ/.exec(r.soNumber || '');
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  });
  var next = maxSeq + 1;
  var yy = String(new Date().getFullYear()).slice(-2);
  return 'SO/' + ('000' + next).slice(-3) + '/' + yy + '/NEZ';
}

function todayStr_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd');
}

function daysBetween_(dateStr) {
  if (!dateStr) return '';
  var due = new Date(dateStr);
  var today = new Date(todayStr_());
  var diff = Math.round((due - today) / (1000 * 60 * 60 * 24));
  return diff;
}

/** Bungkus semua endpoint publik dengan try/catch supaya error rapi di client. */
function safeCall_(fn) {
  try {
    return { ok: true, data: fn() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* ---------------------------------------------------------------
 * Status turunan PI <-> SO (dipakai PIService, SOService, DashboardService)
 * ------------------------------------------------------------- */

/** Set nomor PI mana saja yang sudah dipakai (linked) oleh sebuah SO. */
function computeSOLinkedSet_(soList) {
  var set = {};
  soList.forEach(function (s) { if (s.linkedPI) set[s.linkedPI] = true; });
  return set;
}

/** Status PI otomatis: 'Sudah SO' kalau nomor PI-nya sudah dipakai di SO manapun. */
function computePIDisplayStatus_(piRow, linkedSet) {
  return linkedSet[piRow.nomorPI] ? 'Sudah SO' : 'Belum SO';
}

/**
 * Status SO otomatis:
 *  - Payment Date terisi -> 'Paid'
 *  - Due Date sudah lewat & belum Paid -> 'Overdue'
 *  - Selain itu -> status manual yang dipilih user (Pending/Split Payment/dst)
 */
function computeSODisplayStatus_(soRow) {
  if (soRow.status === 'Paid') return 'Paid';
  if (soRow.dueDate) {
    var due = new Date(soRow.dueDate);
    var today = new Date(todayStr_());
    if (due < today) return 'Overdue';
  }
  return soRow.status || 'Pending';
}
