/**
 * ===================================================================
 * AUTH.GS
 * Login sederhana berbasis Sheet "Users" + token session di CacheService.
 * Setiap panggilan API dari client wajib menyertakan token yang valid.
 * ===================================================================
 */

/** Dipanggil client saat submit form login. */
function apiLogin(username, password) {
  return safeCall_(function () {
    if (!username || !password) throw new Error('Username dan password wajib diisi.');

    var users = readTable_(TABLES.USERS);
    var user = users.filter(function (u) {
      return String(u.username).toLowerCase() === String(username).toLowerCase();
    })[0];

    if (!user) throw new Error('Username tidak ditemukan.');
    if (String(user.status).toLowerCase() !== 'active') throw new Error('Akun ini nonaktif. Hubungi Sales Manager.');
    if (user.passwordHash !== hashPassword_(password)) throw new Error('Password salah.');

    var token = Utilities.getUuid();
    var session = { username: user.username, fullName: user.fullName, role: user.role };
    CacheService.getScriptCache().put('session_' + token, JSON.stringify(session), SESSION_DURATION_SEC);

    return {
      token: token,
      fullName: user.fullName,
      role: user.role,
      username: user.username
    };
  });
}

function apiLogout(token) {
  return safeCall_(function () {
    CacheService.getScriptCache().remove('session_' + token);
    return true;
  });
}

/** Ambil session dari token. Lempar error kalau tidak valid/kedaluwarsa. */
function requireSession_(token) {
  if (!token) throw new Error('Sesi tidak valid, silakan login ulang.');
  var raw = CacheService.getScriptCache().get('session_' + token);
  if (!raw) throw new Error('Sesi kedaluwarsa, silakan login ulang.');
  return JSON.parse(raw);
}

/** Sama seperti requireSession_ tapi juga memastikan role = Manager. */
function requireManager_(token) {
  var session = requireSession_(token);
  if (session.role !== MANAGER_ROLE) {
    throw new Error('Halaman ini khusus untuk Sales Manager.');
  }
  return session;
}

/** Client bisa memanggil ini untuk validasi token yang tersimpan di localStorage. */
function apiValidateSession(token) {
  return safeCall_(function () {
    return requireSession_(token);
  });
}

function hashPassword_(password) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + '::nezscent::salt');
  return digest.map(function (b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

/**
 * Jalankan SEKALI dari editor Apps Script (pilih fungsi ini lalu klik Run)
 * untuk membuat sheet "Users" pertama kali dan akun awal:
 *   - manager / manager123   (role Manager)
 *   - zahra   / zahra123     (role Staff)
 * Segera ganti password lewat menu Users setelah login pertama kali.
 */
function setupInitialUsers() {
  var db = getDB_();
  var sheet = db.getSheetByName(SHEETS.USERS);
  if (!sheet) {
    sheet = db.insertSheet(SHEETS.USERS);
  }
  sheet.clear();
  sheet.getRange(1, 1, 1, 5).setValues([['USERNAME', 'PASSWORD_HASH', 'FULL NAME', 'ROLE', 'STATUS']]);
  sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  sheet.getRange(2, 1, 2, 5).setValues([
    ['manager', hashPassword_('manager123'), 'Sales Manager', MANAGER_ROLE, 'Active'],
    ['zahra', hashPassword_('zahra123'), 'Zahra', STAFF_ROLE, 'Active']
  ]);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 5);
  SpreadsheetApp.getUi().alert('Sheet "Users" siap. Login awal:\nmanager / manager123\nzahra / zahra123');
}
