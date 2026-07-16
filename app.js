/* ===================================================================
   NEZ SCENT AGEN DASHBOARD — client app (vanilla JS SPA)
   Frontend berdiri sendiri (di-hosting di Netlify), Spreadsheet tetap
   jadi database, Google Apps Script cuma jadi API JSON.
   =================================================================== */

/**
 * >>> WAJIB DIISI SEBELUM DEPLOY <<<
 * Tempel URL Web App hasil Deploy Apps Script kamu di sini, akhiran
 * harus "/exec". Contoh:
 * 'https://script.google.com/macros/s/AKfycbwJoE99dcloFF7W8nS9h-gVAIuI2VGEDOD2LOHLOXhA5MPh29cNzoZeZQkEdEFLJF_s/exec'
 */
var API_URL = 'PASTE_URL_WEB_APP_APPS_SCRIPT_KAMU_DI_SINI';

var STATE = {
  token: null,
  user: null,          // { fullName, role, username }
  formOptions: null,    // loaded once after login
  page: 'dashboard',
  charts: {}              // Chart.js instances, keyed by canvas id
};

var MENU = [
  { key: 'dashboard', label: 'Dashboard', icon: '\u{1F4CA}', roles: ['Manager', 'Staff'] },
  { key: 'agen', label: 'Agen', icon: '\u{1F465}', roles: ['Manager', 'Staff'] },
  { key: 'tasks', label: 'Tasks', icon: '\u{1F4CB}', roles: ['Manager', 'Staff'] },
  { key: 'activity', label: 'Activity', icon: '\u{1F4DE}', roles: ['Manager', 'Staff'] },
  { key: 'pi', label: 'Proforma Invoice', icon: '\u{1F4C4}', roles: ['Manager', 'Staff'] },
  { key: 'so', label: 'Sales Order', icon: '\u{1F4E6}', roles: ['Manager', 'Staff'] },
  { key: 'gifts', label: 'Gifts', icon: '\u{1F381}', roles: ['Manager', 'Staff'] },
  { key: 'lookup', label: 'Agen Lookup', icon: '\u{1F50D}', roles: ['Manager', 'Staff'] },
  { key: 'setup', label: 'Setup', icon: '\u{2699}\u{FE0F}', roles: ['Manager'] },
  { key: 'users', label: 'Users', icon: '\u{1F510}', roles: ['Manager'] }
];

/**
 * ---------------- API helper: fetch() ke Apps Script Web App ----------------
 * Header Content-Type sengaja "text/plain" (bukan application/json) supaya
 * browser TIDAK melakukan CORS preflight (OPTIONS) - Apps Script Web App
 * tidak mendukung preflight, jadi kalau pakai application/json request akan
 * gagal karena diblokir CORS. Isi body tetap JSON string biasa.
 * Bentuk Promise & cara pemakaian (api('apiLogin', u, p).then(...)) SAMA
 * PERSIS seperti sebelumnya, jadi semua kode di bawah ini tidak perlu diubah.
 */
function api(fnName) {
  var args = Array.prototype.slice.call(arguments, 1);
  return fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ fn: fnName, args: args })
  })
    .then(function (res) {
      if (!res.ok) throw new Error('Gagal menghubungi server (HTTP ' + res.status + ').');
      return res.json();
    })
    .then(function (res) {
      if (res && res.ok === false) throw new Error(res.error || 'Terjadi kesalahan.');
      return res && res.hasOwnProperty('data') ? res.data : res;
    });
}

function toast(msg, type) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { el.className = 'toast'; }, 3200);
}

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function fmtMoney(n) {
  n = Number(n) || 0;
  return 'Rp ' + n.toLocaleString('id-ID');
}
function fmtDate(d) {
  if (!d) return '-';
  var dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function badgeClass(val) {
  var v = String(val || '').toLowerCase();
  if (/sudah/.test(v)) return 'active';     // "Sudah SO" -> hijau
  if (/belum/.test(v)) return 'pending';     // "Belum SO" -> kuning
  if (/overdue|failed/.test(v)) return 'inactive';   // merah, ditonjolkan buat follow up
  if (/active|done|received|completed|paid/.test(v)) return 'active';
  if (/inactive|cancel/.test(v)) return 'inactive';
  if (/pending|scheduled|sent|split/.test(v)) return 'pending';
  return 'default';
}

/* ---------------- Session bootstrap ---------------- */
function boot() {
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem('nez_session') || 'null'); } catch (e) {}
  if (saved && saved.token) {
    STATE.token = saved.token;
    STATE.user = saved;
    api('apiValidateSession', STATE.token).then(function () {
      afterLogin();
    }).catch(function () {
      localStorage.removeItem('nez_session');
      renderLogin();
    });
  } else {
    renderLogin();
  }
}

function renderLogin(errorMsg) {
  document.getElementById('app').innerHTML =
    '<div class="login-wrap"><div class="login-card">' +
    '<h1>Nez Scent</h1><p class="sub">Agen Dashboard &mdash; silakan login</p>' +
    (errorMsg ? '<div class="error-msg">' + esc(errorMsg) + '</div>' : '') +
    '<div class="field"><label>Username</label><input id="loginUser" type="text" autocomplete="username"></div>' +
    '<div class="field"><label>Password</label><input id="loginPass" type="password" autocomplete="current-password"></div>' +
    '<button class="btn block" id="loginBtn">Masuk</button>' +
    '</div></div>';

  document.getElementById('loginBtn').onclick = doLogin;
  document.getElementById('loginPass').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doLogin();
  });
}

function doLogin() {
  var u = document.getElementById('loginUser').value.trim();
  var p = document.getElementById('loginPass').value;
  var btn = document.getElementById('loginBtn');
  btn.textContent = 'Memproses...';
  api('apiLogin', u, p).then(function (res) {
    STATE.token = res.token;
    STATE.user = res;
    localStorage.setItem('nez_session', JSON.stringify(res));
    afterLogin();
  }).catch(function (err) {
    renderLogin(err.message);
  });
}

function logout() {
  api('apiLogout', STATE.token).finally(function () {
    localStorage.removeItem('nez_session');
    STATE.token = null; STATE.user = null;
    renderLogin();
  });
}

function afterLogin() {
  api('apiGetFormOptions', STATE.token).then(function (opts) {
    STATE.formOptions = opts;
    renderShell();
    navigate('dashboard');
  }).catch(function (err) { toast(err.message, 'error'); });
}

