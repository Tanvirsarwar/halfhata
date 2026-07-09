/* ============ HALFHATA — Production Admin Dashboard Client (Fixed) ============ */

if (typeof Store !== 'undefined' && Store.seed) { Store.seed(); }

var statusPill = { 'Pending':'pill-amber','On Courier':'pill-blue','Delivered':'pill-green','Cancelled':'pill-red' };
var payColor = { 'Cash on Delivery':'#6b7280','Partial Paid':'#2563eb','Full Paid':'#16a34a' };
var fmtDate = function(iso) { return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); };
var fmtTime = function(iso) { return new Date(iso).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }); };

var fmtStatus = function(raw) {
  if (!raw) return 'Pending';
  return raw.split('_').map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
};

var state = { search:'', status:'', page:1, per:10, view:'dashboard' };

function getActiveClient() {
  if (window.supabaseClient) return window.supabaseClient;
  if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
    console.warn('window.supabaseClient was not set by supabase.js — falling back to a fresh client.');
    return window.supabase.createClient(
      "https://mjycdnpjcffofoiuenle.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qeWNkbnBqY2Zmb2ZvaXVlbmxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzMwMDcsImV4cCI6MjA5ODkwOTAwN30.TjF994SLeKtuEo9V6AjrgccD0AqeQiALwkGd7JFzYI0"
    );
  }
  return null;
}

/* ============ REAL SUPABASE AUTH LOGIN ============
   This now uses SB.adminSignIn() which calls Supabase Auth + checks is_admin flag.
   Without this, RLS policies silently block all admin data. */
function tryLogin() {
  var emailEl = document.getElementById('gateEmail');
  var pwEl = document.getElementById('gatePw');
  if (!pwEl) return;

  var email = emailEl ? emailEl.value.trim() : '';
  var pw = pwEl.value;

  if (!email || !pw) {
    showLoginError('Please enter both email and password.');
    return;
  }

  setGateLoading(true);

  if (typeof window.SB !== 'undefined' && typeof window.SB.adminSignIn === 'function') {
    window.SB.adminSignIn(email, pw).then(function(res) {
      setGateLoading(false);
      if (res.ok) { 
        console.log('✓ Admin login successful');
        showApp(); 
      } else { 
        console.error('Admin login failed:', res.error);
        showLoginError(res.error); 
      }
    }).catch(function(e) {
      setGateLoading(false);
      console.error('Auth service error:', e);
      showLoginError('Could not reach the authentication service.');
    });
    return;
  }

  setGateLoading(false);
  showLoginError('Authentication service not available. Reload the page.');
}

function setGateLoading(loading) {
  var btn = document.getElementById('gateBtn');
  if (btn) { btn.disabled = loading; btn.textContent = loading ? 'Signing in…' : 'Login'; }
}

function showLoginError(msg) {
  var gateHintEl = document.getElementById('gateHint');
  if (gateHintEl) gateHintEl.innerHTML = '<b style="color:red">' + (msg || 'Login failed. Try again.') + '</b>';
}

function showApp() {
  var gateEl = document.getElementById('gate'); if (gateEl) gateEl.style.display = 'none';
  var appEl = document.getElementById('app'); if (appEl) appEl.style.display = 'flex';
  renderNav();
  renderSideContact();
  refreshCurrent();
}

function logout() {
  var client = getActiveClient();
  var afterLogout = function() {
    var appEl = document.getElementById('app'); if (appEl) appEl.style.display = 'none';
    var gateEl = document.getElementById('gate'); if (gateEl) gateEl.style.display = 'flex';
    var emailEl = document.getElementById('gateEmail'); if (emailEl) emailEl.value = '';
    var pwEl = document.getElementById('gatePw'); if (pwEl) pwEl.value = '';
    var gateHint = document.getElementById('gateHint'); if (gateHint) gateHint.textContent = 'Authorized staff only.';
  };
  if (client && client.auth) { 
    client.auth.signOut().then(afterLogout).catch(afterLogout); 
  } else {
    afterLogout();
  }
}

