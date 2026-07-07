/* ============ Admin (multi-view dashboard) ============ */
Store.seed();

const statusPill = { 'Pending':'pill-amber','On Courier':'pill-blue','Delivered':'pill-green','Cancelled':'pill-red' };
const statusColor = { 'Pending':'#b7791f','On Courier':'#2563eb','Delivered':'#16a34a','Cancelled':'#dc2626' };
const payColor = { 'Cash on Delivery':'#6b7280','Partial Paid':'#2563eb','Full Paid':'#16a34a' };
const fmtDate = iso => new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
const fmtTime = iso => new Date(iso).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });

/* ---------- STATE ---------- */
let state = { search:'', status:'', payment:'', courier:'', from:'', to:'', sortKey:'createdAt', sortDir:-1, page:1, per:10, view:'dashboard' };

/* ---------- LOGIN GATE ---------- */
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

/* ---------- NAV / VIEWS MANAGER ---------- */
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

async function getLiveOrders() {
  if (!window.supabase) return [];
  const { data: cloudOrders, error } = await window.supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false });
    
  if (error || !cloudOrders) {
    console.error("Supabase live read failure:", error);
    return [];
  }
  
  return cloudOrders.map(o => ({
    id: o.order_no || o.id,
    rawUuid: o.id,
    status: o.status ? (o.status.charAt(0).toUpperCase() + o.status.slice(1)) : 'Pending',
    createdAt: o.created_at,
    total: Number(o.total) || 0,
    subtotal: Number(o.subtotal) || 0,
    delivery: Number(o.delivery) || 80,
    customer: {
      name: o.ship_name || 'Anonymous',
      phone: o.ship_phone || 'N/A',
      city: o.ship_city || 'N/A',
      address: o.ship_address || 'N/A'
    },
    payment: {
      method: 'Cash on Delivery',
      paid: 0,
      due: Number(o.total) || 0
    },
    items: (o.order_items || []).map(it => ({
      id: it.product_id,
      name: it.name,
      price: Number(it.price) || 0,
      size: it.size || 'M',
      qty: Number(it.qty) || 1
    })),
    timeline: [{ status: 'Placed', at: o.created_at, note: 'Order captured via cloud synchronization layer' }],
    notifications: []
  }));
}

async function updateAlerts() {
  const list = await getLiveOrders();
  const pending = list.filter(o => o.status === 'Pending').length;
  const countBadge = document.getElementById('navOrdersBadge');
  if(countBadge) {
    countBadge.textContent = pending;
    countBadge.classList.toggle('hide', pending === 0);
  }
}

/* ---------- VIEW: DASHBOARD ---------- */
async function renderDashboard() {
  const list = await getLiveOrders();
  const pending = list.filter(o => o.status === 'Pending');
  const revenue = list.filter(o => o.status === 'Delivered').reduce((sum, o) => sum + o.total, 0);

  document.getElementById('sideContact').innerHTML = `<div class="muted">Phone: ${HH.phone}<br>Email: ${HH.email}</div>`;
  
  let html = `
    <div class="metrics">
      <div class="card card-summary"><h3>${money(revenue)}</h3><span class="muted">Total Delivered Revenue</span></div>
      <div class="card card-summary"><h3>${list.length}</h3><span class="muted">Lifetime Total Orders</span></div>
      <div class="card card-summary" style="border-left:4px solid var(--amber)"><h3>${pending.length}</h3><span class="muted">Orders Awaiting Review</span></div>
    </div>
    <div style="margin-top:28px">
      <h2 style="font-size:18px;margin-bottom:14px">Recent Pending Orders Queue</h2>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Order</th><th>Customer</th><th>City</th><th>Total</th><th>Action</th></tr></thead>
          <tbody>`;

  if (!pending.length) {
    html += '<tr><td colspan="5" class="empty">All clear! No orders are currently pending review.</td></tr>';
  } else {
    html += pending.slice(0, 5).map(o => `
      <tr>
        <td><b>#${esc(o.id)}</b><br><small class="muted">${fmtDate(o.createdAt)}</small></td>
        <td><b>${esc(o.customer.name)}</b><br><small class="muted">${esc(o.customer.phone)}</small></td>
        <td>${esc(o.customer.city)}</td>
        <td><b>${money(o.total)}</b></td>
        <td><button class="btn btn-light btn-sm" onclick="openDrawer('${o.rawUuid}')">Process</button></td>
      </tr>`).join('');
  }
  html += `</tbody></table></div></div>`;
  document.getElementById('dashContent').innerHTML = html;
}

