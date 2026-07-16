/**
 * ===================================================================
 * USERSERVICE.GS
 * CRUD akun user. Hanya bisa diakses role Manager.
 * ===================================================================
 */

function apiListUsers(token) {
  return safeCall_(function () {
    requireManager_(token);
    return readTable_(TABLES.USERS).map(function (u) {
      return { _row: u._row, username: u.username, fullName: u.fullName, role: u.role, status: u.status };
    });
  });
}

function apiSaveUser(token, payload) {
  return safeCall_(function () {
    requireManager_(token);
    if (!payload.username || !payload.fullName || !payload.role) {
      throw new Error('Username, Nama, dan Role wajib diisi.');
    }
    if (['Manager', 'Staff'].indexOf(payload.role) === -1) {
      throw new Error('Role tidak valid.');
    }

    var existing = readTable_(TABLES.USERS);
    var dup = existing.filter(function (u) {
      return String(u.username).toLowerCase() === String(payload.username).toLowerCase() && u._row !== payload._row;
    });
    if (dup.length) throw new Error('Username sudah dipakai.');

    var obj = {
      username: payload.username,
      fullName: payload.fullName,
      role: payload.role,
      status: payload.status || 'Active'
    };
    if (payload.password) {
      obj.passwordHash = hashPassword_(payload.password);
    }

    if (payload._row) {
      updateTableRow_(TABLES.USERS, payload._row, obj);
      return { _row: payload._row };
    } else {
      if (!payload.password) throw new Error('Password wajib diisi untuk user baru.');
      var row = appendToTable_(TABLES.USERS, obj);
      return { _row: row };
    }
  });
}

function apiDeleteUser(token, rowIndex, currentUsername) {
  return safeCall_(function () {
    var session = requireManager_(token);
    var users = readTable_(TABLES.USERS);
    var target = users.filter(function (u) { return u._row === rowIndex; })[0];
    if (target && String(target.username).toLowerCase() === String(session.username).toLowerCase()) {
      throw new Error('Tidak bisa menghapus akun yang sedang login.');
    }
    deleteTableRow_(TABLES.USERS, rowIndex);
    return true;
  });
}
