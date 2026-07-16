/**
 * ===================================================================
 * DASHBOARDSERVICE.GS
 * Menghitung ulang semua angka yang di Spreadsheet asli dibuat lewat
 * formula QUERY/COUNTIF di Sheet Setup & Dashboard.
 * ===================================================================
 */

function apiGetDashboard(token) {
  return safeCall_(function () {
    requireSession_(token);

    var agenList = readTable_(TABLES.AGEN);
    var taskList = readTable_(TABLES.TASKS);
    var activityList = readTable_(TABLES.ACTIVITY);
    var piList = readTable_(TABLES.PI);
    var soList = readTable_(TABLES.SO);

    var today = new Date(todayStr_());
    var last7 = new Date(today); last7.setDate(last7.getDate() - 7);
    var last30 = new Date(today); last30.setDate(last30.getDate() - 30);

    // ---- KPI cards ----
    var kpi = {
      totalAgen: agenList.length,
      activities7d: activityList.filter(function (a) { return a.date && new Date(a.date) >= last7 && new Date(a.date) <= today; }).length,
      activities30d: activityList.filter(function (a) { return a.date && new Date(a.date) >= last30 && new Date(a.date) <= today; }).length,
      piMade: piList.length
    };

    // ---- Top 5 Agen by jumlah transaksi PI & nominal PI ----
    var piByAgen = {};
    piList.forEach(function (p) {
      var key = p.agen || '(Tanpa Agen)';
      if (!piByAgen[key]) piByAgen[key] = { count: 0, total: 0 };
      piByAgen[key].count += 1;
      piByAgen[key].total += Number(p.dealValue) || 0;
    });
    var top5ByCount = toSortedArray_(piByAgen, 'count').slice(0, 5);
    var top5ByNominal = toSortedArray_(piByAgen, 'total').slice(0, 5);

    // ---- Active Agent Status ----
    var statusCount = {};
    agenList.forEach(function (a) {
      var s = a.status || '(Kosong)';
      statusCount[s] = (statusCount[s] || 0) + 1;
    });

    // ---- Top 5 Sales Order by nominal ----
    var soByAgen = {};
    soList.forEach(function (s) {
      var key = s.agen || '(Tanpa Agen)';
      soByAgen[key] = (soByAgen[key] || 0) + (Number(s.amount) || 0);
    });
    var top5SO = Object.keys(soByAgen)
      .map(function (k) { return { label: k, value: soByAgen[k] }; })
      .sort(function (a, b) { return b.value - a.value; })
      .slice(0, 5);

    // ---- Status SO (pakai status otomatis: Paid/Overdue/manual) ----
    var linkedSet = computeSOLinkedSet_(soList);
    var statusSOCount = {};
    soList.forEach(function (s) {
      var st = computeSODisplayStatus_(s);
      statusSOCount[st] = (statusSOCount[st] || 0) + 1;
    });

    // ---- Task status: Scheduled vs Completed (Done*) ----
    var scheduled = taskList.filter(function (t) { return t.status === 'Scheduled'; }).length;
    var completed = taskList.filter(function (t) { return /^Done/i.test(t.status || ''); }).length;
    var failed = taskList.filter(function (t) { return t.status === 'Failed'; }).length;

    // ---- Recent lists ----
    var recentActivity = activityList
      .slice()
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
      .slice(0, 10);

    var upcomingTasks = taskList
      .filter(function (t) { return t.status === 'Scheduled'; })
      .map(function (t) { t.daysUntilDue = daysBetween_(t.dueDate); return t; })
      .sort(function (a, b) { return new Date(a.dueDate) - new Date(b.dueDate); })
      .slice(0, 5);

    var recentPI = piList
      .slice()
      .sort(function (a, b) { return new Date(b.piDate) - new Date(a.piDate); })
      .slice(0, 5)
      .map(function (p) { p.statusPI = computePIDisplayStatus_(p, linkedSet); return p; });

    // Recent SO diurutkan & ditampilkan berdasarkan Due Date (bukan SO Date)
    // supaya yang paling mendesak untuk di-follow-up muncul duluan.
    var recentSO = soList
      .slice()
      .sort(function (a, b) { return new Date(a.dueDate) - new Date(b.dueDate); })
      .slice(0, 5)
      .map(function (s) { s.daysUntilDue = daysBetween_(s.dueDate); s.displayStatus = computeSODisplayStatus_(s); return s; });

    return {
      companyName: getSetupList_('companyName', false)[0] || 'Nez Scent',
      kpi: kpi,
      top5ByCount: top5ByCount,
      top5ByNominal: top5ByNominal,
      statusAgen: objToArray_(statusCount),
      top5SO: top5SO,
      statusSO: objToArray_(statusSOCount),
      taskStatus: { scheduled: scheduled, completed: completed, failed: failed },
      recentActivity: recentActivity,
      upcomingTasks: upcomingTasks,
      recentPI: recentPI,
      recentSO: recentSO
    };
  });
}

function toSortedArray_(map, sortField) {
  return Object.keys(map)
    .map(function (k) { return { label: k, count: map[k].count, value: sortField === 'total' ? map[k].total : map[k].count }; })
    .sort(function (a, b) { return (sortField === 'total' ? b.value - a.value : b.value - a.value); });
}

function objToArray_(map) {
  return Object.keys(map).map(function (k) { return { label: k, value: map[k] }; });
}
