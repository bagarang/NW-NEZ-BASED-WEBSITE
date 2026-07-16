/**
 * ===================================================================
 * SETUPSERVICE.GS
 * Kelola variabel dropdown di Sheet Setup. Khusus role Manager untuk
 * mengubah, tapi semua role boleh membaca (dipakai isi form).
 * ===================================================================
 */

var PUBLIC_SETUP_KEYS = ['statusAgen', 'metodeKontak', 'pic', 'statusTransaksi', 'taskCategories'];

/** Dipanggil semua role untuk mengisi <select> di form-form CRUD. */
function apiGetFormOptions(token) {
  return safeCall_(function () {
    requireSession_(token);
    var out = {};
    PUBLIC_SETUP_KEYS.forEach(function (key) {
      out[key] = getSetupList_(key, true); // tanpa opsi "All"
    });
    // Task status dihasilkan dinamis: Scheduled + "Done - <metode kontak>"
    out.taskStatus = ['Scheduled'].concat(out.metodeKontak.map(function (m) { return 'Done - ' + m; }));
    out.priority = ['Low', 'Medium', 'High'];

    // Daftar agen untuk dropdown pilih kontak (kode kontak + nama)
    out.agenOptions = readTable_(TABLES.AGEN).map(function (a) {
      return { value: a.kodeKontak, label: a.kodeKontak + ' — ' + a.namaAgen, namaAgen: a.namaAgen };
    });

    // Daftar PI lengkap (untuk cascading dropdown "Linked Nomor PI" di form SO):
    // tiap PI tahu contact person pemiliknya, nominal dealnya, dan apakah
    // sudah dipakai (linked) oleh SO lain atau belum.
    var soListForPI = readTable_(TABLES.SO);
    var linkedSet = computeSOLinkedSet_(soListForPI);
    out.piList = readTable_(TABLES.PI).map(function (p) {
      return {
        nomorPI: p.nomorPI,
        contactPerson: p.contactPerson,
        agen: p.agen,
        dealValue: p.dealValue,
        status: computePIDisplayStatus_(p, linkedSet)
      };
    });

    out.companyName = getSetupList_('companyName', false)[0] || '';
    return out;
  });
}

/** Khusus halaman Setup (Manager): ambil semua list beserta "All". */
function apiGetSetupLists(token) {
  return safeCall_(function () {
    requireManager_(token);
    var out = { companyName: getSetupList_('companyName', false)[0] || '' };
    PUBLIC_SETUP_KEYS.forEach(function (key) {
      out[key] = getSetupList_(key, false);
    });
    return out;
  });
}

function apiSaveSetupList(token, key, items) {
  return safeCall_(function () {
    requireManager_(token);
    if (PUBLIC_SETUP_KEYS.indexOf(key) === -1) throw new Error('List tidak dikenal.');
    var cleaned = items.map(function (v) { return String(v).trim(); }).filter(function (v) { return v; });
    setSetupList_(key, cleaned);
    return true;
  });
}

function apiSaveCompanyName(token, name) {
  return safeCall_(function () {
    requireManager_(token);
    if (!name) throw new Error('Nama perusahaan tidak boleh kosong.');
    setCompanyName_(name);
    return true;
  });
}
