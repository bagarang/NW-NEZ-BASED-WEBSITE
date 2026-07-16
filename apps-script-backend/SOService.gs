/**
 * ===================================================================
 * SOSERVICE.GS
 * Aturan otomatis:
 *  - Payment Date diisi          -> Status otomatis jadi 'Paid'
 *  - Due Date sudah lewat        -> Status tampil 'Overdue' (merah)
 *  - Selain itu                  -> pakai Status manual yang dipilih
 *  - "Days Until Due" & "Notes" ditampilkan di list untuk follow-up
 * ===================================================================
 */

function apiListSO(token) {
  return safeCall_(function () {
    requireSession_(token);
    return readTable_(TABLES.SO)
      .map(function (s) {
        s.daysUntilDue = daysBetween_(s.dueDate);
        s.displayStatus = computeSODisplayStatus_(s);
        return s;
      })
      // Urut berdasarkan Due Date (paling mendesak duluan) sesuai kebutuhan follow-up
      .sort(function (a, b) { return new Date(a.dueDate) - new Date(b.dueDate); });
  });
}

function apiSaveSO(token, payload) {
  return safeCall_(function () {
    requireSession_(token);
    if (!payload.contactPerson || !payload.amount || !payload.dueDate) {
      throw new Error('Kontak Agen, Amount, dan Due Date wajib diisi.');
    }

    var agen = readTable_(TABLES.AGEN).filter(function (a) { return a.kodeKontak === payload.contactPerson; })[0];
    var isNew = !payload._row;
    var soNumber = isNew ? generateSONumber_() : payload.soNumber;

    // Kalau Payment Date diisi, status dipaksa jadi 'Paid' (aturan #9)
    var status = payload.status || 'Pending';
    if (payload.paymentDate) status = 'Paid';

    var obj = {
      soNumber: soNumber,
      contactPerson: payload.contactPerson,
      agen: agen ? agen.namaAgen : (payload.agen || ''),
      linkedPI: payload.linkedPI || '',
      // description (Invoice Description) sengaja tidak ditulis lagi dari
      // form - field ini sudah dihapus dari popup Tambah/Edit Sales Order.
      amount: Number(payload.amount) || 0,
      status: status,
      terms: payload.terms || '',
      soDate: payload.soDate || todayStr_(),
      dueDate: payload.dueDate,
      paymentDate: payload.paymentDate || '',
      notes: payload.notes || ''
      // clientStatus TIDAK ditulis lagi (diganti "Days Until Due" yang dihitung otomatis)
    };

    if (isNew) {
      var row = appendToTable_(TABLES.SO, obj);
      return { _row: row, soNumber: soNumber };
    } else {
      updateTableRow_(TABLES.SO, payload._row, obj);
      return { _row: payload._row, soNumber: soNumber };
    }
  });
}

function apiDeleteSO(token, rowIndex) {
  return safeCall_(function () {
    requireSession_(token);
    deleteTableRow_(TABLES.SO, rowIndex);
    return true;
  });
}
