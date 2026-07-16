/**
 * ===================================================================
 * CODE.GS — API BACKEND (bukan lagi server tampilan)
 * Frontend (HTML/CSS/JS) sekarang berdiri sendiri, di-hosting di
 * Netlify/GitHub Pages, dan memanggil Web App ini lewat fetch() POST.
 * Spreadsheet tetap jadi database, Apps Script cuma jadi jembatan API.
 * ===================================================================
 */

/**
 * Whitelist fungsi yang boleh dipanggil dari luar lewat doPost.
 * Ini penting untuk keamanan — jangan ganti jadi "panggil fungsi apa saja
 * berdasarkan nama string" tanpa whitelist, supaya orang luar tidak bisa
 * memanggil fungsi internal (yang diawali garis bawah `_`) secara langsung.
 */
var API_FUNCTIONS = {
  // Auth
  apiLogin: apiLogin,
  apiLogout: apiLogout,
  apiValidateSession: apiValidateSession,

  // Setup / form options
  apiGetFormOptions: apiGetFormOptions,
  apiGetSetupLists: apiGetSetupLists,
  apiSaveSetupList: apiSaveSetupList,
  apiSaveCompanyName: apiSaveCompanyName,

  // Users
  apiListUsers: apiListUsers,
  apiSaveUser: apiSaveUser,
  apiDeleteUser: apiDeleteUser,

  // Agen
  apiListAgen: apiListAgen,
  apiSaveAgen: apiSaveAgen,
  apiDeleteAgen: apiDeleteAgen,

  // Tasks
  apiListTasks: apiListTasks,
  apiSaveTask: apiSaveTask,
  apiDeleteTask: apiDeleteTask,
  apiRecreateTask: apiRecreateTask,

  // Activity
  apiListActivity: apiListActivity,
  apiSaveActivity: apiSaveActivity,
  apiDeleteActivity: apiDeleteActivity,

  // PI
  apiListPI: apiListPI,
  apiSavePI: apiSavePI,
  apiDeletePI: apiDeletePI,

  // SO
  apiListSO: apiListSO,
  apiSaveSO: apiSaveSO,
  apiDeleteSO: apiDeleteSO,

  // Gifts
  apiListGifts: apiListGifts,
  apiSaveGift: apiSaveGift,
  apiDeleteGift: apiDeleteGift,

  // Lookup
  apiLookupAgen: apiLookupAgen,

  // Dashboard
  apiGetDashboard: apiGetDashboard
};

/**
 * Semua request dari frontend masuk lewat sini (POST), format body:
 *   { "fn": "apiLogin", "args": ["manager", "manager123"] }
 * Frontend WAJIB kirim dengan header Content-Type: text/plain
 * (bukan application/json) supaya browser tidak melakukan CORS
 * preflight (Apps Script tidak mendukung method OPTIONS) — isi body
 * tetap JSON string biasa, cuma header-nya yang disamarkan.
 */
function doPost(e) {
  var result;
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var body = JSON.parse(raw);
    var fnName = body.fn;
    var args = body.args || [];

    var fn = API_FUNCTIONS[fnName];
    if (typeof fn !== 'function') {
      throw new Error('Endpoint tidak dikenal: ' + fnName);
    }
    result = fn.apply(null, args);
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  return jsonOutput_(result);
}

/** doGet cuma dipakai untuk healthcheck / cek Web App sudah aktif. */
function doGet(e) {
  return jsonOutput_({
    ok: true,
    message: 'Nez Scent API aktif. Gunakan POST dengan body {"fn":"...","args":[...]} untuk memanggil endpoint.'
  });
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
