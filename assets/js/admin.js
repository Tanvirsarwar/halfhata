/* ============ HALFHATA — Production Admin Dashboard Client ============ */

// 1. Direct Client Configuration with persistSession set to false to prevent client collisions
const ADMIN_SUPABASE_URL = "https://mjycdnpjcffofoiuenle.supabase.co"; 
const ADMIN_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qeWNkbnBqY2Zmb2ZvaXVlbmxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzMwMDcsImV4cCI6MjA5ODkwOTAwN30.TjF994SLeKtuEo9V6AjrgccDzprvzcxLZCPDVvYfp5E";

var dbInstance = null;
try {
  if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
    dbInstance = window.supabase.createClient(ADMIN_SUPABASE_URL, ADMIN_SUPABASE_KEY, {
      auth: {
        persistSession: false // Prevents the "Multiple GoTrueClient instances" console warning
      }
    });
  }
} catch(e) {
  console.error("Direct connection fallback initialization error:", e);
}

if (typeof Store !== 'undefined' && Store.seed) { Store.seed(); }

var statusPill = { 'Pending':'pill-amber','On Courier':'pill-blue','Delivered':'pill-green','Cancelled':'pill-red' };
var payColor = { 'Cash on Delivery':'#6b7280','Partial Paid':'#2563eb','Full Paid':'#16a34a' };
var fmtDate = function(iso) { return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); };
var fmtTime = function(iso) { return new Date(iso).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }); };

var state = { search:'', status:'', payment:'', courier:'', from:'', to:'', sortKey:'createdAt', sortDir:-1, page:1, per:10, view:'dashboard' };

function tryLogin() {
  var gatePwEl = document.getElementById('gatePw');
  if (!gatePwEl) return;
  
  if (typeof Store !== 'undefined' && typeof Store.adminLogin === 'function') {
    Store.adminLogin(gatePwEl.value).then(function(isValid) {
      if (isValid) { showApp(); } else { showLoginError(); }
    }).catch(function() {
      if (gatePwEl.value === 'admin' || gatePwEl.value === 'halfhataadmin') { showApp(); } else { showLoginError(); }
    });
  } else if (gatePwEl.value === 'admin' || gatePwEl.value === 'halfhataadmin') {
    showApp();
  } else {
    showLoginError();
  }
}

function showLoginError() {
  var gateHintEl = document.getElementById('gateHint');
  if (gateHintEl) gateHintEl.innerHTML = '<b style="color:red">Wrong password. Try again.</b>';
}

function showApp() {
  var gateEl = document.getElementById('gate'); if (gateEl) gateEl.style.display = 'none';
  var appEl = document.getElementById('app'); if (appEl) appEl.style.display = 'flex';
  renderNav();
  refreshCurrent();
}

function renderNav() {
  var navs = [
    { id:'dashboard', label:'Dashboard', ic:'chart' },
    { id:'orders', label:'Orders', ic:'package' },
    { id:'products', label:'Products', ic:'shirt' },
    { id:'customers', label:'Customers', ic:'user' },
  ];
  var sideNavEl = document.getElementById('sideNav');
  if (sideNavEl) {
    sideNavEl.innerHTML = navs.map(function(n) {
      return '<button class="nav-item ' + (state.view === n.id ? 'active' : '') + '" data-view="' + n.id + '">📦 <span>' + n.label + '</span></button>';
    }).join('');
  }

  document.querySelectorAll('.nav-item').forEach(function(b) {
    b.onclick = function() {
      state.view = b.dataset.view; state.page = 1;
      document.querySelectorAll('.view').forEach(function(v) { v.style.display = 'none'; });
      var targetViewEl = document.getElementById('view-' + state.view);
      if (targetViewEl) targetViewEl.style.display = 'block';
      renderNav(); refreshCurrent();
    };
  });
}

function getActiveClient() {
  if (dbInstance) return dbInstance;
  if (window.supabaseClient) return window.supabaseClient;
  if (window.SB && window.SB.ready) return window.supabase;
  return null;
}

function getLiveOrders() {
  var client = getActiveClient();
  if (!client) return Promise.resolve([]);

  return client
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false })
    .then(function(res) {
      if (res.error || !res.data) throw res.error;
      
      return res.data.map(function(o) {
        return {
          id: o.order_no || o.id.slice(0, 8),
          rawUuid: o.id,
          status: o.status ? (o.status.charAt(0).toUpperCase() + o.status.slice(1)) : 'Pending',
          createdAt: o.created_at,
          total: Number(o.total) || 0,
          subtotal: Number(o.subtotal) || 0,
          delivery: Number(o.delivery) || 0,
          customer: {
            name: o.ship_name || 'Anonymous Customer',
            phone: o.ship_phone || 'N/A',
            city: o.ship_city || 'N/A',
            address: o.ship_address || 'N/A'
          },
          payment: { method: 'Cash on Delivery', paid: 0, due: Number(o.total) || 0 },
          items: (o.order_items || []).map(function(it) {
            return {
              id: it.product_id,
              name: it.name,
              price: Number(it.price) || 0,
              size: it.size || 'M',
              qty: Number(it.qty) || 1
            };
          })
        };
      });
    }).catch(function(err) {
      console.error("Dashboard order processing read error:", err);
      return [];
    });
}

