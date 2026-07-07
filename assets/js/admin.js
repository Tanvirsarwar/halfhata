/* ============ Admin (Fully Restored & Supabase Connected) ============ */
Store.seed();

const statusPill = { 'Pending':'pill-amber','On Courier':'pill-blue','Delivered':'pill-green','Cancelled':'pill-red' };
const statusColor = { 'Pending':'#b7791f','On Courier':'#2563eb','Delivered':'#16a34a','Cancelled':'#dc2626' };
const payColor = { 'Cash on Delivery':'#6b7280','Partial Paid':'#2563eb','Full Paid':'#16a34a' };
const fmtDate = iso => new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
const fmtTime = iso => new Date(iso).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });

/* ---------- STATE MANAGEMENT ---------- */
let state = { search:'', status:'', payment:'', courier:'', from:'', to:'', sortKey:'createdAt', sortDir:-1, page:1, per:10, view:'dashboard' };

/* ---------- AUTHENTICATION & LOGIN GATE ---------- */
async function tryLogin() {
  const pw = document.getElementById('gatePw').value;
  if (await Store.adminLogin(pw)) { showApp(); }
  else { document.getElementById('gateHint').innerHTML = '<b style="color:var(--red)">Wrong password. Try again.</b>'; }
}

function showApp() {
  document.getElementById('gate').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  renderNav();
  refreshCurrent();
}

/* ---------- SYSTEM CORE INTERFACE CONTROLLERS ---------- */
function renderNav() {
  const navs = [
    { id:'dashboard', label:'Dashboard', ic:'chart' },
    { id:'orders', label:'Orders', ic:'package' },
    { id:'products', label:'Products', ic:'shirt' },
    { id:'customers', label:'Customers', ic:'user' },
  ];
  document.getElementById('sideNav').innerHTML = navs.map(n => `
    <button class="nav-item ${state.view === n.id ? 'active' : ''}" data-view="${n.id}">
      ${ic(n.ic, 18)} <span>${n.label}</span>
    </button>
  `).join('');

  document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => {
    state.view = b.dataset.view; state.page = 1;
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById(`view-${state.view}`).style.display = 'block';
    renderNav(); refreshCurrent();
  });
}

// Global data streamer that extracts entries instantly from Supabase tables
async function getLiveOrders() {
  if (!window.supabase) return [];
  try {
    const { data: cloudOrders, error } = await window.supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });
      
    if (error || !cloudOrders) throw error;
    
    return cloudOrders.map(o => ({
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
      items: (o.order_items || []).map(it => ({
        id: it.product_id,
        name: it.name,
        price: Number(it.price) || 0,
        size: it.size || 'M',
        qty: Number(it.qty) || 1
      })),
      timeline: [{ status: 'Placed', at: o.created_at, note: 'Cloud Synced Order' }]
    }));
  } catch (err) {
    console.error("Supabase cluster link broken:", err);
    return [];
  }
}

async function updateAlerts() {
  const list = await getLiveOrders();
  const pendingCount = list.filter(o => o.status === 'Pending').length;
  const bell = document.getElementById('bellBtn');
  if (bell) {
    bell.innerHTML = ic('bell', 20) + (pendingCount > 0 ? `<span class="notif-badge">${pendingCount}</span>` : '');
  }
}

