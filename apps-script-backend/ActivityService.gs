/**
 * ===================================================================
 * ACTIVITYSERVICE.GS
 * ===================================================================
 */

function apiListActivity(token) {
  return safeCall_(function () {
    requireSession_(token);
    return readTable_(TABLES.ACTIVITY).sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });
  });
}

function apiSaveActivity(token, payload) {
  return safeCall_(function () {
    requireSession_(token);
    if (!payload.contactPerson || !payload.date) {
      throw new Error('Kontak Agen dan Tanggal wajib diisi.');
    }

    var agen = readTable_(TABLES.AGEN).filter(function (a) { return a.kodeKontak === payload.contactPerson; })[0];

    var obj = {
      contactPerson: payload.contactPerson,
      agen: agen ? agen.namaAgen : (payload.agen || ''),
      date: payload.date,
      admin: payload.admin || '',
      contactMethod: payload.contactMethod || '',
      notes: payload.notes || '',
      clientStatus: payload.clientStatus || 'Active'
    };

    if (payload._row) {
      updateTableRow_(TABLES.ACTIVITY, payload._row, obj);
      return { _row: payload._row };
    } else {
      var row = appendToTable_(TABLES.ACTIVITY, obj);
      return { _row: row };
    }
  });
}

function apiDeleteActivity(token, rowIndex) {
  return safeCall_(function () {
    requireSession_(token);
    deleteTableRow_(TABLES.ACTIVITY, rowIndex);
    return true;
  });
}
