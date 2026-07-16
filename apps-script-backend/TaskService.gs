/**
 * ===================================================================
 * TASKSERVICE.GS
 * List Task hanya menampilkan task yang masih aktif (status "Scheduled").
 * Task yang sudah "Done*" atau "Failed" disembunyikan dari list, tapi
 * tetap ada di Sheet dan tetap terhitung di KPI Dashboard (Dashboard
 * membaca Sheet Tasks langsung, bukan lewat apiListTasks).
 * ===================================================================
 */

function apiListTasks(token) {
  return safeCall_(function () {
    requireSession_(token);

    // "Actual Date" tidak lagi diinput manual - diambil otomatis dari
    // tanggal Activity terakhir untuk kontak agen yang sama.
    var latestActivityByContact = {};
    readTable_(TABLES.ACTIVITY).forEach(function (a) {
      if (!a.contactPerson || !a.date) return;
      var cur = latestActivityByContact[a.contactPerson];
      if (!cur || new Date(a.date) > new Date(cur)) {
        latestActivityByContact[a.contactPerson] = a.date;
      }
    });

    return readTable_(TABLES.TASKS)
      .filter(function (t) { return t.status === 'Scheduled'; }) // sembunyikan Done*/Failed dari list
      .map(function (t) {
        t.daysUntilDue = daysBetween_(t.dueDate);
        t.actualDate = latestActivityByContact[t.contactPerson] || '';
        return t;
      })
      .sort(function (a, b) { return new Date(a.dueDate) - new Date(b.dueDate); });
  });
}

function apiSaveTask(token, payload) {
  return safeCall_(function () {
    requireSession_(token);
    if (!payload.contactPerson || !payload.dueDate) {
      throw new Error('Kontak Agen dan Due Date wajib diisi.');
    }

    var agen = readTable_(TABLES.AGEN).filter(function (a) { return a.kodeKontak === payload.contactPerson; })[0];

    // Kolom "Actual Date" sengaja tidak ditulis di sini - nilainya selalu
    // dihitung otomatis dari Sheet Activity saat data ditampilkan (lihat apiListTasks).
    var obj = {
      contactPerson: payload.contactPerson,
      agen: agen ? agen.namaAgen : (payload.agen || ''),
      admin: payload.admin || '',
      dueDate: payload.dueDate,
      priority: payload.priority || 'Medium',
      status: payload.status || 'Scheduled',
      poin: payload.poin || '',
      kategori: payload.kategori || '',
      daysUntilDue: daysBetween_(payload.dueDate)
    };

    if (payload._row) {
      updateTableRow_(TABLES.TASKS, payload._row, obj);
      return { _row: payload._row };
    } else {
      var row = appendToTable_(TABLES.TASKS, obj);
      return { _row: row };
    }
  });
}

function apiDeleteTask(token, rowIndex) {
  return safeCall_(function () {
    requireSession_(token);
    deleteTableRow_(TABLES.TASKS, rowIndex);
    return true;
  });
}

/**
 * "Recreate" task yang overdue: task lama ditandai status "Failed"
 * (tetap tersimpan & terhitung sebagai task gagal di Dashboard), lalu
 * dibuatkan task baru dengan data sama tapi Due Date baru (Sisa Hari
 * otomatis kembali positif).
 */
function apiRecreateTask(token, rowIndex, newDueDate) {
  return safeCall_(function () {
    requireSession_(token);
    if (!newDueDate) throw new Error('Due Date baru wajib diisi.');

    var tasks = readTable_(TABLES.TASKS);
    var original = tasks.filter(function (t) { return t._row === rowIndex; })[0];
    if (!original) throw new Error('Task tidak ditemukan.');

    updateTableRow_(TABLES.TASKS, rowIndex, { status: 'Failed' });

    var newObj = {
      contactPerson: original.contactPerson,
      agen: original.agen,
      admin: original.admin,
      dueDate: newDueDate,
      priority: original.priority,
      status: 'Scheduled',
      poin: original.poin,
      kategori: original.kategori,
      daysUntilDue: daysBetween_(newDueDate)
    };
    var newRow = appendToTable_(TABLES.TASKS, newObj);
    return { _row: newRow };
  });
}