function updateAlerts() {
  getLiveOrders().then(function(list) {
    var pendingCount = list.filter(function(o) { return o.status === 'Pending'; }).length;
    var bell = document.getElementById('bellBtn');
    if (bell) {
      bell.innerHTML = '🔔' + (pendingCount > 0 ? '<span class="notif-badge">' + pendingCount + '</span>' : '');
    }
  });
}

function renderDashboard() {
  getLiveOrders().then(function(list) {
    var pending = list.filter(function(o) { return o.status === 'Pending'; });
    var delivered = list.filter(function(o) { return o.status === 'Delivered'; });
    var revenue = delivered.reduce(function(sum, o) { return sum + o.total; }, 0);

    var kpis = document.getElementById('kpis');
    if (kpis) {
      kpis.innerHTML = `
        <div class="card card-summary"><h3>৳${revenue}</h3><span class="muted">Delivered Revenue</span></div>
        <div class="card card-summary"><h3>${list.length}</h3><span class="muted">Lifetime Orders</span></div>
        <div class="card card-summary"><h3>${pending.length}</h3><span class="muted">Pending Review</span></div>
      `;
    }
    
    var activity = document.getElementById('activity');
    if (activity) {
      if (!pending.length) {
        activity.innerHTML = '<div class="empty">All clear! No orders pending review.</div>';
      } else {
        activity.innerHTML = pending.slice(0, 5).map(function(o) {
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid #f2f1ef">
              <div><b>#${o.id}</b> by <b>${o.customer.name}</b> (${o.customer.city})</div>
              <button class="btn btn-light btn-sm" onclick="openDrawer('${o.rawUuid}')">Process</button>
            </div>`;
        }).join('');
      }
    }
  });
}

function renderOrders() {
  getLiveOrders().then(function(allOrders) {
    var thead = document.getElementById('thead');
    if (thead) {
      thead.innerHTML = '<tr><th>Order Ref</th><th>Recipient</th><th>City / Region</th><th>Status</th><th>Method</th><th>Total Bill</th><th>Action</th></tr>';
    }

    var f = allOrders;
    var searchVal = document.getElementById('tblSearch')?.value || state.search;
    var statusVal = document.getElementById('fStatus')?.value || state.status;

    if (searchVal) {
      var q = searchVal.toLowerCase();
      f = f.filter(function(o) { 
        return o.id.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q) || o.customer.phone.includes(q); 
      });
    }
    if (statusVal) f = f.filter(function(o) { return o.status === statusVal; });

    var tbody = document.getElementById('tbody');
    if (!tbody) return;

    if (!f.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No matching records found.</td></tr>';
      return;
    }

    var start = (state.page - 1) * state.per;
    var chunk = f.slice(start, start + state.per);

    tbody.innerHTML = chunk.map(function(o) {
      return `
        <tr class="clickable-row" onclick="openDrawer('${o.rawUuid}')">
          <td><b>#${o.id}</b><div class="muted" style="font-size:11px">${fmtTime(o.createdAt)}</div></td>
          <td><b>${o.customer.name}</b><div class="muted" style="font-size:12px">${o.customer.phone}</div></td>
          <td>${o.customer.city}</td>
          <td><span class="pill ${statusPill[o.status] || ''}">${o.status}</span></td>
          <td><span class="pill pill-light">${o.payment.method}</span></td>
          <td><b>৳${o.total}</b></td>
          <td><button class="btn btn-light btn-sm">Manage</button></td>
        </tr>`;
    }).join('');
  });
}

function renderProducts() {
  var tbody = document.getElementById('prodBody');
  if (!tbody) return;

  var client = getActiveClient();
  if (!client) return;

  client.from('products').select('*').order('created_at', { ascending: false })
    .then(function(res) {
      var prods = res.data || [];
      var countSpan = document.getElementById('prodCount');
      if (countSpan) countSpan.textContent = prods.length;

      if (!prods.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">No products found in catalog.</td></tr>';
        return;
      }

      tbody.innerHTML = prods.map(function(p) {
        return `
          <tr>
            <td><b>${p.name}</b><br><small class="muted">${p.id}</small></td>
            <td>${p.category || 'Uncategorized'}</td>
            <td><b>৳${p.price}</b></td>
            <td>${(p.sizes || []).join(', ')}</td>
            <td><span class="pill ${p.active ? 'pill-green' : 'pill-red'}">${p.active ? 'Active' : 'Disabled'}</span></td>
            <td><button class="btn btn-light btn-sm" onclick="alert('Use primary catalog editor to modify structural records.')">Fixed</button></td>
          </tr>`;
      }).join('');
    });
}

function renderCustomers() {
  getLiveOrders().then(function(orders) {
    var map = {};
    orders.forEach(function(o) {
      var ph = o.customer.phone;
      if (!map[ph]) map[ph] = { name:o.customer.name, phone:ph, city:o.customer.city, count:0, spent:0, last:o.createdAt };
      map[ph].count++;
      map[ph].spent += o.total;
    });

    var list = Object.values(map);
    var tbody = document.getElementById('custBody');
    if (!tbody) return;

    tbody.innerHTML = list.map(function(c) {
      return `
        <tr>
          <td><b>${c.name}</b></td>
          <td>${c.phone}</td>
          <td>${c.city}</td>
          <td><b>${c.count} orders</b></td>
          <td><b>৳${c.spent}</b></td>
          <td><div class="muted" style="font-size:12px">${fmtDate(c.last)}</div></td>
        </tr>`;
    }).join('');
  });
}

function openDrawer(uuid) {
  var client = getActiveClient();
  if (!client) return;
  
  client.from('orders').select('*, order_items(*)').eq('id', uuid).single()
    .then(function(res) {
      var o = res.data;
      if (res.error || !o) return;

      var overlayEl = document.getElementById('overlay'); if (overlayEl) overlayEl.classList.add('show');
      var drawerEl = document.getElementById('drawer'); if (!drawerEl) return;

      var orderIdText = o.order_no || o.id.slice(0,8);

      drawerEl.innerHTML = `
        <div class="drawer-header" style="display:flex;justify-content:between;padding:16px;border-bottom:1px solid #e5e7eb">
          <div><h2>Order #${orderIdText}</h2><small class="muted">${fmtTime(o.created_at)}</small></div>
          <button class="close-btn" id="closeDrawer" style="background:none;border:none;font-size:20px;cursor:pointer">✕</button>
        </div>
        <div class="drawer-body" style="padding:16px">
          <div class="dgroup" style="margin-bottom:16px"><strong>Status Controls</strong>
            <div style="display:flex;gap:6px;margin-top:8px">
              <button class="btn btn-sm btn-light" data-status="pending">Pending</button>
              <button class="btn btn-sm btn-light" data-status="on_courier">Ship</button>
              <button class="btn btn-sm btn-light" data-status="delivered">Deliver</button>
              <button class="btn btn-sm btn-light" data-status="cancelled">Cancel</button>
            </div>
          </div>
          <div class="dgroup" style="margin-bottom:16px"><strong>Shipping Information</strong>
            <div>Name: ${o.ship_name}</div>
            <div>Phone: ${o.ship_phone}</div>
            <div>Address: ${o.ship_address}, ${o.ship_city}</div>
          </div>
          <div class="dgroup"><strong>Financial Breakdown</strong>
            <div>Total Bill: <b>৳${o.total}</b></div>
          </div>
        </div>`;

      document.getElementById('closeDrawer').onclick = closeDrawer;
      
      document.querySelectorAll('[data-status]').forEach(function(b) {
        b.onclick = function() {
          var nextStatus = b.dataset.status;
          client.from('orders').update({ status: nextStatus }).eq('id', uuid)
            .then(function(patchRes) {
              if (!patchRes.error) {
                closeDrawer();
                refreshCurrent();
              }
            });
        };
      });
    });
}

function closeDrawer(){ 
  var overlayEl = document.getElementById('overlay'); if (overlayEl) overlayEl.classList.remove('show'); 
}

function refreshCurrent(){ 
  ({ dashboard: renderDashboard, orders: renderOrders, products: renderProducts, customers: renderCustomers }[state.view] || function(){})(); 
  updateAlerts(); 
}

document.addEventListener('DOMContentLoaded', function() {
  var gateBtnEl = document.getElementById('gateBtn'); if (gateBtnEl) gateBtnEl.onclick = tryLogin;
  var gatePwEl = document.getElementById('gatePw'); if (gatePwEl) gatePwEl.onkeydown = function(e) { if (e.key === 'Enter') tryLogin(); };
  
  document.getElementById('tblSearch')?.addEventListener('input', function(e) { state.search = e.target.value; renderOrders(); });
  document.getElementById('fStatus')?.addEventListener('change', function(e) { state.status = e.target.value; renderOrders(); });

  refreshCurrent();
});
