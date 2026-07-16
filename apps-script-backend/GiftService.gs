/**
 * ===================================================================
 * GIFTSERVICE.GS
 * ===================================================================
 */

function apiListGifts(token) {
  return safeCall_(function () {
    requireSession_(token);
    return readTable_(TABLES.GIFTS).sort(function (a, b) {
      return new Date(b.deliveryDate) - new Date(a.deliveryDate);
    });
  });
}

function apiSaveGift(token, payload) {
  return safeCall_(function () {
    requireSession_(token);
    if (!payload.recipient || !payload.deliveryDate) {
      throw new Error('Penerima dan Tanggal Pengiriman wajib diisi.');
    }

    var agen = readTable_(TABLES.AGEN).filter(function (a) { return a.kodeKontak === payload.recipient; })[0];

    var obj = {
      recipient: payload.recipient,
      clientCompany: agen ? agen.namaAgen : (payload.clientCompany || ''),
      salesRep: payload.salesRep || '',
      description: payload.description || '',
      value: payload.value ? Number(payload.value) : '',
      deliveryDate: payload.deliveryDate,
      notes: payload.notes || ''
    };

    if (payload._row) {
      updateTableRow_(TABLES.GIFTS, payload._row, obj);
      return { _row: payload._row };
    } else {
      var row = appendToTable_(TABLES.GIFTS, obj);
      return { _row: row };
    }
  });
}

function apiDeleteGift(token, rowIndex) {
  return safeCall_(function () {
    requireSession_(token);
    deleteTableRow_(TABLES.GIFTS, rowIndex);
    return true;
  });
}