/* ---------- VIEW: DASHBOARD CONTROLLERS ---------- */
async function renderDashboard() {
  const list = await getLiveOrders();
  const pending = list.filter(o => o.status === 'Pending');
  const delivered = list.filter(o => o.status === 'Delivered');
  const revenue = delivered.reduce((sum, o) => sum + o.total, 0);

  document.getElementById('sideContact').innerHTML = `<div class="muted">Phone: ${HH.phone}<br>Email: ${HH.email}</div>`;
  
  // Show standard welcome banner if database tables contain no records
  const hintPanel = document.getElementById('dashHint');
  if (hintPanel) hintPanel.style.display = list.length === 0 ? 'block' : 'none';

  // Populates your precise layout containers (#kpis, #revTotal) 
  const kpis = document.getElementById('kpis');
  if (kpis) {
    kpis.innerHTML = `
      <div class="card card-summary"><h3>${money(revenue)}</h3><span class="muted">Delivered Revenue</span></div>
      <div class="card card-summary"><h3>${list.length}</h3><span class="muted">Lifetime Orders</span></div>
      <div class="card card-summary"><h3>${pending.length}</h3><span class="muted">Pending Review</span></div>
    `;
  }
  
  const revTotal = document.getElementById('revTotal');
  if (revTotal) revTotal.textContent = `Total: ${money(revenue)}`;

  // Populate basic summary elements inside the charts panels safely
  document.getElementById('chartRevenue').innerHTML = `<div style="padding:20px;font-weight:500;color:var(--muted)"> Delighted to serve: ${delivered.length} finalized direct items.</div>`;
  document.getElementById('chartStatus').innerHTML = `<div class="summary-stat-box">Pending: <b>${pending.length}</b> · Shipped: <b>${list.filter(o => o.status==='On Courier').length}</b></div>`;
  
  // Render active orders streaming list directly inside your original #activity workspace
  const activity = document.getElementById('activity');
  if (activity) {
    if (!pending.length) {
      activity.innerHTML = '<div class="empty">All clear! No orders are currently pending review.</div>';
    } else {
      activity.innerHTML = pending.slice(0, 5).map(o => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid #f2f1ef">
          <div><b>#${esc(o.id)}</b> by <b>${esc(o.customer.name)}</b> (${esc(o.customer.city)})</div>
          <button class="btn btn-light btn-sm" onclick="openDrawer('${o.rawUuid}')">Process</button>
        </div>`).join('');
    }
  }
}

/* ---------- VIEW: ORDERS CONTROLLERS ---------- */
async function renderOrders() {
  const allOrders = await getLiveOrders();
  
  // Re-map column configurations to your exact original #thead structure element
  const thead = document.getElementById('thead');
  if (thead) {
    thead.innerHTML = `<tr><th>Order Ref</th><th>Recipient</th><th>City / Region</th><th>Status</th><th>Method</th><th>Total Bill</th><th>Action</th></tr>`;
  }

  // Parse filters securely from input elements
  let f = allOrders;
  const searchVal = document.getElementById('tblSearch')?.value || state.search;
  const statusVal = document.getElementById('fStatus')?.value || state.status;
  const paymentVal = document.getElementById('fPayment')?.value || state.payment;

  if (searchVal) {
    const q = searchVal.toLowerCase();
    f = f.filter(o => o.id.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q) || o.customer.phone.includes(q));
  }
  if (statusVal) f = f.filter(o => o.status === statusVal);
  if (paymentVal) f = f.filter(o => o.payment.method === paymentVal);

  const stats = document.getElementById('stats');
  if (stats) stats.innerHTML = `<div class="crumb">${f.length} orders match filter criteria</div>`;

  // Pagination splitter logic matches your state variables
  const totalPages = Math.ceil(f.length / state.per) || 1;
  state.page = Math.max(1, Math.min(state.page, totalPages));
  const start = (state.page - 1) * state.per;
  const chunk = f.slice(start, start + state.per);

  const tbody = document.getElementById('tbody');
  if (!tbody) return;

  if (!chunk.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No matching records found inside database view.</td></tr>';
    document.getElementById('pager').innerHTML = '';
    return;
  }

  tbody.innerHTML = chunk.map(o => `
    <tr class="clickable-row" onclick="openDrawer('${o.rawUuid}')">
      <td><b>#${esc(o.id)}</b><div class="muted" style="font-size:11px">${fmtTime(o.createdAt)}</div></td>
      <td><b>${esc(o.customer.name)}</b><div class="muted" style="font-size:12px">${esc(o.customer.phone)}</div></td>
      <td>${esc(o.customer.city)}</td>
      <td><span class="pill ${statusPill[o.status]}">${o.status}</span></td>
      <td><span class="pill pill-light" style="color:${payColor[o.payment.method]}">${o.payment.method}</span></td>
      <td><b>${money(o.total)}</b></td>
      <td><button class="btn btn-light btn-sm">Manage</button></td>
    </tr>`).join('');

  // Handle previous/next pagination actions directly into original #pager area
  const pager = document.getElementById('pager');
  if (pager) {
    pager.innerHTML = `
      <button class="btn btn-light btn-sm" ${state.page===1?'disabled':''} id="prevPageBtn">Previous</button>
      <span class="muted">Page ${state.page} of ${totalPages}</span>
      <button class="btn btn-light btn-sm" ${state.page===totalPages?'disabled':''} id="nextPageBtn">Next</button>`;
      
    document.getElementById('prevPageBtn').onclick = () => { state.page--; renderOrders(); };
    document.getElementById('nextPageBtn').onclick = () => { state.page++; renderOrders(); };
  }
}

/* ---------- VIEW: PRODUCTS & CATALOG CONTROLLERS ---------- */
function renderProducts() {
  const prods = Store.getProducts();
  const tbody = document.getElementById('prodBody');
  const countSpan = document.getElementById('prodCount');
  
  if (countSpan) countSpan.textContent = prods.length;
  if (!tbody) return;

  if (!prods.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No products found in system catalog.</td></tr>';
    return;
  }

  tbody.innerHTML = prods.map(p => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:34px;height:34px;background:#f5f4f2;border-radius:4px;overflow:hidden">${productMedia(p, '100%')}</div>
          <div><b>${esc(p.name)}</b><br><small class="muted">${esc(p.id)}</small></div>
        </div>
      </td>
      <td>${esc(p.category || '—')}</td>
      <td><b>${money(p.price)}</b></td>
      <td>0</td>
      <td>৳0</td>
      <td><span class="pill ${p.active ? 'pill-green' : 'pill-red'}">${p.active ? 'Active' : 'Disabled'}</span></td>
      <td><button class="btn btn-light btn-sm" onclick="alert('Product settings configuration locked to data.js definitions.')">Edit</button></td>
    </tr>`).join('');
}

/* ---------- VIEW: CUSTOMERS CONTROLLERS ---------- */
async function renderCustomers() {
  const orders = await getLiveOrders();
  const map = {};
  orders.forEach(o => {
    const ph = o.customer.phone;
    if (!map[ph]) map[ph] = { name:o.customer.name, phone:ph, city:o.customer.city, count:0, spent:0, last:o.createdAt };
    map[ph].count++;
    map[ph].spent += o.total;
    if (new Date(o.createdAt) > new Date(map[ph].last)) map[ph].last = o.createdAt;
  });

  const list = Object.values(map);
  const countSpan = document.getElementById('custCount');
  if (countSpan) countSpan.textContent = `${list.length} clients registered`;

  const tbody = document.getElementById('custBody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No orders processed yet to catalog customers.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr>
      <td><b>${esc(c.name)}</b></td>
      <td>${esc(c.phone)}</td>
      <td>${esc(c.city)}</td>
      <td><b>${c.count} orders</b></td>
      <td><b>${money(c.spent)}</b></td>
      <td><b>${money(c.spent)}</b></td>
      <td><div class="muted" style="font-size:12px">${fmtDate(c.last)}</div></td>
    </tr>`).join('');
}

/* ---------- FLOATING ADJUSTMENT OVERLAY DRAWER MANAGEMENT ---------- */
async function openDrawer(uuid) {
  if (!window.supabase) return;
  
  const { data: o, error } = await window.supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', uuid)
    .single();

  if (error || !o) {
    toast('Could not download complete order parameters');
    return;
  }

  document.getElementById('overlay').classList.add('show');
  document.getElementById('drawer').innerHTML = `
    <div class="drawer-header">
      <div><h2>Order #${esc(o.order_no || o.id.slice(0,8))}</h2><small class="muted">${fmtTime(o.created_at)}</small></div>
      <button class="close-btn" id="closeDrawer"></button>
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
        <div class="kv"><span>Recipient</span><b>${esc(o.ship_name)}</b></div>
        <div class="kv"><span>Contact</span><b>${esc(o.ship_phone)}</b></div>
        <div class="kv"><span>Destination</span><b>${esc(o.ship_address)}, ${esc(o.ship_city)}</b></div>
      </div>
      <div class="dgroup"><div class="t">Line Items</div>
        <div class="drawer-items">${(o.order_items || []).map(it => `
          <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid #f2f1ef">
            <div style="flex:1"><b>${esc(it.name)}</b> <span class="muted">x${it.qty}</span><br><small class="muted">Size: ${esc(it.size || 'M')}</small></div>
            <b>${money(it.price * it.qty)}</b>
          </div>`).join('')}</div>
      </div>
      <div class="dgroup"><div class="t">Billing Metrics</div>
        <div class="kv"><span>Subtotal</span><b>${money(o.subtotal)}</b></div>
        <div class="kv"><span>Delivery</span><b>${money(o.delivery)}</b></div>
        <div class="kv"><span>Total Bill</span><b>${money(o.total)}</b></div>
      </div>
    </div>`;

  document.getElementById('closeDrawer').innerHTML = ic('x', 20);
  document.getElementById('closeDrawer').onclick = closeDrawer;
  
  // Status changer button bindings
  document.querySelectorAll('[data-status]').forEach(b => b.onclick = async () => {
    const nextStatus = b.dataset.status;
    const { error: patchError } = await window.supabase
      .from('orders')
      .update({ status: nextStatus })
      .eq('id', uuid);

    if (!patchError) {
      toast(`Status updated → ${nextStatus}`);
      refreshCurrent();
      openDrawer(uuid);
    } else {
      alert("Database mutation failed: " + patchError.message);
    }
  });
}

function closeDrawer(){ document.getElementById('overlay').classList.remove('show'); }
document.getElementById('overlay').addEventListener('click', e => { if (e.target.id === 'overlay') closeDrawer(); });

function refreshCurrent(){ 
  ({ 
    dashboard: renderDashboard, 
    orders: renderOrders, 
    products: renderProducts, 
    customers: renderCustomers 
  }[state.view] || (()=>{}))(); 
  updateAlerts(); 
}

/* INTERACTION ELEMENT LISTENERS */
document.getElementById('globalSearch')?.addEventListener('input', e => { state.search = e.target.value; state.page = 1; refreshCurrent(); });
document.getElementById('tblSearch')?.addEventListener('input', e => { state.search = e.target.value; state.page = 1; renderOrders(); });
document.getElementById('fStatus')?.addEventListener('change', e => { state.status = e.target.value; state.page = 1; renderOrders(); });
document.getElementById('fPayment')?.addEventListener('change', e => { state.payment = e.target.value; state.page = 1; renderOrders(); });

// Polling interval cycle keeps data alive automatically
window.addEventListener('focus', () => { refreshCurrent(); });
setInterval(() => { refreshCurrent(); }, 30000);

document.getElementById('gateBtn').onclick = tryLogin;
document.getElementById('gatePw').onkeydown = e => { if (e.key === 'Enter') tryLogin(); };
document.getElementById('logoutBtn').onclick = () => { location.reload(); };

// Populate initial icon decorators onto your original admin page markup tags
document.addEventListener('DOMContentLoaded', () => {
  const topIc = document.getElementById('topSearchIc'); if (topIc) topIc.innerHTML = ic('search', 16);
  const tblIc = document.getElementById('tblSearchIc'); if (tblIc) tblIc.innerHTML = ic('search', 16);
  const prodIc = document.getElementById('prodSearchIc'); if (prodIc) prodIc.innerHTML = ic('search', 16);
  const custIc = document.getElementById('custSearchIc'); if (custIc) custIc.innerHTML = ic('search', 16);
  const addBtn = document.getElementById('addProdBtn'); if (addBtn) addBtn.innerHTML = ic('plus', 16) + ' <span>Add Product</span>';
  const catBtn = document.getElementById('manageCatsBtn'); if (catBtn) catBtn.innerHTML = ic('folder', 16) + ' <span>Categories</span>';
  const expBtn = document.getElementById('exportBtn'); if (expBtn) expBtn.innerHTML = ic('download', 16) + ' <span>Export</span>';
  const cExpBtn = document.getElementById('custExport'); if (cExpBtn) cExpBtn.innerHTML = ic('download', 16) + ' <span>Export List</span>';
});
