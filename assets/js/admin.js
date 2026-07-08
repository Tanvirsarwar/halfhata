/* ============ Admin Panel (Universal Fail-Safe Version) ============ */

// 1. FILL IN YOUR ACTUAL SUPABASE CREDENTIALS HERE:
const ADMIN_SUPABASE_URL = "https://mjycdnpjcffofoiuenle.supabase.co"; 
const ADMIN_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qeWNkbnBqY2Zmb2ZvaXVlbmxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzMwMDcsImV4cCI6MjA5ODkwOTAwN30.TjF994SLeKtuEo9V6AjrgccDzprvzcxLZCPDVvYfp5E";

var dbInstance = null;
try {
  if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
    dbInstance = window.supabase.createClient(ADMIN_SUPABASE_URL, ADMIN_SUPABASE_KEY);
  }
} catch(e) {
  console.error("Direct connection error:", e);
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
      if (gatePwEl.value === 'admin') { showApp(); } else { showLoginError(); }
    });
  } else if (gatePwEl.value === 'admin') {
    showApp();
  } else {
    showLoginError();
  }
}

function showLoginError() {
  var gateHintEl = document.getElementById('gateHint');
  if (gateHintEl) gateHintEl.innerHTML = '<b style="color:var(--red)">Wrong password. Try again.</b>';
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
      return '<button class="nav-item ' + (state.view === n.id ? 'active' : '') + '" data-view="' + n.id + '">' +
        (typeof ic === 'function' ? ic(n.ic, 18) : '📦') + ' <span>' + n.label + '</span>' +
      '</button>';
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
  if (window.supabase) return window.supabase;
  if (typeof sb !== 'undefined') return sb;
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
          id: o.order_no || o.id,
          rawUuid: o.id,
          status: o.status ? (o.status.charAt(0).toUpperCase() + o.status.slice(1)) : 'Pending',
          createdAt: o.created_at,
          total: Number(o.total) || 0,
          subtotal: Number(o.subtotal) || 0,
          delivery: Number(o.delivery) || 80,
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
      console.error("Live fetch failed:", err);
      return [];
    });
}

function updateAlerts() {
  getLiveOrders().then(function(list) {
    var pendingCount = list.filter(function(o) { return o.status === 'Pending'; }).length;
    var bell = document.getElementById('bellBtn');
    if (bell && typeof ic === 'function') {
      bell.innerHTML = ic('bell', 20) + (pendingCount > 0 ? '<span class="notif-badge">' + pendingCount + '</span>' : '');
    }
  });
}