/* ---------------- Shell (sidebar + topbar) ---------------- */
function renderShell() {
  var role = STATE.user.role;
  var links = MENU.filter(function (m) { return m.roles.indexOf(role) !== -1; })
    .map(function (m) {
      return '<a href="#" class="nav-link" data-page="' + m.key + '"><span>' + m.icon + '</span><span>' + m.label + '</span></a>';
    }).join('');

  document.getElementById('app').innerHTML =
    '<div class="overlay-bg" id="overlayBg"></div>' +
    '<div class="shell">' +
      '<nav class="sidebar" id="sidebar">' +
        '<div class="brand">Nez Scent</div>' +
        '<div class="brand-sub">' + esc(STATE.formOptions.companyName || 'Agen Dashboard') + '</div>' +
        links +
        '<div class="sidebar-footer">Login sebagai<br><b style="color:#fff">' + esc(STATE.user.fullName) + '</b> &middot; ' + esc(role) + '</div>' +
      '</nav>' +
      '<div class="main">' +
        '<div class="topbar">' +
          '<div style="display:flex;align-items:center;gap:12px;">' +
            '<button class="hamburger" id="hamburgerBtn">\u2630</button>' +
            '<div class="title" id="pageTitle">Dashboard</div>' +
          '</div>' +
          '<div class="user-chip">' +
            '<div class="avatar">' + esc(STATE.user.fullName.slice(0, 2).toUpperCase()) + '</div>' +
            '<button class="btn secondary sm" id="logoutBtn">Keluar</button>' +
          '</div>' +
        '</div>' +
        '<div class="content" id="content"></div>' +
      '</div>' +
    '</div>';

  document.querySelectorAll('.nav-link').forEach(function (a) {
    a.onclick = function (e) { e.preventDefault(); navigate(a.getAttribute('data-page')); closeSidebar(); };
  });
  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('hamburgerBtn').onclick = function () {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlayBg').classList.toggle('show');
  };
  document.getElementById('overlayBg').onclick = closeSidebar;
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlayBg').classList.remove('show');
}

var PAGE_TITLES = {
  dashboard: 'Dashboard', agen: 'Agen', tasks: 'Task Tracker', activity: 'Activity Log',
  pi: 'Proforma Invoice', so: 'Sales Order Manager', gifts: 'Hadiah Agen', lookup: 'Agen Profile Lookup',
  setup: 'Setup', users: 'User Management'
};

function navigate(page) {
  STATE.page = page;
  document.getElementById('pageTitle').textContent = PAGE_TITLES[page] || page;
  document.querySelectorAll('.nav-link').forEach(function (a) {
    a.classList.toggle('active', a.getAttribute('data-page') === page);
  });
  var content = document.getElementById('content');
  content.innerHTML = '<div class="loading-spin"></div>';

  var renderers = {
    dashboard: renderDashboard, agen: function () { renderCrudPage(ENTITY_AGEN); },
    tasks: function () { renderCrudPage(ENTITY_TASKS); }, activity: function () { renderCrudPage(ENTITY_ACTIVITY); },
    pi: function () { renderCrudPage(ENTITY_PI); }, so: function () { renderCrudPage(ENTITY_SO); },
    gifts: function () { renderCrudPage(ENTITY_GIFTS); }, lookup: renderLookup,
    setup: renderSetup, users: renderUsers
  };
  (renderers[page] || renderDashboard)();
}

window.addEventListener('DOMContentLoaded', boot);

/* ===================================================================
   DASHBOARD PAGE
   =================================================================== */
function renderDashboard() {
  api('apiGetDashboard', STATE.token).then(function (d) {
    var c = document.getElementById('content');
    c.innerHTML =
      '<div class="kpi-grid">' +
        kpiCard(d.kpi.totalAgen, 'Total Agen') +
        kpiCard(d.kpi.activities7d, 'Activities Last 7 Days') +
        kpiCard(d.kpi.activities30d, 'Activities Last 30 Days') +
        kpiCard(d.kpi.piMade, 'PI Made') +
      '</div>' +
      '<div class="chart-grid">' +
        chartCard('c1', 'Top 5 Agen (Jumlah PI)') +
        chartCard('c2', 'Top 5 Agen (Nominal PI)') +
        chartCard('c3', 'Active Agent Status') +
        chartCard('c4', 'Top 5 Sales Order (Nominal)') +
        chartCard('c5', 'Status SO') +
        chartCard('c6', 'Task Status (Scheduled / Completed / Failed)') +
      '</div>' +
      '<div class="table-grid">' +
        recentTableCard('Recent Activity', ['Tanggal', 'Agen', 'Kontak', 'Metode', 'Notes'],
          d.recentActivity.map(function (r) { return [fmtDate(r.date), esc(r.agen), esc(r.contactPerson), esc(r.contactMethod), esc(truncate_(r.notes, 60))]; })) +
        recentTableCard('Upcoming Tasks', ['Due Date', 'Agen', 'Sisa Hari', 'Prioritas', 'Status'],
          d.upcomingTasks.map(function (r) { return [fmtDate(r.dueDate), esc(r.agen), r.daysUntilDue, esc(r.priority), badgeHtml(r.status)]; })) +
        recentTableCard('Recent Proforma Invoice', ['No. PI', 'Agen', 'Nominal', 'Tanggal', 'Status'],
          d.recentPI.map(function (r) { return [esc(r.nomorPI), esc(r.agen), fmtMoney(r.dealValue), fmtDate(r.piDate), badgeHtml(r.statusPI)]; })) +
        recentTableCard('Recent Sales Order', ['No. SO', 'Agen', 'Nominal', 'Due Date', 'Status'],
          d.recentSO.map(function (r) { return [esc(r.soNumber), esc(r.agen), fmtMoney(r.amount), fmtDate(r.dueDate), badgeHtml(r.displayStatus)]; })) +
      '</div>';

    drawBar('c1', d.top5ByCount.map(function (x) { return x.label; }), d.top5ByCount.map(function (x) { return x.value; }), '#c1622e');
    drawBar('c2', d.top5ByNominal.map(function (x) { return x.label; }), d.top5ByNominal.map(function (x) { return x.value; }), '#e2984f', true);
    drawDoughnut('c3', d.statusAgen.map(function (x) { return x.label; }), d.statusAgen.map(function (x) { return x.value; }));
    drawBar('c4', d.top5SO.map(function (x) { return x.label; }), d.top5SO.map(function (x) { return x.value; }), '#6f9463', true);
    drawDoughnut('c5', d.statusSO.map(function (x) { return x.label; }), d.statusSO.map(function (x) { return x.value; }));
    drawBar('c6', ['Scheduled', 'Completed', 'Failed'],
      [d.taskStatus.scheduled, d.taskStatus.completed, d.taskStatus.failed || 0],
      ['#8f461d', '#6f9463', '#c1503c']);
  }).catch(function (err) { toast(err.message, 'error'); });
}

function truncate_(s, n) { s = s || ''; return s.length > n ? s.slice(0, n) + '...' : s; }

function kpiCard(val, label) {
  return '<div class="kpi-card"><div class="val">' + esc(val) + '</div><div class="lbl">' + esc(label) + '</div></div>';
}
function chartCard(id, title) {
  return '<div class="card"><h3>' + esc(title) + '</h3><div class="chart-holder"><canvas id="' + id + '"></canvas></div></div>';
}
function recentTableCard(title, headers, rows) {
  var thead = '<tr>' + headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr>';
  var tbody = rows.length
    ? rows.map(function (r) { return '<tr>' + r.map(function (v) { return '<td>' + v + '</td>'; }).join('') + '</tr>'; }).join('')
    : '<tr><td colspan="' + headers.length + '" class="empty-state">Belum ada data</td></tr>';
  return '<div class="card"><h3>' + esc(title) + '</h3><table class="data-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table></div>';
}
function badgeHtml(val) {
  return '<span class="badge ' + badgeClass(val) + '">' + esc(val || '-') + '</span>';
}

