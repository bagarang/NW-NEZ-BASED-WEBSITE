/**
 * ===================================================================
 * AGENSERVICE.GS
 * ===================================================================
 */

function apiListAgen(token) {
  return safeCall_(function () {
    requireSession_(token);
    return readTable_(TABLES.AGEN).sort(function (a, b) {
      return (a.namaAgen || '').localeCompare(b.namaAgen || '');
    });
  });
}

function apiSaveAgen(token, payload) {
  return safeCall_(function () {
    requireSession_(token);
    if (!payload.namaAgen || !payload.contactPerson) {
      throw new Error('Nama Agen dan Contact Person wajib diisi.');
    }

    var isNew = !payload._row;
    var contactId = isNew ? generateContactId_() : payload.contactId;

    var obj = {
      contactId: contactId,
      namaAgen: payload.namaAgen,
      contactPerson: payload.contactPerson,
      jobTitle: payload.jobTitle || '',
      phone: payload.phone || '',
      locationPublic: payload.locationPublic || '',
      shippingAddress: payload.shippingAddress || '',
      expedisi: payload.expedisi || '',
      status: payload.status || 'Active',
      pic: payload.pic || '',
      preferredContact: payload.preferredContact || '',
      kodeKontak: '[' + contactId + '] ' + payload.contactPerson
    };

    if (isNew) {
      var row = appendToTable_(TABLES.AGEN, obj);
      return { _row: row, contactId: contactId };
    } else {
      updateTableRow_(TABLES.AGEN, payload._row, obj);
      return { _row: payload._row, contactId: contactId };
    }
  });
}

function apiDeleteAgen(token, rowIndex) {
  return safeCall_(function () {
    requireSession_(token);
    deleteTableRow_(TABLES.AGEN, rowIndex);
    return true;
  });
}