function renderDashboard() {
  getLiveOrders().then(function(list) {
    var pending = list.filter(function(o) { return o.status === 'Pending'; });
    var delivered = list.filter(function(o) { return o.status === 'Delivered'; });
    var revenue = delivered.reduce(function(sum, o) { return sum + o.total; }, 0);

    var sideContactEl = document.getElementById('sideContact');
    if (sideContactEl && typeof HH !== 'undefined') {
      sideContactEl.innerHTML = '<div class="muted">Phone: ' + (HH.phone || '') + '<br>Email: ' + (HH.email || '') + '</div>';
    }

    var kpis = document.getElementById('kpis');
    if (kpis && typeof money === 'function') {
      kpis.innerHTML = `
        <div class="card card-summary"><h3>${money(revenue)}</h3><span class="muted">Delivered Revenue</span></div>
        <div class="card card-summary"><h3>${list.length}</h3><span class="muted">Lifetime Orders</span></div>
        <div class="card card-summary"><h3>${pending.length}</h3><span class="muted">Pending Review</span></div>
      `;
    }
    
    var revTotal = document.getElementById('revTotal');
    if (revTotal && typeof money === 'function') revTotal.textContent = 'Total: ' + money(revenue);
    
    var activity = document.getElementById('activity');
    if (activity) {
      if (!pending.length) {
        activity.innerHTML = '<div class="empty">All clear! No orders pending review.</div>';
      } else {
        activity.innerHTML = pending.slice(0, 5).map(function(o) {
          var safeId = typeof esc === 'function' ? esc(o.id) : o.id;
          var safeName = typeof esc === 'function' ? esc(o.customer.name) : o.customer.name;
          var safeCity = typeof esc === 'function' ? esc(o.customer.city) : o.customer.city;
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid #f2f1ef">
              <div><b>#${safeId}</b> by <b>${safeName}</b> (${safeCity})</div>
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
    var paymentVal = document.getElementById('fPayment')?.value || state.payment;

    if (searchVal) {
      var q = searchVal.toLowerCase();
      f = f.filter(function(o) { 
        return o.id.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q) || o.customer.phone.includes(q); 
      });
    }
    if (statusVal) f = f.filter(function(o) { return o.status === statusVal; });
    if (paymentVal) f = f.filter(function(o) { return o.payment.method === paymentVal; });

    var stats = document.getElementById('stats');
    if (stats) stats.innerHTML = '<div class="crumb">' + f.length + ' orders match filter criteria</div>';

    var totalPages = Math.ceil(f.length / state.per) || 1;
    state.page = Math.max(1, Math.min(state.page, totalPages));
    var start = (state.page - 1) * state.per;
    var chunk = f.slice(start, start + state.per);

    var tbody = document.getElementById('tbody');
    if (!tbody) return;

    if (!chunk.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No matching records found.</td></tr>';
      var pagerEl = document.getElementById('pager'); if (pagerEl) pagerEl.innerHTML = '';
      return;
    }

    tbody.innerHTML = chunk.map(function(o) {
      var safeId = typeof esc === 'function' ? esc(o.id) : o.id;
      var safeName = typeof esc === 'function' ? esc(o.customer.name) : o.customer.name;
      var safePhone = typeof esc === 'function' ? esc(o.customer.phone) : o.customer.phone;
      var safeCity = typeof esc === 'function' ? esc(o.customer.city) : o.customer.city;
      var safeTotal = typeof money === 'function' ? money(o.total) : o.total;
      return `
        <tr class="clickable-row" onclick="openDrawer('${o.rawUuid}')">
          <td><b>#${safeId}</b><div class="muted" style="font-size:11px">${fmtTime(o.createdAt)}</div></td>
          <td><b>${safeName}</b><div class="muted" style="font-size:12px">${safePhone}</div></td>
          <td>${safeCity}</td>
          <td><span class="pill ${statusPill[o.status] || ''}">${o.status}</span></td>
          <td><span class="pill pill-light" style="color:${payColor[o.payment.method] || '#333'}">${o.payment.method}</span></td>
          <td><b>${safeTotal}</b></td>
          <td><button class="btn btn-light btn-sm">Manage</button></td>
        </tr>`;
    }).join('');

    var pager = document.getElementById('pager');
    if (pager) {
      pager.innerHTML = `
        <button class="btn btn-light btn-sm" ${state.page===1?'disabled':''} id="prevPageBtn">Previous</button>
        <span class="muted">Page ${state.page} of ${totalPages}</span>
        <button class="btn btn-light btn-sm" ${state.page===totalPages?'disabled':''} id="nextPageBtn">Next</button>`;
        
      var pBtn = document.getElementById('prevPageBtn'); if (pBtn) pBtn.onclick = function() { state.page--; renderOrders(); };
      var nBtn = document.getElementById('nextPageBtn'); if (nBtn) nBtn.onclick = function() { state.page++; renderOrders(); };
    }
  });
}

function renderProducts() {
  if (typeof Store === 'undefined') return;
  var prods = typeof Store.getProducts === 'function' ? Store.getProducts() : [];
  var tbody = document.getElementById('prodBody');
  var countSpan = document.getElementById('prodCount');
  
  if (countSpan) countSpan.textContent = prods.length;
  if (!tbody) return;

  if (!prods.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No products found in catalog.</td></tr>';
    return;
  }

  tbody.innerHTML = prods.map(function(p) {
    var safeName = typeof esc === 'function' ? esc(p.name) : p.name;
    var safeId = typeof esc === 'function' ? esc(p.id) : p.id;
    var safeCategory = typeof esc === 'function' ? esc(p.category || '—') : (p.category || '—');
    var safePrice = typeof money === 'function' ? money(p.price) : p.price;
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:34px;height:34px;background:#f5f4f2;border-radius:4px;overflow:hidden">${typeof productMedia === 'function' ? productMedia(p, '100%') : ''}</div>
            <div><b>${safeName}</b><br><small class="muted">${safeId}</small></div>
          </div>
        </td>
        <td>${safeCategory}</td>
        <td><b>${safePrice}</b></td>
        <td>0</td>
        <td>৳0</td>
        <td><span class="pill ${p.active ? 'pill-green' : 'pill-red'}">${p.active ? 'Active' : 'Disabled'}</span></td>
        <td><button class="btn btn-light btn-sm" onclick="alert('Product features loaded')">Edit</button></td>
      </tr>`;
  }).join('');
}

function renderCustomers() {
  getLiveOrders().then(function(orders) {
    var map = {};
    orders.forEach(function(o) {
      var ph = o.customer.phone;
      if (!map[ph]) map[ph] = { name:o.customer.name, phone:ph, city:o.customer.city, count:0, spent:0, last:o.createdAt };
      map[ph].count++;
      map[ph].spent += o.total;
      if (new Date(o.createdAt) > new Date(map[ph].last)) map[ph].last = o.createdAt;
    });

    var list = Object.values(map);
    var countSpan = document.getElementById('custCount');
    if (countSpan) countSpan.textContent = list.length;

    var tbody = document.getElementById('custBody');
    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No records found.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(function(c) {
      var safeName = typeof esc === 'function' ? esc(c.name) : c.name;
      var safePhone = typeof esc === 'function' ? esc(c.phone) : c.phone;
      var safeCity = typeof esc === 'function' ? esc(c.city) : c.city;
      var safeSpent = typeof money === 'function' ? money(c.spent) : c.spent;
      return `
        <tr>
          <td><b>${safeName}</b></td>
          <td>${safePhone}</td>
          <td>${safeCity}</td>
          <td><b>${c.count} orders</b></td>
          <td><b>${safeSpent}</b></td>
          <td><b>${safeSpent}</b></td>
          <td><div class="muted" style="font-size:12px">${fmtDate(c.last)}</div></td>
        </tr>`;
    }).join('');
  });
}

function openDrawer(uuid) {
  var client = getActiveClient();
  if (!client) return;
  
  client
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', uuid)
    .single()
    .then(function(res) {
      var o = res.data;
      if (res.error || !o) return;

      var overlayEl = document.getElementById('overlay'); if (overlayEl) overlayEl.classList.add('show');
      var drawerEl = document.getElementById('drawer'); if (!drawerEl) return;

      var orderIdText = o.order_no || o.id.slice(0,8);
      var safeEsc = function(val) { return typeof esc === 'function' ? esc(val) : val; };
      var safeMoney = function(val) { return typeof money === 'function' ? money(val) : val; };

      drawerEl.innerHTML = `
        <div class="drawer-header">
          <div><h2>Order #${safeEsc(orderIdText)}</h2><small class="muted">${fmtTime(o.created_at)}</small></div>
          <button class="close-btn" id="closeDrawer">✕</button>
        </div>
        <div class="drawer-body">
          <div class="dgroup"><div class="t">Status Controls</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
              <button class="btn btn-sm btn-light" data-status="pending" style="border-left:4px solid #b7791f">Pending</button>
              <button class="btn btn-sm btn-light" data-status="confirmed" style="border-left:4px solid #2563eb">Confirm</button>
              <button class="btn btn-sm btn-light" data-status="on_courier" style="border-left:4px solid #16a34a">Ship</button>
              <button class="btn btn-sm btn-light" data-status="cancelled" style="border-left:4px solid #dc2626">Cancel</button>
            </div>
          </div>
          <div class="dgroup"><div class="t">Shipping Parameters</div>
            <div class="kv"><span>Recipient</span><b>${safeEsc(o.ship_name)}</b></div>
            <div class="kv"><span>Contact</span><b>${safeEsc(o.ship_phone)}</b></div>
            <div class="kv"><span>Destination</span><b>${safeEsc(o.ship_address)}, ${safeEsc(o.ship_city)}</b></div>
          </div>
          <div class="dgroup"><div class="t">Line Items</div>
            <div class="drawer-items">${(o.order_items || []).map(function(it) {
              return `
                <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid #f2f1ef">
                  <div style="flex:1"><b>${safeEsc(it.name)}</b> <span class="muted">x${it.qty}</span><br><small class="muted">Size: ${safeEsc(it.size || 'M')}</small></div>
                  <b>${safeMoney(it.price * it.qty)}</b>
                </div>`;
            }).join('')}</div>
          </div>
          <div class="dgroup"><div class="t">Billing Metrics</div>
            <div class="kv"><span>Subtotal</span><b>${safeMoney(o.subtotal)}</b></div>
            <div class="kv"><span>Delivery</span><b>${safeMoney(o.delivery)}</b></div>
            <div class="kv"><span>Total Bill</span><b>${safeMoney(o.total)}</b></div>
          </div>
        </div>`;

      var cBtn = document.getElementById('closeDrawer'); if (cBtn) cBtn.onclick = closeDrawer;
      
      document.querySelectorAll('[data-status]').forEach(function(b) {
        b.onclick = function() {
          var nextStatus = b.dataset.status;
          client
            .from('orders')
            .update({ status: nextStatus })
            .eq('id', uuid)
            .then(function(patchRes) {
              if (!patchRes.error) {
                if (typeof toast === 'function') toast('Status updated → ' + nextStatus);
                refreshCurrent();
                openDrawer(uuid);
              } else {
                alert("Update failed: " + patchRes.error.message);
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

/* EVENT ELEMENT LISTENERS */
document.getElementById('globalSearch')?.addEventListener('input', function(e) { state.search = e.target.value; state.page = 1; refreshCurrent(); });
document.getElementById('tblSearch')?.addEventListener('input', function(e) { state.search = e.target.value; state.page = 1; renderOrders(); });
document.getElementById('fStatus')?.addEventListener('change', function(e) { state.status = e.target.value; state.page = 1; renderOrders(); });
document.getElementById('fPayment')?.addEventListener('change', function(e) { state.payment = e.target.value; state.page = 1; renderOrders(); });

window.addEventListener('focus', function() { refreshCurrent(); });
setInterval(function() { refreshCurrent(); }, 30000);

var gateBtnEl = document.getElementById('gateBtn'); if (gateBtnEl) gateBtnEl.onclick = tryLogin;
var gatePwEl = document.getElementById('gatePw'); if (gatePwEl) gatePwEl.onkeydown = function(e) { if (e.key === 'Enter') tryLogin(); };
var logoutBtnEl = document.getElementById('logoutBtn'); if (logoutBtnEl) logoutBtnEl.onclick = function() { location.reload(); };

document.addEventListener('DOMContentLoaded', function() {
  refreshCurrent();
  
  var overlayEl = document.getElementById('overlay');
  if (overlayEl) overlayEl.addEventListener('click', function(e) { if (e.target.id === 'overlay') closeDrawer(); });

  if (typeof ic === 'function') {
    var topIc = document.getElementById('topSearchIc'); if (topIc) topIc.innerHTML = ic('search', 16);
    var tblIc = document.getElementById('tblSearchIc'); if (tblIc) tblIc.innerHTML = ic('search', 16);
    var prodIc = document.getElementById('prodSearchIc'); if (prodIc) prodIc.innerHTML = ic('search', 16);
    var custIc = document.getElementById('custSearchIc'); if (custIc) custIc.innerHTML = ic('search', 16);
    var addBtn = document.getElementById('addProdBtn'); if (addBtn) addBtn.innerHTML = ic('plus', 16) + ' <span>Add Product</span>';
    var catBtn = document.getElementById('manageCatsBtn'); if (catBtn) catBtn.innerHTML = ic('folder', 16) + ' <span>Categories</span>';
    var expBtn = document.getElementById('exportBtn'); if (expBtn) expBtn.innerHTML = ic('download', 16) + ' <span>Export</span>';
    var cExpBtn = document.getElementById('custExport'); if (cExpBtn) cExpBtn.innerHTML = ic('download', 16) + ' <span>Export List</span>';
  }
});