var CHART_PALETTE = ['#c1622e', '#e2984f', '#f4b183', '#8f461d', '#6f9463', '#d99a3d', '#a3714f', '#c1503c'];

function destroyChart_(id) {
  if (STATE.charts[id]) { STATE.charts[id].destroy(); delete STATE.charts[id]; }
}
function drawBar(id, labels, data, color, currency) {
  destroyChart_(id);
  var ctx = document.getElementById(id);
  if (!ctx) return;
  if (!labels.length) { labels = ['Tidak ada data']; data = [0]; }
  STATE.charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels: labels, datasets: [{ data: data, backgroundColor: color, borderRadius: 6, maxBarThickness: 40 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return currency ? fmtMoney(c.raw) : c.raw; } } } },
      scales: { y: { beginAtZero: true, ticks: { callback: function (v) { return currency ? (v >= 1000000 ? (v / 1000000) + 'jt' : v) : v; } } },
                x: { ticks: { autoSkip: false, maxRotation: 40, minRotation: 0 } } }
    }
  });
}
function drawDoughnut(id, labels, data) {
  destroyChart_(id);
  var ctx = document.getElementById(id);
  if (!ctx) return;
  if (!labels.length) { labels = ['Tidak ada data']; data = [1]; }
  STATE.charts[id] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: labels, datasets: [{ data: data, backgroundColor: CHART_PALETTE, borderWidth: 2, borderColor: '#fff' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }
  });
}

/* ===================================================================
   GENERIC CRUD ENGINE
   Setiap entitas (Agen, Tasks, Activity, PI, SO, Gifts) dideskripsikan
   sebagai objek konfigurasi lalu dirender oleh renderCrudPage().
   =================================================================== */

function selOptions_(key) {
  var list = (STATE.formOptions && STATE.formOptions[key]) || [];
  if (key === 'agenOptions') {
    return list.map(function (o) { return { value: o.value, label: o.label }; });
  }
  return list.map(function (v) { return { value: v, label: v }; });
}

var ENTITY_AGEN = {
  key: 'agen', title: 'Data Agen', idField: '_row',
  listFn: 'apiListAgen', saveFn: 'apiSaveAgen', delFn: 'apiDeleteAgen',
  searchFields: ['namaAgen', 'contactPerson', 'phone', 'contactId'],
  columns: [
    { field: 'contactId', label: 'ID' }, { field: 'namaAgen', label: 'Nama Agen' },
    { field: 'contactPerson', label: 'Contact Person' }, { field: 'phone', label: 'Phone' },
    { field: 'status', label: 'Status', badge: true }, { field: 'pic', label: 'PIC' }
  ],
  fields: [
    { name: 'namaAgen', label: 'Nama Agen', type: 'text', required: true, full: true },
    { name: 'contactPerson', label: 'Contact Person', type: 'text', required: true },
    { name: 'jobTitle', label: 'Job Title', type: 'text' },
    { name: 'phone', label: 'Phone', type: 'text' },
    { name: 'status', label: 'Status', type: 'select', optionsKey: 'statusAgen' },
    { name: 'pic', label: 'PIC', type: 'select', optionsKey: 'pic' },
    { name: 'preferredContact', label: 'Preferred Contact Method', type: 'select', optionsKey: 'metodeKontak' },
    { name: 'locationPublic', label: 'Location For Public', type: 'textarea', full: true },
    { name: 'shippingAddress', label: 'Shipping Address', type: 'textarea', full: true },
    { name: 'expedisi', label: 'Nama & Alamat Ekspedisi (Luar Jawa)', type: 'textarea', full: true }
  ]
};

var ENTITY_TASKS = {
  key: 'tasks', title: 'Task Tracker', idField: '_row',
  listFn: 'apiListTasks', saveFn: 'apiSaveTask', delFn: 'apiDeleteTask',
  searchFields: ['agen', 'contactPerson', 'admin', 'status'],
  columns: [
    { field: 'agen', label: 'Agen' }, { field: 'dueDate', label: 'Due Date', fmt: 'date' },
    { field: 'daysUntilDue', label: 'Sisa Hari', daysUntil: true },
    { field: 'actualDate', label: 'Actual Date', fmt: 'date' },
    { field: 'priority', label: 'Prioritas' },
    { field: 'status', label: 'Status', badge: true }, { field: 'admin', label: 'Admin' }
  ],
  fields: [
    { name: 'contactPerson', label: 'Contact Agen', type: 'search-select', optionsKey: 'agenOptions', required: true, full: true },
    { name: 'dueDate', label: 'Due Date', type: 'date', required: true },
    { name: 'priority', label: 'Prioritas', type: 'select', optionsKey: 'priority' },
    { name: 'status', label: 'Status', type: 'select', optionsKey: 'taskStatus' },
    { name: 'admin', label: 'Admin', type: 'select', optionsKey: 'pic' },
    { name: 'kategori', label: 'Kategori', type: 'select', optionsKey: 'taskCategories' },
    { name: 'poin', label: 'Poin Untuk Disampaikan', type: 'textarea', full: true }
  ]
};

var ENTITY_ACTIVITY = {
  key: 'activity', title: 'Activity Log', idField: '_row',
  listFn: 'apiListActivity', saveFn: 'apiSaveActivity', delFn: 'apiDeleteActivity',
  searchFields: ['agen', 'contactPerson', 'admin', 'contactMethod'],
  columns: [
    { field: 'date', label: 'Tanggal', fmt: 'date' }, { field: 'agen', label: 'Agen' },
    { field: 'contactPerson', label: 'Contact Person' }, { field: 'contactMethod', label: 'Metode' },
    { field: 'admin', label: 'Admin' }, { field: 'clientStatus', label: 'Status', badge: true },
    { field: 'notes', label: 'Notes', truncate: true }
  ],
  fields: [
    { name: 'contactPerson', label: 'Contact Agen', type: 'search-select', optionsKey: 'agenOptions', required: true, full: true },
    { name: 'date', label: 'Tanggal', type: 'date', required: true },
    { name: 'admin', label: 'Admin', type: 'select', optionsKey: 'pic' },
    { name: 'contactMethod', label: 'Metode Kontak', type: 'select', optionsKey: 'metodeKontak' },
    { name: 'clientStatus', label: 'Status Klien', type: 'select', optionsKey: 'statusAgen' },
    { name: 'notes', label: 'Notes', type: 'textarea', full: true }
  ]
};

