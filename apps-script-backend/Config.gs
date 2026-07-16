/**
 * ===================================================================
 * CONFIG.GS
 * Konfigurasi terpusat: nama sheet, baris header, kolom, dsb.
 * Kalau struktur spreadsheet berubah, cukup ubah di sini.
 * ===================================================================
 */

// ID spreadsheet database. Kosongkan ('') jika script di-bind langsung
// ke spreadsheet (Extensions > Apps Script dari dalam Sheet).
var SPREADSHEET_ID = '';

function getDB_() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

// Nama-nama sheet
var SHEETS = {
  SETUP: 'Setup',
  DASHBOARD: 'Dashboard',
  AGEN: 'Agen',
  TASKS: 'Tasks',
  ACTIVITY: 'Activity',
  PI: 'PI',
  SO: 'SO',
  GIFTS: 'Gifts',
  LOOKUP: 'Lookup',
  USERS: 'Users'
};

/**
 * Definisi tabel: header row, baris awal data, kolom terakhir, dan
 * peta nama field -> nomor kolom (1 = A, 2 = B, dst).
 */
var TABLES = {
  AGEN: {
    sheet: SHEETS.AGEN,
    headerRow: 4,
    dataStart: 5,
    lastCol: 13, // M
    cols: {
      contactId: 2,        // B
      namaAgen: 3,          // C
      contactPerson: 4,     // D
      jobTitle: 5,           // E
      phone: 6,               // F
      locationPublic: 7,       // G
      shippingAddress: 8,       // H
      expedisi: 9,                // I
      status: 10,                   // J
      pic: 11,                        // K
      preferredContact: 12,             // L
      kodeKontak: 13                      // M
    }
  },
  TASKS: {
    sheet: SHEETS.TASKS,
    headerRow: 5,
    dataStart: 6,
    lastCol: 11, // K
    cols: {
      contactPerson: 2, // B (kode kontak agen)
      agen: 3,           // C
      admin: 4,           // D
      dueDate: 5,          // E
      actualDate: 6,        // F
      priority: 7,           // G
      status: 8,               // H
      poin: 9,                   // I
      daysUntilDue: 10,           // J
      kategori: 11                  // K (kolom baru)
    }
  },
  ACTIVITY: {
    sheet: SHEETS.ACTIVITY,
    headerRow: 4,
    dataStart: 5,
    lastCol: 8, // H
    cols: {
      contactPerson: 2, // B
      agen: 3,           // C
      date: 4,             // D
      admin: 5,              // E
      contactMethod: 6,       // F
      notes: 7,                 // G
      clientStatus: 8            // H
    }
  },
  PI: {
    sheet: SHEETS.PI,
    headerRow: 5,
    dataStart: 6,
    lastCol: 13, // M
    cols: {
      nomorPI: 2,      // B
      dealName: 3,      // C
      contactPerson: 4,  // D
      agen: 5,             // E
      salesRep: 6,           // F
      dealValue: 7,            // G
      piDate: 8,                 // H
      paymentDate: 9,              // I
      lastUpdated: 10,               // J
      notes: 11,                       // K
      clientStatus: 12,                  // L
      statusPI: 13                         // M (kolom baru)
    }
  },
  SO: {
    sheet: SHEETS.SO,
    headerRow: 5,
    dataStart: 6,
    lastCol: 14, // N
    cols: {
      soNumber: 2,     // B
      contactPerson: 3,  // C
      agen: 4,             // D
      linkedPI: 5,           // E
      description: 6,          // F
      amount: 7,                 // G
      status: 8,                   // H
      terms: 9,                      // I
      soDate: 10,                      // J
      dueDate: 11,                       // K
      paymentDate: 12,                     // L
      notes: 13,                             // M
      clientStatus: 14                         // N
    }
  },
  GIFTS: {
    sheet: SHEETS.GIFTS,
    headerRow: 5,
    dataStart: 6,
    lastCol: 8, // H
    cols: {
      recipient: 2, // B (kode kontak agen)
      clientCompany: 3, // C
      salesRep: 4,        // D
      description: 5,       // E
      value: 6,               // F
      deliveryDate: 7,          // G
      notes: 8                    // H
    }
  },
  USERS: {
    sheet: SHEETS.USERS,
    headerRow: 1,
    dataStart: 2,
    lastCol: 5,
    cols: {
      username: 1, // A
      passwordHash: 2, // B
      fullName: 3,       // C
      role: 4,             // D  ('Manager' | 'Staff')
      status: 5               // E ('Active' | 'Inactive')
    }
  }
};

// Kolom variabel dropdown di Sheet Setup (row 6 ke bawah)
var SETUP_LISTS = {
  companyName: { col: 2, single: true },       // B6
  statusAgen: { col: 4 },                       // D6:D...
  metodeKontak: { col: 6 },                      // F6:F...
  pic: { col: 8 },                                 // H6:H...
  statusTransaksi: { col: 10 },                      // J6:J... (PI/SO status)
  taskCategories: { col: 12 }                          // L6:L...
};
var SETUP_LIST_START_ROW = 6;

// Role yang boleh mengakses tab Setup & Users
var MANAGER_ROLE = 'Manager';
var STAFF_ROLE = 'Staff';

// Lama sesi login (dalam detik) - 8 jam
var SESSION_DURATION_SEC = 8 * 60 * 60;
