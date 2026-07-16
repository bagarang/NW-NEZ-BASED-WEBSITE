/**
 * ===================================================================
 * PISERVICE.GS
 * Status PI ("Belum SO" / "Sudah SO") dihitung OTOMATIS berdasarkan
 * apakah nomor PI ini sudah dipakai (linked) oleh sebuah Sales Order,
 * bukan dropdown manual lagi.
 * ===================================================================
 */

function apiListPI(token) {
  return safeCall_(function () {
    requireSession_(token);
    var linkedSet = computeSOLinkedSet_(readTable_(TABLES.SO));
    return readTable_(TABLES.PI)
      .map(function (p) {
        p.statusPI = computePIDisplayStatus_(p, linkedSet);
        return p;
      })
      .sort(function (a, b) { return new Date(b.piDate) - new Date(a.piDate); });
  });
}

function apiSavePI(token, payload) {
  return safeCall_(function () {
    requireSession_(token);
    if (!payload.contactPerson || !payload.dealValue || !payload.piDate) {
      throw new Error('Kontak Agen, Deal Value, dan PI Date wajib diisi.');
    }

    var agen = readTable_(TABLES.AGEN).filter(function (a) { return a.kodeKontak === payload.contactPerson; })[0];
    var isNew = !payload._row;
    var nomorPI = isNew ? generatePINumber_() : payload.nomorPI;

    // dealName, paymentDate, clientStatus, statusPI TIDAK ditulis lagi dari
    // form (field-field ini sudah dihapus dari form Proforma Invoice).
    // Kalau ada nilai lama di sheet, nilai itu dibiarkan apa adanya
    // (updateTableRow_ hanya menimpa kolom yang memang ada di object ini).
    var obj = {
      nomorPI: nomorPI,
      contactPerson: payload.contactPerson,
      agen: agen ? agen.namaAgen : (payload.agen || ''),
      salesRep: payload.salesRep || '', // label di UI: "Admin"
      dealValue: Number(payload.dealValue) || 0,
      piDate: payload.piDate,
      lastUpdated: todayStr_(),
      notes: payload.notes || ''
    };

    if (isNew) {
      var row = appendToTable_(TABLES.PI, obj);
      return { _row: row, nomorPI: nomorPI };
    } else {
      updateTableRow_(TABLES.PI, payload._row, obj);
      return { _row: payload._row, nomorPI: nomorPI };
    }
  });
}

function apiDeletePI(token, rowIndex) {
  return safeCall_(function () {
    requireSession_(token);
    deleteTableRow_(TABLES.PI, rowIndex);
    return true;
  });
}