/* ---------- VIEW: ORDERS (WITH ALL SEARCH FILTERS) ---------- */
async function renderOrders() {
  const allOrders = await getLiveOrders();
  
  // Apply Search, Status, and Filter parameters
  let f = allOrders;
  if (state.search) {
    const q = state.search.toLowerCase();
    f = f.filter(o => o.id.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q) || o.customer.phone.includes(q));
  }
  if (state.status) f = f.filter(o => o.status === state.status);
  if (state.payment) f = f.filter(o => o.payment.method === state.payment);

  document.getElementById('orderCount').textContent = `${f.length} total orders match`;

  // Sort Controller Parsing
  f.sort((a, b) => {
    let va = a[state.sortKey], vb = b[state.sortKey];
    if (state.sortKey === 'createdAt') { va = new Date(a.createdAt); vb = new Date(b.createdAt); }
    return va > vb ? state.sortDir : va < vb ? -state.sortDir : 0;
  });

  // Pages Divider Engine
  const totalPages = Math.ceil(f.length / state.per) || 1;
  state.page = Math.max(1, Math.min(state.page, totalPages));
  const start = (state.page - 1) * state.per;
  const chunk = f.slice(start, start + state.per);

  // Re-build multi-select pill filters interface dynamically
  document.getElementById('orderFiltersLayout').innerHTML = `
    <div class="pill-filter">
      <span class="pill ${state.status===''?'active':''}" onclick="setOrderFilter('status','')">All Statuses</span>
      <span class="pill ${state.status==='Pending'?'active':''}" onclick="setOrderFilter('status','Pending')">Pending</span>
      <span class="pill ${state.status==='On Courier'?'active':''}" onclick="setOrderFilter('status','On Courier')">On Courier</span>
      <span class="pill ${state.status==='Delivered'?'active':''}" onclick="setOrderFilter('status','Delivered')">Delivered</span>
      <span class="pill ${state.status==='Cancelled'?'active':''}" onclick="setOrderFilter('status','Cancelled')">Cancelled</span>
    </div>`;

  const tbody = document.getElementById('orderBody');
  if (!chunk.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No matching records found inside database view.</td></tr>';
    document.getElementById('orderPager').innerHTML = '';
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

  // Render complete pagination control element bars
  document.getElementById('orderPager').innerHTML = `
    <button class="btn btn-light btn-sm" ${state.page===1?'disabled':''} onclick="changeOrderPage(-1)">Previous</button>
    <span class="muted">Page ${state.page} of ${totalPages}</span>
    <button class="btn btn-light btn-sm" ${state.page===totalPages?'disabled':''} onclick="changeOrderPage(1)">Next</button>`;
}

window.setOrderFilter = (key, val) => { state[key] = val; state.page = 1; renderOrders(); };
window.changeOrderPage = dir => { state.page += dir; renderOrders(); };

/* ---------- VIEW: PRODUCTS ---------- */
function renderProducts() {
  const prods = Store.getProducts();
  const tbody = document.getElementById('prodBody');
  document.getElementById('prodCount').textContent = `${prods.length} total active items`;

  if (!prods.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">No products found in system catalog.</td></tr>';
    return;
  }

  tbody.innerHTML = prods.map(p => `
    <tr>
      <td><div style="width:34px;height:34px;background:#f5f4f2;border-radius:4px;overflow:hidden">${productMedia(p, '100%')}</div></td>
      <td><b>${esc(p.name)}</b><br><small class="muted">${esc(p.id)}</small></td>
      <td>${esc(p.category || '—')}</td>
      <td><b>${money(p.price)}</b></td>
      <td><span class="pill ${p.active ? 'pill-green' : 'pill-red'}">${p.active ? 'Active' : 'Disabled'}</span></td>
      <td><button class="btn btn-light btn-sm" onclick="alert('Product editing runs via separate store context components')">Edit</button></td>
    </tr>`).join('');
}

/* ---------- VIEW: CUSTOMERS ---------- */
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
  document.getElementById('custCount').textContent = `${list.length} buyers cataloged`;

  const tbody = document.getElementById('custBody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">No synchronized customer interactions recorded yet.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr>
      <td><b>${esc(c.name)}</b></td>
      <td>${esc(c.phone)}</td>
      <td>${esc(c.city)}</td>
      <td><b>${c.count} orders</b></td>
      <td><b>${money(c.spent)}</b></td>
      <td><div class="muted" style="font-size:12px">${fmtDate(c.last)}</div></td>
    </tr>`).join('');
}

/* ---------- DRAWER / RECORD MODIFIER PANEL ---------- */
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
      <button class="close-btn" id="closeDrawer">${ic('x',20)}</button>
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

  document.getElementById('closeDrawer').onclick = closeDrawer;
  
  // Bind dynamic click events for row mutation actions
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
      alert("Database patch rejected: " + patchError.message);
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

/* Event Hook-Ins */
document.getElementById('orderSearch')?.addEventListener('input', e => { state.search = e.target.value; state.page = 1; renderOrders(); });
window.addEventListener('focus', () => { refreshCurrent(); });
setInterval(() => { refreshCurrent(); }, 20000);

document.getElementById('gateBtn').onclick = tryLogin;
document.getElementById('gatePw').onkeydown = e => { if (e.key === 'Enter') tryLogin(); };