var ENTITY_PI = {
  key: 'pi', title: 'Proforma Invoice', idField: '_row',
  listFn: 'apiListPI', saveFn: 'apiSavePI', delFn: 'apiDeletePI',
  searchFields: ['nomorPI', 'agen', 'contactPerson', 'notes'],
  columns: [
    { field: 'nomorPI', label: 'No. PI' }, { field: 'agen', label: 'Agen' },
    { field: 'dealValue', label: 'Nominal', fmt: 'money' }, { field: 'piDate', label: 'Tanggal', fmt: 'date' },
    { field: 'statusPI', label: 'Status PI', badge: true }, { field: 'notes', label: 'Notes', truncate: true }
  ],
  fields: [
    { name: 'contactPerson', label: 'Contact Agen', type: 'search-select', optionsKey: 'agenOptions', required: true, full: true },
    { name: 'dealValue', label: 'Deal Value (Rp)', type: 'number', required: true },
    { name: 'piDate', label: 'PI Date', type: 'date', required: true },
    { name: 'salesRep', label: 'Admin', type: 'select', optionsKey: 'pic' },
    { name: 'notes', label: 'Notes', type: 'textarea', full: true }
  ]
};

var ENTITY_SO = {
  key: 'so', title: 'Sales Order Manager', idField: '_row',
  listFn: 'apiListSO', saveFn: 'apiSaveSO', delFn: 'apiDeleteSO',
  searchFields: ['soNumber', 'agen', 'contactPerson', 'linkedPI', 'notes'],
  customModalFn: openSOModal, // form SO punya logic cascading khusus, lihat openSOModal()
  columns: [
    { field: 'soNumber', label: 'No. SO' }, { field: 'agen', label: 'Agen' },
    { field: 'amount', label: 'Nominal', fmt: 'money' }, { field: 'dueDate', label: 'Due Date', fmt: 'date' },
    { field: 'daysUntilDue', label: 'Sisa Hari', daysUntil: true },
    { field: 'displayStatus', label: 'Status', badge: true },
    { field: 'notes', label: 'Notes', truncate: true }
  ]
};

var ENTITY_GIFTS = {
  key: 'gifts', title: 'Hadiah Agen', idField: '_row',
  listFn: 'apiListGifts', saveFn: 'apiSaveGift', delFn: 'apiDeleteGift',
  searchFields: ['recipient', 'clientCompany', 'description', 'salesRep'],
  columns: [
    { field: 'deliveryDate', label: 'Tanggal', fmt: 'date' }, { field: 'recipient', label: 'Penerima' },
    { field: 'clientCompany', label: 'Perusahaan' }, { field: 'description', label: 'Deskripsi' },
    { field: 'value', label: 'Value', fmt: 'money' }, { field: 'salesRep', label: 'Pengirim' }
  ],
  fields: [
    { name: 'recipient', label: 'Penerima (Agen)', type: 'search-select', optionsKey: 'agenOptions', required: true, full: true },
    { name: 'salesRep', label: 'Sales Rep (Pengirim)', type: 'select', optionsKey: 'pic' },
    { name: 'description', label: 'Deskripsi Hadiah', type: 'text', full: true },
    { name: 'value', label: 'Value (Rp)', type: 'number' },
    { name: 'deliveryDate', label: 'Delivery Date', type: 'date', required: true },
    { name: 'notes', label: 'Notes', type: 'textarea', full: true }
  ]
};

var CRUD_CACHE = {};

function renderCrudPage(entity) {
  api(entity.listFn, STATE.token).then(function (rows) {
    CRUD_CACHE[entity.key] = rows;
    paintCrudPage(entity, rows, '');
  }).catch(function (err) { toast(err.message, 'error'); });
}

function paintCrudPage(entity, rows, query) {
  var c = document.getElementById('content');
  var filtered = filterRows_(rows, entity.searchFields, query);

  var thead = '<tr>' + entity.columns.map(function (col) { return '<th>' + esc(col.label) + '</th>'; }).join('') + '<th></th></tr>';
  var tbody = filtered.length
    ? filtered.map(function (r) { return crudRowHtml_(entity, r); }).join('')
    : '<tr><td colspan="' + (entity.columns.length + 1) + '" class="empty-state">Tidak ada data yang cocok.</td></tr>';

  c.innerHTML =
    '<div class="page-header">' +
      '<h2>' + esc(entity.title) + ' <span style="color:var(--text-muted);font-weight:400;font-size:14px;">(' + filtered.length + ')</span></h2>' +
      '<div class="toolbar">' +
        '<input class="search-input" id="crudSearch" placeholder="Cari..." value="' + esc(query) + '">' +
        '<button class="btn" id="crudAddBtn">+ Tambah</button>' +
      '</div>' +
    '</div>' +
    '<div class="list-card"><table class="data-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table></div>';

  document.getElementById('crudSearch').oninput = function (e) { paintCrudPage(entity, rows, e.target.value); };
  document.getElementById('crudAddBtn').onclick = function () { (entity.customModalFn || openCrudModal)(entity, null); };

  c.querySelectorAll('[data-edit]').forEach(function (btn) {
    btn.onclick = function () {
      var row = rows.filter(function (r) { return String(r._row) === btn.getAttribute('data-edit'); })[0];
      (entity.customModalFn || openCrudModal)(entity, row);
    };
  });
  c.querySelectorAll('[data-del]').forEach(function (btn) {
    btn.onclick = function () {
      if (!confirm('Hapus data ini? Tindakan tidak bisa dibatalkan.')) return;
      api(entity.delFn, STATE.token, Number(btn.getAttribute('data-del'))).then(function () {
        toast('Data dihapus.', 'success');
        renderCrudPage(entity);
      }).catch(function (err) { toast(err.message, 'error'); });
    };
  });
  c.querySelectorAll('[data-recreate]').forEach(function (btn) {
    btn.onclick = function () {
      var row = rows.filter(function (r) { return String(r._row) === btn.getAttribute('data-recreate'); })[0];
      openRecreateTaskModal(row);
    };
  });
}

function filterRows_(rows, fields, query) {
  if (!query) return rows;
  var q = query.toLowerCase();
  return rows.filter(function (r) {
    return fields.some(function (f) { return String(r[f] || '').toLowerCase().indexOf(q) !== -1; });
  });
}

function daysUntilHtml_(n) {
  if (n === '' || n === undefined || n === null || isNaN(n)) return '-';
  n = Number(n);
  if (n < 0) return '<span style="color:var(--danger);font-weight:700;">' + Math.abs(n) + ' hari lewat</span>';
  if (n <= 3) return '<span style="color:var(--warning);font-weight:700;">' + n + ' hari lagi</span>';
  return n + ' hari lagi';
}

function crudRowHtml_(entity, r) {
  var cells = entity.columns.map(function (col) {
    var v = r[col.field];
    if (col.fmt === 'date') v = fmtDate(v);
    else if (col.fmt === 'money') v = fmtMoney(v);
    else if (col.badge) v = badgeHtml(v);
    else if (col.truncate) v = esc(truncate_(v, 50));
    else if (col.daysUntil) v = daysUntilHtml_(v);
    else v = esc(v);
    return '<td>' + v + '</td>';
  }).join('');
  var isOverdueTask = entity.key === 'tasks' && Number(r.daysUntilDue) < 0;
  var recreateBtn = isOverdueTask ? '<button class="btn sm" style="background:var(--warning);" data-recreate="' + r._row + '">Recreate</button>' : '';
  return '<tr>' + cells +
    '<td><div class="row-actions">' +
      recreateBtn +
      '<button class="btn secondary sm" data-edit="' + r._row + '">Edit</button>' +
      '<button class="btn danger sm" data-del="' + r._row + '">Hapus</button>' +
    '</div></td></tr>';
}

