/**
 * ===================================================================
 * LOOKUPSERVICE.GS
 * Diberi "Kode Kontak" agen (format: [NEZ_0001] Nama), kembalikan
 * profil lengkap: Detail Kontak, Recent Activity, Recent PI,
 * Recent SO, dan Gifts.
 * ===================================================================
 */

function apiLookupAgen(token, kodeKontak) {
  return safeCall_(function () {
    requireSession_(token);
    if (!kodeKontak) throw new Error('Pilih agen terlebih dahulu.');

    var agen = readTable_(TABLES.AGEN).filter(function (a) { return a.kodeKontak === kodeKontak; })[0];
    if (!agen) throw new Error('Data agen tidak ditemukan.');

    var activity = readTable_(TABLES.ACTIVITY)
      .filter(function (a) { return a.contactPerson === kodeKontak; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
      .slice(0, 5);

    var pi = readTable_(TABLES.PI)
      .filter(function (p) { return p.contactPerson === kodeKontak; })
      .sort(function (a, b) { return new Date(b.lastUpdated || b.piDate) - new Date(a.lastUpdated || a.piDate); })
      .slice(0, 5);

    var so = readTable_(TABLES.SO)
      .filter(function (s) { return s.contactPerson === kodeKontak; })
      .sort(function (a, b) { return new Date(b.soDate) - new Date(a.soDate); })
      .slice(0, 5);

    var gifts = readTable_(TABLES.GIFTS)
      .filter(function (g) { return g.recipient === kodeKontak; })
      .sort(function (a, b) { return new Date(b.deliveryDate) - new Date(a.deliveryDate); })
      .slice(0, 5);

    return { agen: agen, activity: activity, pi: pi, so: so, gifts: gifts };
  });
}