function renderNav() {
  var navs = [
    { id:'dashboard', label:'Dashboard', icon:'dashboard' },
    { id:'orders', label:'Orders', icon:'orders' },
    { id:'products', label:'Products', icon:'tag' },
    { id:'customers', label:'Customers', icon:'users' },
  ];
  var sideNavEl = document.getElementById('sideNav');
  if (sideNavEl) {
    sideNavEl.innerHTML = navs.map(function(n) {
      var iconHtml = (typeof ic === 'function') ? ic(n.icon, 18) : '';
      return '<button class="nav-item ' + (state.view === n.id ? 'active' : '') + '" data-view="' + n.id + '">' + iconHtml + ' <span>' + n.label + '</span></button>';
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
          status: fmtStatus(o.status),
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
      console.error("Orders read error:", err);
      return [];
    });
}

function renderDashboard() {
  getLiveOrders().then(function(list) {
    var dashContent = document.getElementById('dashContent');
    if (!dashContent) return;

    var pending = list.filter(function(o) { return o.status === 'Pending'; });
    var delivered = list.filter(function(o) { return o.status === 'Delivered'; });
    var revenue = delivered.reduce(function(sum, o) { return sum + o.total; }, 0);

    var kpiHtml = `
      <div class="kpis">
        <div class="kpi"><div class="lbl">Delivered Revenue</div><div class="val">৳${revenue}</div></div>
        <div class="kpi"><div class="lbl">Lifetime Orders</div><div class="val">${list.length}</div></div>
        <div class="kpi"><div class="lbl">Pending Review</div><div class="val">${pending.length}</div></div>
      </div>`;

    var activityHtml = !pending.length
      ? '<div class="empty">All clear! No orders pending review.</div>'
      : pending.slice(0, 5).map(function(o) {
          return `
            <div class="act-row" style="justify-content:space-between">
              <div><b>#${o.id}</b> by <b>${o.customer.name}</b> (${o.customer.city})</div>
              <button class="btn btn-light btn-sm" onclick="openDrawer('${o.rawUuid}')">Process</button>
            </div>`;
        }).join('');

    dashContent.innerHTML = kpiHtml +
      '<div class="panel"><div class="panel-head"><b>Needs Attention</b></div>' + activityHtml + '</div>';
  });
}

function renderOrderFilters() {
  var box = document.getElementById('orderFiltersLayout');
  if (!box) return;
  if (box.dataset.built === '1') return;

  var statuses = ['Pending', 'On Courier', 'Delivered', 'Cancelled'];
  box.innerHTML = `
    <select id="fStatus" class="btn btn-light btn-sm">
      <option value="">All Statuses</option>
      ${statuses.map(function(s) { return `<option value="${s}">${s}</option>`; }).join('')}
    </select>`;
  box.dataset.built = '1';

  document.getElementById('fStatus').addEventListener('change', function(e) {
    state.status = e.target.value; state.page = 1; renderOrders();
  });
}

function renderPager(totalCount) {
  var pager = document.getElementById('orderPager');
  if (!pager) return;

  var totalPages = Math.max(1, Math.ceil(totalCount / state.per));
  if (state.page > totalPages) state.page = totalPages;

  pager.innerHTML = `
    <button class="btn btn-light btn-sm" id="pagePrev" ${state.page <= 1 ? 'disabled' : ''}>← Prev</button>
    <span class="muted">Page ${state.page} of ${totalPages}</span>
    <button class="btn btn-light btn-sm" id="pageNext" ${state.page >= totalPages ? 'disabled' : ''}>Next →</button>`;

  var prevBtn = document.getElementById('pagePrev');
  var nextBtn = document.getElementById('pageNext');
  if (prevBtn) prevBtn.onclick = function() { if (state.page > 1) { state.page--; renderOrders(); } };
  if (nextBtn) nextBtn.onclick = function() { if (state.page < totalPages) { state.page++; renderOrders(); } };
}

function renderOrders() {
  renderOrderFilters();

  getLiveOrders().then(function(allOrders) {
    var f = allOrders;
    var searchVal = document.getElementById('orderSearch')?.value ?? state.search;
    var statusVal = document.getElementById('fStatus')?.value ?? state.status;

    if (searchVal) {
      var q = searchVal.toLowerCase();
      f = f.filter(function(o) {
        return o.id.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q) || o.customer.phone.includes(q);
      });
    }
    if (statusVal) f = f.filter(function(o) { return o.status === statusVal; });

    var orderCountEl = document.getElementById('orderCount');
    if (orderCountEl) orderCountEl.textContent = f.length + ' total orders match';

    var tbody = document.getElementById('orderBody');
    if (!tbody) return;

    if (!f.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No matching records found.</td></tr>';
      renderPager(0);
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

    renderPager(f.length);
  });
}

/* ============ PRODUCTS ============ */

function renderProducts() {
  var tbody = document.getElementById('prodBody');
  if (!tbody) return;

  var client = getActiveClient();
  if (!client) return;

  client.from('products').select('*').order('created_at', { ascending: false })
    .then(function(res) {
      var prods = res.data || [];
      var countSpan = document.getElementById('prodCount');
      if (countSpan) countSpan.textContent = prods.length + ' total active items';

      if (!prods.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">No products found. Start by adding one!</td></tr>';
        return;
      }

      tbody.innerHTML = prods.map(function(p) {
        var mediaCell = p.image
          ? `<img class="media-thumb" src="${p.image}" alt="">`
          : `<div class="media-thumb empty">No img</div>`;
        return `
          <tr>
            <td>${mediaCell}</td>
            <td><b>${p.name}</b><br><small class="muted">${p.id}</small></td>
            <td>${p.category || 'Uncategorized'}</td>
            <td><b>৳${p.price}</b></td>
            <td><span class="pill ${p.active ? 'pill-green' : 'pill-red'}">${p.active ? 'Active' : 'Disabled'}</span></td>
            <td style="display:flex;gap:6px">
              <button class="btn btn-light btn-sm" data-edit="${p.id}">Edit</button>
              <button class="btn btn-light btn-sm" data-del="${p.id}">Delete</button>
            </td>
          </tr>`;
      }).join('');

      tbody.querySelectorAll('[data-edit]').forEach(function(b) {
        b.onclick = function() {
          var p = prods.find(function(x) { return x.id === b.dataset.edit; });
          if (p) openProductDrawer(p);
        };
      });
      tbody.querySelectorAll('[data-del]').forEach(function(b) {
        b.onclick = function() {
          if (!confirm('Delete this product? This cannot be undone.')) return;
          window.SB.deleteProduct(b.dataset.del).then(function() { renderProducts(); });
        };
      });
    });
}

function openProductDrawer(existing) {
  var overlayEl = document.getElementById('overlay'); if (overlayEl) overlayEl.classList.add('show');
  var drawerEl = document.getElementById('drawer'); if (!drawerEl) return;

  var sizesAll = (typeof HH !== 'undefined' && HH.sizes) ? HH.sizes : ['S','M','L','XL','XXL'];
  var p = existing || { name:'', category:'', price:'', sizes:['M','L','XL'], active:true, image:null };

  drawerEl.innerHTML = `
    <div class="drawer-header" style="display:flex;justify-content:space-between;padding:16px;border-bottom:1px solid #e5e7eb">
      <h2>${existing ? 'Edit Product' : 'Add Product'}</h2>
      <button class="close-btn" id="closeDrawer" style="background:none;border:none;font-size:20px;cursor:pointer">✕</button>
    </div>
    <div class="drawer-body prod-drawer" style="padding:16px">
      <div class="field"><label>Name</label><input id="pfName" value="${p.name || ''}"></div>
      <div class="field"><label>Category</label><input id="pfCategory" value="${p.category || ''}"></div>
      <div class="field"><label>Price (৳)</label><input id="pfPrice" type="number" value="${p.price || ''}"></div>
      <div class="field">
        <label>Sizes</label>
        <div class="sizes-row">
          ${sizesAll.map(function(s) {
            var checked = (p.sizes || []).includes(s) ? 'checked' : '';
            return `<label class="sizechk"><input type="checkbox" value="${s}" ${checked}> ${s}</label>`;
          }).join('')}
        </div>
      </div>
      <div class="field"><label>Design image</label><input id="pfImage" type="file" accept="image/*"></div>
      <div class="field"><label><input type="checkbox" id="pfActive" ${p.active !== false ? 'checked' : ''}> Active (visible in store)</label></div>
      <button class="btn btn-dark btn-block" id="pfSave">${existing ? 'Save Changes' : 'Create Product'}</button>
    </div>`;

  document.getElementById('closeDrawer').onclick = closeDrawer;

  document.getElementById('pfSave').onclick = async function() {
    var saveBtn = document.getElementById('pfSave');
    saveBtn.disabled = true; saveBtn.textContent = 'Saving…';

    var sizes = Array.from(drawerEl.querySelectorAll('.sizechk input:checked')).map(function(i) { return i.value; });
    var name = document.getElementById('pfName').value.trim();
    if (!name) { alert('Product name is required.'); saveBtn.disabled = false; saveBtn.textContent = existing ? 'Save Changes' : 'Create Product'; return; }

    var imageFile = document.getElementById('pfImage').files[0];
    var imageDataUrl = p.image || null;
    if (imageFile) {
      imageDataUrl = await resizeImage(imageFile);
    }

    var payload = {
      name: name,
      category: document.getElementById('pfCategory').value.trim(),
      price: Number(document.getElementById('pfPrice').value) || 0,
      sizes: sizes,
      image: imageDataUrl,
      active: document.getElementById('pfActive').checked,
    };

    try {
      if (existing) {
        await window.SB.updateProduct(existing.id, payload);
      } else {
        await window.SB.createProducts([payload]);
      }
      closeDrawer();
      renderProducts();
    } catch (e) {
      alert('Could not save product: ' + (e && e.message || e));
      saveBtn.disabled = false; saveBtn.textContent = existing ? 'Save Changes' : 'Create Product';
    }
  };
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

    var countEl = document.getElementById('custCount');
    if (countEl) countEl.textContent = list.length + ' buyers cataloged';

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No customers found yet.</td></tr>';
      return;
    }

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
        <div class="drawer-header" style="display:flex;justify-content:space-between;padding:16px;border-bottom:1px solid #e5e7eb">
          <div><h2>Order #${orderIdText}</h2><small class="muted">${fmtTime(o.created_at)}</small></div>
          <button class="close-btn" id="closeDrawer" style="background:none;border:none;font-size:20px;cursor:pointer">✕</button>
        </div>
        <div class="drawer-body" style="padding:16px">
          <div class="dgroup" style="margin-bottom:16px"><strong>Status Controls</strong>
            <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
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
              } else {
                alert('Could not update status: ' + patchRes.error.message);
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
}

function renderSideContact() {
  var el = document.getElementById('sideContact');
  if (!el || typeof HH === 'undefined') return;
  el.innerHTML = (HH.channels || []).map(function(c) {
    return `<div class="r"><b style="color:${c.color}">${c.label}</b><small>${c.number}</small></div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', function() {
  var gateBtnEl = document.getElementById('gateBtn'); if (gateBtnEl) gateBtnEl.onclick = tryLogin;
  var gatePwEl = document.getElementById('gatePw'); if (gatePwEl) gatePwEl.onkeydown = function(e) { if (e.key === 'Enter') tryLogin(); };
  var gateEmailEl = document.getElementById('gateEmail'); if (gateEmailEl) gateEmailEl.onkeydown = function(e) { if (e.key === 'Enter') tryLogin(); };

  document.getElementById('orderSearch')?.addEventListener('input', function(e) { state.search = e.target.value; state.page = 1; renderOrders(); });

  var logoutBtn = document.getElementById('logoutBtn'); if (logoutBtn) logoutBtn.onclick = logout;
  var addProductBtn = document.getElementById('btnAddProduct'); if (addProductBtn) addProductBtn.onclick = function() { openProductDrawer(null); };

  refreshCurrent();
});