/**
 * Modal kecil untuk "Recreate" task yang overdue: task lama otomatis
 * ditandai Failed (tetap terhitung sebagai task gagal di Dashboard),
 * lalu task baru dibuat dengan data sama tapi Due Date baru.
 */
function openRecreateTaskModal(row) {
  var backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML =
    '<div class="modal" style="position:relative;max-width:420px;">' +
      '<button class="close-x" id="rcClose">&times;</button>' +
      '<h3>Recreate Task</h3>' +
      '<p style="font-size:13.5px;color:var(--text-muted);margin-top:-6px;">' +
        'Task lama (' + esc(row.agen) + ', jatuh tempo ' + fmtDate(row.dueDate) + ') akan ditandai <b>Failed</b> ' +
        'dan tetap terhitung di Dashboard. Task baru dengan data sama akan dibuat dengan Due Date baru.' +
      '</p>' +
      '<div class="field"><label>Due Date Baru *</label><input id="rc_dueDate" type="date"></div>' +
      '<div class="modal-actions">' +
        '<button class="btn secondary" id="rcCancel">Batal</button>' +
        '<button class="btn" id="rcSave">Recreate</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(backdrop);
  function close() { document.body.removeChild(backdrop); }
  document.getElementById('rcClose').onclick = close;
  document.getElementById('rcCancel').onclick = close;
  backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });

  document.getElementById('rcSave').onclick = function () {
    var newDueDate = document.getElementById('rc_dueDate').value;
    if (!newDueDate) { toast('Due Date baru wajib diisi.', 'error'); return; }
    api('apiRecreateTask', STATE.token, row._row, newDueDate).then(function () {
      toast('Task baru dibuat, task lama ditandai Failed.', 'success');
      close();
      renderCrudPage(ENTITY_TASKS);
    }).catch(function (err) { toast(err.message, 'error'); });
  };
}

function openCrudModal(entity, row) {
  var isEdit = !!row;
  var formHtml = entity.fields.map(function (f) { return fieldHtml_(f, row); }).join('');

  var backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML =
    '<div class="modal" style="position:relative;">' +
      '<button class="close-x" id="modalClose">&times;</button>' +
      '<h3>' + (isEdit ? 'Edit ' : 'Tambah ') + esc(entity.title) + '</h3>' +
      '<div class="form-grid">' + formHtml + '</div>' +
      '<div class="modal-actions">' +
        '<button class="btn secondary" id="modalCancel">Batal</button>' +
        '<button class="btn" id="modalSave">Simpan</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(backdrop);

  // Field bertipe 'search-select' (Contact Agen, dsb) butuh wiring supaya
  // bisa diketik/di-search, bukan cuma dropdown biasa.
  entity.fields.forEach(function (f) {
    if (f.type !== 'search-select') return;
    var opts = selOptions_(f.optionsKey);
    wireSearchCombo_('f_' + f.name, 'f_' + f.name + '_search', 'f_' + f.name + '_dd', function () { return opts; });
  });

  function close() { document.body.removeChild(backdrop); }
  document.getElementById('modalClose').onclick = close;
  document.getElementById('modalCancel').onclick = close;
  backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });

  document.getElementById('modalSave').onclick = function () {
    var payload = {};
    if (isEdit) payload._row = row._row;
    // carry through read-only auto fields so server can keep them on update
    if (entity.key === 'agen' && isEdit) payload.contactId = row.contactId;
    if (entity.key === 'pi' && isEdit) payload.nomorPI = row.nomorPI;
    if (entity.key === 'so' && isEdit) payload.soNumber = row.soNumber;

    var missing = [];
    entity.fields.forEach(function (f) {
      var el = document.getElementById('f_' + f.name);
      var val = el ? el.value : '';
      if (f.required && !val) missing.push(f.label);
      payload[f.name] = val;
    });
    if (missing.length) { toast('Wajib diisi: ' + missing.join(', '), 'error'); return; }

    api(entity.saveFn, STATE.token, payload).then(function () {
      toast('Data tersimpan.', 'success');
      close();
      renderCrudPage(entity);
    }).catch(function (err) { toast(err.message, 'error'); });
  };
}

function fieldHtml_(f, row) {
  var val = row ? (row[f.name] === undefined ? '' : row[f.name]) : '';
  var wrapClass = 'field' + (f.full ? ' full' : '');
  var inner = '';
  if (f.type === 'search-select') {
    var opts = selOptions_(f.optionsKey);
    var labelText = '';
    if (val) {
      var m = opts.filter(function (o) { return String(o.value) === String(val); })[0];
      labelText = m ? m.label : val;
    }
    inner = searchComboHtml_('f_' + f.name, 'f_' + f.name + '_search', 'f_' + f.name + '_dd', 'Ketik untuk mencari...', val, labelText);
  } else if (f.type === 'select') {
    var opts2 = selOptions_(f.optionsKey);
    inner = '<select id="f_' + f.name + '">' +
      '<option value="">-- pilih --</option>' +
      opts2.map(function (o) { return '<option value="' + esc(o.value) + '"' + (String(o.value) === String(val) ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') +
      '</select>';
  } else if (f.type === 'textarea') {
    inner = '<textarea id="f_' + f.name + '" rows="2">' + esc(val) + '</textarea>';
  } else {
    inner = '<input id="f_' + f.name + '" type="' + f.type + '" value="' + esc(val) + '">';
  }
  return '<div class="' + wrapClass + '"><label>' + esc(f.label) + (f.required ? ' *' : '') + '</label>' + inner + '</div>';
}

/* -------------------------------------------------------------------
   SEARCHABLE COMBOBOX — dipakai di semua field "Contact Agen" / "Linked
   Nomor PI": ketik untuk cari, klik hasil untuk pilih. Bukan cuma
   dropdown native <select> yang harus di-scroll.
   ------------------------------------------------------------------- */
function searchComboHtml_(hiddenId, searchId, ddId, placeholder, selectedValue, selectedLabel) {
  return '<div style="position:relative;">' +
    '<input type="text" id="' + searchId + '" autocomplete="off" placeholder="' + esc(placeholder) + '" value="' + esc(selectedLabel || '') + '">' +
    '<input type="hidden" id="' + hiddenId + '" value="' + esc(selectedValue || '') + '">' +
    '<div id="' + ddId + '" class="autocomplete-list"></div>' +
  '</div>';
}

/**
 * getOptionsFn() harus mengembalikan array {value, label, extra?} —
 * dipanggil ulang setiap kali dropdown dibuka/diketik, jadi bisa dinamis
 * (misal daftar PI yang berubah tergantung agen yang sedang dipilih).
 * onSelectFn(value, label, extra) dipanggil setelah user klik salah satu hasil.
 * Return: { setValue(value,label), refresh() } untuk dikontrol dari luar.
 */
function wireSearchCombo_(hiddenId, searchId, ddId, getOptionsFn, onSelectFn) {
  var search = document.getElementById(searchId);
  var hidden = document.getElementById(hiddenId);
  var dd = document.getElementById(ddId);

  function showMatches(q) {
    var opts = getOptionsFn() || [];
    q = (q || '').toLowerCase();
    var matches = opts.filter(function (o) { return String(o.label).toLowerCase().indexOf(q) !== -1; }).slice(0, 40);
    dd.innerHTML = matches.length
      ? matches.map(function (o) {
          return '<div class="autocomplete-item" data-value="' + esc(o.value) + '" data-label="' + esc(o.label) + '" data-extra="' + esc(o.extra === undefined ? '' : o.extra) + '">' + esc(o.label) + '</div>';
        }).join('')
      : '<div class="autocomplete-empty">Tidak ditemukan</div>';
    dd.style.display = 'block';
  }

  search.addEventListener('focus', function () { showMatches(search.value === hidden.getAttribute('data-label-cache') ? '' : search.value); });
  search.addEventListener('input', function () { hidden.value = ''; showMatches(search.value); });
  search.addEventListener('blur', function () { setTimeout(function () { dd.style.display = 'none'; }, 150); });
  dd.addEventListener('mousedown', function (e) {
    var item = e.target.closest('.autocomplete-item');
    if (!item) return;
    var value = item.getAttribute('data-value');
    var label = item.getAttribute('data-label');
    var extra = item.getAttribute('data-extra');
    hidden.value = value;
    search.value = label;
    hidden.setAttribute('data-label-cache', label);
    dd.style.display = 'none';
    if (onSelectFn) onSelectFn(value, label, extra);
  });

  return {
    setValue: function (value, label) {
      hidden.value = value || '';
      search.value = label || '';
      hidden.setAttribute('data-label-cache', label || '');
    }
  };
}

/* -------------------------------------------------------------------
   FORM SALES ORDER — custom (bukan pakai openCrudModal generik) karena
   ada dropdown yang saling tergantung:
   Contact Agen -> Linked Nomor PI (hanya punya agen itu & belum SO)
   Linked Nomor PI -> Amount (otomatis diisi nominal dari PI-nya)
   Keduanya pakai searchComboHtml_/wireSearchCombo_ (bisa diketik/di-search).
   ------------------------------------------------------------------- */
function soPiComboOptions_(contactPerson, keepNomorPI) {
  var piList = (STATE.formOptions && STATE.formOptions.piList) || [];
  return piList
    .filter(function (p) {
      if (p.contactPerson !== contactPerson) return false;
      if (p.status === 'Belum SO') return true;
      // saat edit, tetap tampilkan PI yang sedang dipakai SO ini sendiri
      return keepNomorPI && p.nomorPI === keepNomorPI;
    })
    .map(function (p) { return { value: p.nomorPI, label: p.nomorPI + ' — ' + fmtMoney(p.dealValue), extra: p.dealValue }; });
}

function openSOModal(entity, row) {
  var isEdit = !!row;
  var agenOpts = selOptions_('agenOptions');
  var statusOpts = selOptions_('statusTransaksi');
  var selectedContact = isEdit ? row.contactPerson : '';
  var selectedPI = isEdit ? row.linkedPI : '';
  var defaultTerms = isEdit ? row.terms : '30 Hari';

  var selectedContactLabel = '';
  if (selectedContact) {
    var m1 = agenOpts.filter(function (o) { return o.value === selectedContact; })[0];
    selectedContactLabel = m1 ? m1.label : selectedContact;
  }
  var selectedPILabel = '';
  if (selectedPI) {
    var m2 = soPiComboOptions_(selectedContact, selectedPI).filter(function (p) { return p.value === selectedPI; })[0];
    selectedPILabel = m2 ? m2.label : selectedPI;
  }

  var backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML =
    '<div class="modal" style="position:relative;">' +
      '<button class="close-x" id="soClose">&times;</button>' +
      '<h3>' + (isEdit ? 'Edit ' : 'Tambah ') + 'Sales Order</h3>' +
      '<div class="form-grid">' +
        '<div class="field full"><label>Contact Agen *</label>' +
          searchComboHtml_('so_contactPerson', 'so_contactPerson_search', 'so_contactPerson_dd', 'Ketik nama / kode agen untuk mencari...', selectedContact, selectedContactLabel) +
        '</div>' +
        '<div class="field full"><label>Linked Nomor PI</label>' +
          searchComboHtml_('so_linkedPI', 'so_linkedPI_search', 'so_linkedPI_dd', 'Ketik nomor PI untuk mencari...', selectedPI, selectedPILabel) +
          '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Pilih Contact Agen dulu. Hanya menampilkan PI milik agen ini yang berstatus "Belum SO".</div></div>' +
        '<div class="field"><label>Amount (Rp) *</label><input id="so_amount" type="number" value="' + esc(isEdit ? row.amount : '') + '"></div>' +
        '<div class="field"><label>Status SO</label><select id="so_status">' +
          statusOpts.map(function (o) { return '<option value="' + esc(o.value) + '"' + (isEdit && o.value === row.status ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') +
          '</select></div>' +
        '<div class="field"><label>Terms</label><input id="so_terms" value="' + esc(defaultTerms || '') + '"></div>' +
        '<div class="field"><label>SO Date</label><input id="so_soDate" type="date" value="' + esc(isEdit ? row.soDate : '') + '"></div>' +
        '<div class="field"><label>Due Date *</label><input id="so_dueDate" type="date" value="' + esc(isEdit ? row.dueDate : '') + '"></div>' +
        '<div class="field"><label>Payment Date</label><input id="so_paymentDate" type="date" value="' + esc(isEdit ? row.paymentDate : '') + '"></div>' +
        '<div class="field full"><label>Notes</label><textarea id="so_notes" rows="2">' + esc(isEdit ? row.notes : '') + '</textarea></div>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Kalau Payment Date diisi, Status otomatis jadi "Paid". Kalau Due Date sudah lewat, Status otomatis tampil "Overdue".</div>' +
      '<div class="modal-actions">' +
        '<button class="btn secondary" id="soCancel">Batal</button>' +
        '<button class="btn" id="soSave">Simpan</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(backdrop);

  function close() { document.body.removeChild(backdrop); }
  document.getElementById('soClose').onclick = close;
  document.getElementById('soCancel').onclick = close;
  backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });

  var currentContact = selectedContact;

  // Combo "Linked Nomor PI" - daftarnya dinamis, tergantung agen yang lagi dipilih
  var piCombo = wireSearchCombo_('so_linkedPI', 'so_linkedPI_search', 'so_linkedPI_dd',
    function () { return soPiComboOptions_(currentContact, isEdit && currentContact === row.contactPerson ? row.linkedPI : null); },
    function (value, label, extraDealValue) {
      // Pilih PI -> otomatis isi Amount dari nominal PI tsb (masih bisa diubah manual, misal split payment)
      if (extraDealValue) document.getElementById('so_amount').value = extraDealValue;
    });

  // Combo "Contact Agen" - pilih agen -> reset & refresh combo Linked PI
  wireSearchCombo_('so_contactPerson', 'so_contactPerson_search', 'so_contactPerson_dd',
    function () { return agenOpts; },
    function (value) {
      currentContact = value;
      if (!(isEdit && value === row.contactPerson)) piCombo.setValue('', '');
    });

  document.getElementById('soSave').onclick = function () {
    var payload = {
      _row: isEdit ? row._row : null,
      soNumber: isEdit ? row.soNumber : null,
      contactPerson: document.getElementById('so_contactPerson').value,
      linkedPI: document.getElementById('so_linkedPI').value,
      amount: document.getElementById('so_amount').value,
      status: document.getElementById('so_status').value,
      terms: document.getElementById('so_terms').value,
      soDate: document.getElementById('so_soDate').value,
      dueDate: document.getElementById('so_dueDate').value,
      paymentDate: document.getElementById('so_paymentDate').value,
      notes: document.getElementById('so_notes').value
    };
    if (!payload.contactPerson || !payload.amount || !payload.dueDate) {
      toast('Wajib diisi: Contact Agen (pilih dari daftar), Amount, Due Date', 'error'); return;
    }
    api('apiSaveSO', STATE.token, payload).then(function () {
      toast('Sales Order tersimpan.', 'success');
      close();
      // Refresh formOptions supaya status "Belum SO/Sudah SO" ikut update di form berikutnya
      api('apiGetFormOptions', STATE.token).then(function (opts) { STATE.formOptions = opts; });
      renderCrudPage(ENTITY_SO);
    }).catch(function (err) { toast(err.message, 'error'); });
  };
}

/* ===================================================================
   LOOKUP PAGE — profil 360 derajat agen
   =================================================================== */
function renderLookup() {
  var opts = selOptions_('agenOptions');
  var c = document.getElementById('content');
  c.innerHTML =
    '<div class="page-header"><h2>Agen Profile Lookup</h2></div>' +
    '<div class="card" style="margin-bottom:16px;max-width:480px;">' +
      '<div class="field"><label>Pilih PIC Agen (Contact Person)</label>' +
        '<select id="lookupSelect"><option value="">-- pilih agen --</option>' +
        opts.map(function (o) { return '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>'; }).join('') +
        '</select>' +
      '</div>' +
    '</div>' +
    '<div id="lookupResult"></div>';

  document.getElementById('lookupSelect').onchange = function (e) {
    var val = e.target.value;
    if (!val) { document.getElementById('lookupResult').innerHTML = ''; return; }
    document.getElementById('lookupResult').innerHTML = '<div class="loading-spin"></div>';
    api('apiLookupAgen', STATE.token, val).then(paintLookupResult).catch(function (err) { toast(err.message, 'error'); });
  };
}

function paintLookupResult(res) {
  var a = res.agen;
  var detailRows = [
    ['ID', a.contactId], ['Nama', a.contactPerson], ['Perusahaan', a.namaAgen], ['Jabatan', a.jobTitle],
    ['Phone', a.phone], ['Lokasi Publik', a.locationPublic], ['Alamat Pengiriman', a.shippingAddress],
    ['Status', badgeHtml(a.status)], ['PIC Kita', a.pic], ['Metode Kontak', a.preferredContact]
  ].map(function (kv) { return '<div class="contact-detail-row"><span class="k">' + esc(kv[0]) + '</span><span class="v">' + (kv[1] || '-') + '</span></div>'; }).join('');

  var activityRows = listOrEmpty_(res.activity, function (x) {
    return '<div class="contact-detail-row"><span class="k">' + fmtDate(x.date) + ' &middot; ' + esc(x.contactMethod) + '</span><span class="v">' + esc(truncate_(x.notes, 70)) + '</span></div>';
  });
  var piRows = listOrEmpty_(res.pi, function (x) {
    return '<div class="contact-detail-row"><span class="k">' + fmtDate(x.piDate) + ' &middot; ' + badgeHtml(x.statusPI) + '</span><span class="v">' + fmtMoney(x.dealValue) + '</span></div>';
  });
  var soRows = listOrEmpty_(res.so, function (x) {
    return '<div class="contact-detail-row"><span class="k">' + fmtDate(x.soDate) + ' &middot; ' + badgeHtml(x.status) + '</span><span class="v">' + fmtMoney(x.amount) + '</span></div>';
  });
  var giftRows = listOrEmpty_(res.gifts, function (x) {
    return '<div class="contact-detail-row"><span class="k">' + fmtDate(x.deliveryDate) + '</span><span class="v">' + esc(x.description) + '</span></div>';
  });

  document.getElementById('lookupResult').innerHTML =
    '<div class="lookup-grid">' +
      '<div class="card"><h3>Detail Kontak</h3>' + detailRows + '</div>' +
      '<div class="card"><h3>Recent Activity</h3>' + activityRows + '</div>' +
      '<div class="card"><h3>Recent Proforma Invoice</h3>' + piRows + '</div>' +
      '<div class="card"><h3>Recent Sales Order</h3>' + soRows + '</div>' +
      '<div class="card full" style="grid-column:1/-1;"><h3>Gifts</h3>' + giftRows + '</div>' +
    '</div>';
}
function listOrEmpty_(arr, mapFn) {
  return arr.length ? arr.map(mapFn).join('') : '<div class="empty-state">Belum ada data.</div>';
}

/* ===================================================================
   SETUP PAGE (Manager only) — kelola dropdown variables & nama perusahaan
   =================================================================== */
var SETUP_LIST_META = [
  { key: 'statusAgen', label: 'Status Agen' },
  { key: 'metodeKontak', label: 'Metode Kontak' },
  { key: 'pic', label: 'PIC' },
  { key: 'statusTransaksi', label: 'Status SO (Pending / Split Payment / dst — Paid & Overdue otomatis)' },
  { key: 'taskCategories', label: 'Task Categories' }
];

function renderSetup() {
  api('apiGetSetupLists', STATE.token).then(function (lists) {
    var c = document.getElementById('content');
    c.innerHTML =
      '<div class="page-header"><h2>Setup — Variabel Dropdown</h2></div>' +
      '<div class="card" style="max-width:480px;margin-bottom:16px;">' +
        '<div class="field"><label>Company Name</label>' +
          '<input id="companyNameInput" value="' + esc(lists.companyName) + '">' +
        '</div>' +
        '<button class="btn" id="saveCompanyBtn">Simpan Nama Perusahaan</button>' +
      '</div>' +
      '<div class="chart-grid" id="setupLists"></div>';

    document.getElementById('saveCompanyBtn').onclick = function () {
      api('apiSaveCompanyName', STATE.token, document.getElementById('companyNameInput').value)
        .then(function () { toast('Tersimpan.', 'success'); STATE.formOptions.companyName = document.getElementById('companyNameInput').value; })
        .catch(function (err) { toast(err.message, 'error'); });
    };

    var holder = document.getElementById('setupLists');
    SETUP_LIST_META.forEach(function (meta) {
      var items = (lists[meta.key] || []).filter(function (v) { return String(v).toLowerCase() !== 'all'; });
      var card = document.createElement('div');
      card.className = 'card';
      card.innerHTML =
        '<h3>' + esc(meta.label) + '</h3>' +
        '<div class="tag-editor" data-list="' + meta.key + '">' +
          items.map(function (it) { return tagPillHtml_(it); }).join('') +
        '</div>' +
        '<div class="tag-add-row"><input type="text" placeholder="Tambah item baru..." data-add-input="' + meta.key + '">' +
          '<button class="btn sm" data-add-btn="' + meta.key + '">Tambah</button></div>';
      holder.appendChild(card);
    });

    holder.querySelectorAll('[data-add-btn]').forEach(function (btn) {
      btn.onclick = function () { addSetupItem_(btn.getAttribute('data-add-btn')); };
    });
    holder.querySelectorAll('[data-add-input]').forEach(function (inp) {
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') addSetupItem_(inp.getAttribute('data-add-input')); });
    });
    bindTagRemovers_();
  }).catch(function (err) { toast(err.message, 'error'); });
}

function tagPillHtml_(text) {
  return '<span class="tag-pill">' + esc(text) + '<button data-remove="' + esc(text) + '">&times;</button></span>';
}

function bindTagRemovers_() {
  document.querySelectorAll('.tag-editor').forEach(function (editor) {
    var key = editor.getAttribute('data-list');
    editor.querySelectorAll('[data-remove]').forEach(function (btn) {
      btn.onclick = function () {
        var current = currentTagValues_(editor);
        var next = current.filter(function (v) { return v !== btn.getAttribute('data-remove'); });
        saveSetupList_(key, next);
      };
    });
  });
}

function currentTagValues_(editor) {
  return Array.prototype.map.call(editor.querySelectorAll('.tag-pill button'), function (b) { return b.getAttribute('data-remove'); });
}

function addSetupItem_(key) {
  var input = document.querySelector('[data-add-input="' + key + '"]');
  var val = input.value.trim();
  if (!val) return;
  var editor = document.querySelector('.tag-editor[data-list="' + key + '"]');
  var current = currentTagValues_(editor);
  if (current.indexOf(val) !== -1) { toast('Item sudah ada.', 'error'); return; }
  current.push(val);
  saveSetupList_(key, current);
}

function saveSetupList_(key, items) {
  api('apiSaveSetupList', STATE.token, key, items).then(function () {
    toast('Tersimpan.', 'success');
    api('apiGetFormOptions', STATE.token).then(function (opts) { STATE.formOptions = opts; });
    renderSetup();
  }).catch(function (err) { toast(err.message, 'error'); });
}

/* ===================================================================
   USERS PAGE (Manager only)
   =================================================================== */
function renderUsers() {
  api('apiListUsers', STATE.token).then(function (users) {
    var c = document.getElementById('content');
    var rows = users.map(function (u) {
      return '<tr><td>' + esc(u.username) + '</td><td>' + esc(u.fullName) + '</td><td>' + esc(u.role) + '</td>' +
        '<td>' + badgeHtml(u.status) + '</td>' +
        '<td><div class="row-actions">' +
          '<button class="btn secondary sm" data-user-edit="' + u._row + '">Edit</button>' +
          '<button class="btn danger sm" data-user-del="' + u._row + '">Hapus</button>' +
        '</div></td></tr>';
    }).join('') || '<tr><td colspan="5" class="empty-state">Belum ada user.</td></tr>';

    c.innerHTML =
      '<div class="page-header"><h2>User Management</h2>' +
        '<div class="toolbar"><button class="btn" id="addUserBtn">+ Tambah User</button></div>' +
      '</div>' +
      '<div class="list-card"><table class="data-table"><thead><tr><th>Username</th><th>Nama</th><th>Role</th><th>Status</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';

    document.getElementById('addUserBtn').onclick = function () { openUserModal(null); };
    c.querySelectorAll('[data-user-edit]').forEach(function (btn) {
      btn.onclick = function () {
        var u = users.filter(function (x) { return String(x._row) === btn.getAttribute('data-user-edit'); })[0];
        openUserModal(u);
      };
    });
    c.querySelectorAll('[data-user-del]').forEach(function (btn) {
      btn.onclick = function () {
        if (!confirm('Hapus user ini?')) return;
        api('apiDeleteUser', STATE.token, Number(btn.getAttribute('data-user-del')), STATE.user.username)
          .then(function () { toast('User dihapus.', 'success'); renderUsers(); })
          .catch(function (err) { toast(err.message, 'error'); });
      };
    });
  }).catch(function (err) { toast(err.message, 'error'); });
}

function openUserModal(user) {
  var isEdit = !!user;
  var backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML =
    '<div class="modal" style="position:relative;">' +
      '<button class="close-x" id="umClose">&times;</button>' +
      '<h3>' + (isEdit ? 'Edit User' : 'Tambah User') + '</h3>' +
      '<div class="form-grid">' +
        '<div class="field"><label>Username *</label><input id="um_username" value="' + esc(isEdit ? user.username : '') + '"' + (isEdit ? ' disabled' : '') + '></div>' +
        '<div class="field"><label>Nama Lengkap *</label><input id="um_fullName" value="' + esc(isEdit ? user.fullName : '') + '"></div>' +
        '<div class="field"><label>Role *</label><select id="um_role">' +
          '<option value="Manager"' + (isEdit && user.role === 'Manager' ? ' selected' : '') + '>Manager</option>' +
          '<option value="Staff"' + (isEdit && user.role === 'Staff' ? ' selected' : '') + '>Staff</option>' +
        '</select></div>' +
        '<div class="field"><label>Status</label><select id="um_status">' +
          '<option value="Active"' + (!isEdit || user.status === 'Active' ? ' selected' : '') + '>Active</option>' +
          '<option value="Inactive"' + (isEdit && user.status === 'Inactive' ? ' selected' : '') + '>Inactive</option>' +
        '</select></div>' +
        '<div class="field full"><label>Password' + (isEdit ? ' (kosongkan jika tidak diubah)' : ' *') + '</label><input id="um_password" type="password"></div>' +
      '</div>' +
      '<div class="modal-actions"><button class="btn secondary" id="umCancel">Batal</button><button class="btn" id="umSave">Simpan</button></div>' +
    '</div>';
  document.body.appendChild(backdrop);
  function close() { document.body.removeChild(backdrop); }
  document.getElementById('umClose').onclick = close;
  document.getElementById('umCancel').onclick = close;
  backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });

  document.getElementById('umSave').onclick = function () {
    var payload = {
      _row: isEdit ? user._row : null,
      username: isEdit ? user.username : document.getElementById('um_username').value.trim(),
      fullName: document.getElementById('um_fullName').value.trim(),
      role: document.getElementById('um_role').value,
      status: document.getElementById('um_status').value,
      password: document.getElementById('um_password').value
    };
    if (!payload.username || !payload.fullName) { toast('Username & Nama wajib diisi.', 'error'); return; }
    api('apiSaveUser', STATE.token, payload).then(function () {
      toast('User tersimpan.', 'success'); close(); renderUsers();
    }).catch(function (err) { toast(err.message, 'error'); });
  };
}