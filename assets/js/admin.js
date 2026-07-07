/* ============ Admin (multi-view dashboard) ============ */
//Store.seed();

const statusPill = { 'Pending':'pill-amber','On Courier':'pill-blue','Delivered':'pill-green','Cancelled':'pill-red' };
const statusColor = { 'Pending':'#b7791f','On Courier':'#2563eb','Delivered':'#16a34a','Cancelled':'#dc2626' };
const payColor = { 'Cash on Delivery':'#6b7280','Partial Paid':'#2563eb','Full Paid':'#16a34a' };
const fmtDate = iso => new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
const fmtTime = iso => new Date(iso).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });

/* ---------- LOGIN GATE ---------- */
async function tryLogin() {
  const pw = document.getElementById('gatePw').value;
  if (await Store.adminLogin(pw)) { showApp(); }
  else { document.getElementById('gateHint').innerHTML = '<b style="color:var(--red)">Wrong password. Try again.</b>'; }
}
function showApp() {
  document.getElementById('gate').style.display = 'none';
  document.getElementById('app').style.display = 'grid';
  boot();
}
document.getElementById('gateBtn').onclick = tryLogin;
document.getElementById('gatePw').addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
document.getElementById('logoutBtn') && (document.getElementById('logoutBtn').onclick = () => { Store.adminLogout(); location.reload(); });
if (Store.isAdmin()) showApp();

/* ---------- STATE ---------- */
let state = { search:'', status:'', payment:'', courier:'', from:'', to:'', sortKey:'createdAt', sortDir:-1, page:1, per:10, view:'dashboard' };

/* ---------- CHROME + NAV ---------- */
async function boot() {
  if (window.SB) await SB.loadCatalog();
  const nav = [
    ['dashboard','Dashboard','dashboard'],['orders','Orders','orders'],['box','Products','products'],
    ['users','Customers','customers'],['tag','Coupons','coupons'],['chart','Reports','dashboard'],
    ['star','Reviews','reviews'],['bell','Notifications','notifications'],['settings','Settings','settings'],['logout','Logout','logout'],
  ];
  document.getElementById('sideNav').innerHTML = nav.map(([i,t,view,badge]) =>
    `<a data-view="${view}" href="#${view}">${ic(i,20)} ${t}${badge?`<span class="badge">${badge}</span>`:''}</a>`).join('');
  document.getElementById('sideContact').innerHTML = HH.channels.map(c =>
    `<div class="r"><span style="width:24px;height:24px;border-radius:50%;background:${c.color};display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700">${c.label[0]}</span><div><b style="color:#fff;font-size:11px">${c.label}</b><small>${c.number}</small></div></div>`).join('');
  document.getElementById('topSearchIc').innerHTML = ic('search',18);
  document.getElementById('tblSearchIc').innerHTML = ic('search',16);
  document.getElementById('custSearchIc').innerHTML = ic('search',16);
  document.getElementById('bellBtn').innerHTML = ic('bell',22);
  document.getElementById('exportBtn').innerHTML = ic('download',16) + ' Export CSV';
  document.getElementById('custExport').innerHTML = ic('download',16) + ' Export CSV';
  document.getElementById('fCourier').innerHTML = '<option value="">All Courier</option>' + HH.couriers.map(c => `<option>${c}</option>`).join('');

  document.querySelectorAll('#sideNav a').forEach(a => a.onclick = e => {
    const v = a.dataset.view;
    if (v === 'logout') { Store.adminLogout(); location.reload(); return; }
    e.preventDefault(); switchView(v);
  });

  document.getElementById('globalSearch').addEventListener('input', e => {
    state.search = e.target.value;
    if (state.view === 'orders') { document.getElementById('tblSearch').value = e.target.value; state.page = 1; renderOrders(); }
    else if (state.view === 'customers') { document.getElementById('custSearch').value = e.target.value; renderCustomers(); }
    else switchView('orders');
  });

  wireOrders(); wireProducts(); wireCustomers();
  switchView(location.hash.replace('#','') || 'dashboard');
  updateAlerts();
}

/* real pending-order count on the header bell + sidebar (no fake numbers) */
function updateAlerts() {
  const pending = Store.getOrders().filter(o => o.status === 'Pending').length;
  const bell = document.getElementById('bellBtn');
  if (bell) bell.innerHTML = ic('bell',22) + (pending
    ? `<span style="position:absolute;top:-6px;right:-6px;background:var(--red);color:#fff;font-size:9px;font-weight:700;min-width:16px;height:16px;border-radius:99px;display:flex;align-items:center;justify-content:center">${pending}</span>` : '');
  const navA = document.querySelector('#sideNav a[data-view="notifications"]');
  if (navA) {
    let b = navA.querySelector('.badge');
    if (pending) { if (!b) { b = document.createElement('span'); b.className = 'badge'; navA.appendChild(b); } b.textContent = pending; }
    else if (b) b.remove();
  }
}

function switchView(v) {
  state.view = v;
  document.querySelectorAll('.view').forEach(s => s.style.display = 'none');
  document.querySelectorAll('#sideNav a').forEach(a => a.classList.toggle('active', a.dataset.view === v));
  const known = ['dashboard','orders','products','customers'];
  if (known.includes(v)) {
    document.getElementById('view-' + v).style.display = 'block';
    ({ dashboard:renderDashboard, orders:renderOrders, products:renderProducts, customers:renderCustomers }[v])();
  } else if (v === 'settings') {
    document.getElementById('view-generic').style.display = 'block';
    document.getElementById('genTitle').textContent = 'Settings';
    document.getElementById('genCrumb').textContent = 'Dashboard › Settings';
    document.getElementById('genBody').innerHTML = `
      <div style="text-align:left">
        <div class="dgroup"><div class="t">Store</div>
          <div class="kv"><span>Products</span><b>${Store.getProducts().length}</b></div>
          <div class="kv"><span>Categories</span><b>${Store.getCategories().length}</b></div>
          <div class="kv"><span>Orders</span><b>${Store.getOrders().length}</b></div>
          <div class="kv"><span>Payment numbers</span><b>${esc(HH.phone)}</b></div>
        </div>
        <div class="dgroup" style="border-color:#f0c0c0;background:#fff8f8"><div class="t" style="color:var(--red)">Danger zone</div>
          <p style="font-size:13px;color:var(--muted);margin:0 0 12px">Permanently deletes all products, categories, orders, customers and notifications from this browser. Use it to start completely fresh.</p>
          <button class="btn" id="resetAll" style="background:var(--red);color:#fff">Reset all data</button>
        </div>
        <p class="small" style="color:var(--muted)">In production, security &amp; settings (admin accounts, roles, contact numbers) live in Supabase. See schema.sql and SECURITY.md.</p>
      </div>`;
    document.getElementById('resetAll').onclick = () => {
      if (confirm('Delete ALL data and start fresh? This cannot be undone.')) { Store.resetAllData(); toast('All data cleared'); setTimeout(() => location.reload(), 700); }
    };
  } else {
    document.getElementById('view-generic').style.display = 'block';
    document.getElementById('genTitle').textContent = v.charAt(0).toUpperCase() + v.slice(1);
    document.getElementById('genCrumb').textContent = 'Dashboard › ' + v;
    document.getElementById('genBody').innerHTML = `${ic('box',34)}<br><br>The <b>${esc(v)}</b> section reads from your Supabase tables in the live version.<br>This demo focuses on Dashboard, Orders, Products and Customers.`;
  }
}

/* ---------- DASHBOARD ---------- */
function renderDashboard() {
  const a = Store.analytics();
  const hint = document.getElementById('dashHint');
  if (hint) hint.style.display = (a.orders === 0 && Store.getProducts().length === 0) ? 'block' : 'none';
  const kpis = [
    ['wallet','Revenue (gross)', money(a.revenueGross), `${money(a.revenueCollected)} collected · ${money(a.due)} due`],
    ['orders','Orders', a.orders, `${a.pending} pending · ${a.onCourier} shipping`],
    ['truck','Delivered', a.delivered, `${a.deliveryRate}% delivery rate`, true],
    ['chart','Avg. order value', money(a.aov), `${a.customers} customers`],
  ];
  document.getElementById('kpis').innerHTML = kpis.map(([i,l,v,s,up]) =>
    `<div class="kpi"><div class="lbl">${ic(i,15)} ${l}</div><div class="val">${v}</div><div class="sub ${up?'up':''}">${s}</div></div>`).join('');

  const rev = Store.revenueSeries(14);
  document.getElementById('revTotal').textContent = money(rev.reduce((s,d)=>s+d.value,0));
  document.getElementById('chartRevenue').innerHTML = svgLineArea(rev);

  const st = Store.statusSplit();
  document.getElementById('chartStatus').innerHTML = svgDonut(st);
  document.getElementById('statusLegend').innerHTML = st.map(d =>
    `<div class="li"><span class="sw" style="background:${statusColor[d.label]}"></span>${d.label}<b>${d.value}</b></div>`).join('');

  document.getElementById('chartPayment').innerHTML = svgBars(
    Store.paymentSplit().map(d => ({ label: d.label.split(' ')[0], value: d.value })));

  document.getElementById('topProducts').innerHTML = Store.topProducts(5).map((p,i) =>
    `<div class="top-row"><div class="rk">${i+1}</div><div class="grow">${esc(p.name)}<br><small>${p.qty} sold</small></div><b>${money(p.revenue)}</b></div>`).join('') || '<div class="empty">No sales yet</div>';

  document.getElementById('activity').innerHTML = Store.recentActivity(8).map(x =>
    `<div class="act-row"><span class="dot" style="background:${statusColor[x.status]||'#141416'}"></span>
      <span><b>#${esc(x.orderId)}</b> — ${esc(x.name)}</span><span>${esc(x.status)}</span><span class="t">${fmtTime(x.at)}</span></div>`).join('');
}

/* ---------- ORDERS ---------- */
function wireOrders() {
  document.getElementById('tblSearch').addEventListener('input', e => { state.search = e.target.value; state.page = 1; renderOrders(); });
  document.getElementById('fStatus').addEventListener('change', e => { state.status = e.target.value; state.page = 1; renderOrders(); });
  document.getElementById('fPayment').addEventListener('change', e => { state.payment = e.target.value; state.page = 1; renderOrders(); });
  document.getElementById('fCourier').addEventListener('change', e => { state.courier = e.target.value; state.page = 1; renderOrders(); });
  document.getElementById('fFrom').addEventListener('change', e => { state.from = e.target.value; state.page = 1; renderOrders(); });
  document.getElementById('fTo').addEventListener('change', e => { state.to = e.target.value; state.page = 1; renderOrders(); });
  document.getElementById('exportBtn').onclick = exportCSV;

  document.addEventListener('click', e => {
    const stat = e.target.closest('[data-stat]');
    if (stat) { const f = stat.dataset.stat; state.status = state.status === f ? '' : f; document.getElementById('fStatus').value = state.status; state.page = 1; renderOrders(); }
    const th = e.target.closest('th.sortable');
    if (th) { const k = th.dataset.sort; if (state.sortKey === k) state.sortDir *= -1; else { state.sortKey = k; state.sortDir = 1; } renderOrders(); }
    const pg = e.target.closest('[data-page]');
    if (pg && !pg.disabled) { state.page = +pg.dataset.page; renderOrders(); }
    const v = e.target.closest('[data-view-order]');
    if (v) openDrawer(v.dataset.viewOrder);
  });
}
function getRows() {
  let rows = Store.getOrders();
  const q = state.search.toLowerCase();
  if (q) rows = rows.filter(o => (o.id + o.customer.name + o.customer.phone).toLowerCase().includes(q));
  if (state.status)  rows = rows.filter(o => o.status === state.status);
  if (state.payment) rows = rows.filter(o => o.payment.label === state.payment);
  if (state.courier) rows = rows.filter(o => o.courier && o.courier.service === state.courier);
  if (state.from) rows = rows.filter(o => new Date(o.createdAt) >= new Date(state.from));
  if (state.to)   rows = rows.filter(o => new Date(o.createdAt) <= new Date(state.to + 'T23:59:59'));
  const key = state.sortKey;
  rows.sort((a, b) => {
    let A = key==='amount'?a.total : key==='customer'?a.customer.name : key==='createdAt'?a.createdAt : a[key]||'';
    let B = key==='amount'?b.total : key==='customer'?b.customer.name : key==='createdAt'?b.createdAt : b[key]||'';
    return (A < B ? -1 : A > B ? 1 : 0) * state.sortDir;
  });
  return rows;
}
const OCOLS = [['id','Order ID'],['customer','Customer'],['amount','Amount'],['payment','Payment'],['status','Status'],['createdAt','Date'],['courier','Courier / Tracking'],['action','Action']];
function renderStats() {
  const all = Store.getOrders(); const by = s => all.filter(o => o.status === s).length;
  const cards = [['orders','All Orders',all.length,'#eef','#4b5563',''],['bell','Pending',by('Pending'),'var(--amber-bg)','var(--amber)','Pending'],
    ['box','On Courier',by('On Courier'),'var(--blue-bg)','var(--blue)','On Courier'],['truck','Delivered',by('Delivered'),'var(--green-bg)','var(--green)','Delivered'],
    ['x','Cancelled',by('Cancelled'),'var(--red-bg)','var(--red)','Cancelled']];
  document.getElementById('stats').innerHTML = cards.map(([i,t,n,bg,fg,f]) =>
    `<div class="stat ${state.status===f&&f?'on':''}" data-stat="${f}"><div class="ic" style="background:${bg};color:${fg}">${ic(i,22)}</div><div><small>${t}</small><b>${n}</b></div></div>`).join('');
}
function renderOrders() {
  renderStats();
  document.getElementById('thead').innerHTML = OCOLS.map(([k,label]) => {
    const sortable = !['action','courier','payment'].includes(k);
    const arw = state.sortKey === k ? (state.sortDir === 1 ? '▲' : '▼') : '';
    return `<th class="${sortable?'sortable':''}" data-sort="${k}">${label} <span class="arw">${arw}</span></th>`;
  }).join('');
  const rows = getRows(), total = rows.length, pages = Math.max(1, Math.ceil(total/state.per));
  if (state.page > pages) state.page = pages;
  const slice = rows.slice((state.page-1)*state.per, state.page*state.per);
  document.getElementById('tbody').innerHTML = slice.length ? slice.map(o => `
    <tr><td class="oid-cell">#${esc(o.id)}</td><td>${esc(o.customer.name)}</td><td>${money(o.total)}</td>
      <td>${esc(o.payment.label)}</td><td><span class="pill ${statusPill[o.status]}">${o.status}</span></td>
      <td>${fmtDate(o.createdAt)}</td>
      <td class="courier-cell">${o.courier ? `${esc(o.courier.service)}<small>${esc(o.courier.trackingId)}</small>` : '—'}</td>
      <td><button class="eye" data-view-order="${esc(o.id)}">${ic('eye',18)}</button></td></tr>`).join('')
    : `<tr><td colspan="8"><div class="empty">No orders match your filters.</div></td></tr>`;
  const pg = document.getElementById('pager'); const b = [];
  b.push(`<button ${state.page===1?'disabled':''} data-page="${state.page-1}">‹</button>`);
  for (let i=1;i<=pages;i++){ if(i===1||i===pages||Math.abs(i-state.page)<=1) b.push(`<button class="${i===state.page?'on':''}" data-page="${i}">${i}</button>`); else if(Math.abs(i-state.page)===2) b.push('<span style="color:var(--muted)">…</span>'); }
  b.push(`<button ${state.page===pages?'disabled':''} data-page="${state.page+1}">›</button>`);
  pg.innerHTML = b.join('') + `<span style="margin-left:12px;color:var(--muted);font-size:13px">${total} orders</span>`;
}
function exportCSV() {
  const rows = getRows();
  const head = ['Order ID','Customer','Phone','District','City','Address','Amount','Paid','Due','Payment','Status','Courier','Tracking ID','Txn ID','Date'];
  const q = s => `"${String(s??'').replace(/"/g,'""')}"`;
  const lines = rows.map(o => [o.id,o.customer.name,o.customer.phone,o.customer.district,o.customer.city,o.customer.address,o.total,o.payment.paid,o.payment.due,o.payment.label,o.status,o.courier?.service||'',o.courier?.trackingId||'',o.payment.txnId||'',fmtDate(o.createdAt)].map(q).join(','));
  download(`halfhata-orders-${Date.now()}.csv`, [head.join(','), ...lines].join('\n'));
  toast(`Exported ${rows.length} orders`);
}
function download(name, text) {
  const blob = new Blob([text], { type:'text/csv' }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

/* ---------- PRODUCTS ---------- */
function wireProducts() {
  document.getElementById('tblProdSearch').addEventListener('input', e => { state.search = e.target.value; renderProducts(); });
  document.getElementById('addProdBtn').onclick = () => openProductDrawer();
  document.getElementById('catMgrBtn').onclick = openCategoryManager;
  document.addEventListener('click', e => {
    const edit = e.target.closest('[data-edit-prod]');
    if (edit) {
      const pId = edit.dataset.editProd;
      const cachedProds = JSON.parse(localStorage.getItem('hh_products') || '[]');
      const target = cachedProds.find(p => p.id === pId);
      openProductDrawer(target);
    }
    const del = e.target.closest('[data-del-prod]');
    if (del && confirm('Delete this product permanently from the live database?')) {
      if (window.SB && SB.ready) {
        SB.deleteProduct(del.dataset.delProd).then(() => {
          toast('Deleted from database universally');
          renderProducts();
        });
      } else {
        Store.deleteProduct(del.dataset.delProd);
        toast('Deleted locally');
        renderProducts();
      }
    }
  });
}
function renderProducts() {
  const q = (document.getElementById('prodSearch').value || '').toLowerCase();
  const tp = {}; Store.topProducts(999).forEach(p => tp[p.id] = p);
  const all = Store.getProducts();
  const rows = all.filter(p => (p.name + ' ' + (p.category||'')).toLowerCase().includes(q));
  document.getElementById('prodCount').textContent = all.length;
  document.getElementById('prodBody').innerHTML = rows.length ? rows.map(p => {
    const s = tp[p.id] || { qty:0, revenue:0 };
    const badgeCls = p.badge==='New'?'pill-blue':p.badge==='Best Seller'?'pill-green':'pill-grey';
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:10px">
        <div style="width:44px;height:44px;border-radius:8px;overflow:hidden;background:var(--cream-2);display:flex;align-items:center;justify-content:center">${productMedia(p,'80%')}</div>
        <b>${esc(p.name)}</b>${p.kind==='jersey'?'<span class="pill pill-grey" style="margin-left:2px">Jersey</span>':''}</div></td>
      <td>${esc(p.category||'—')}</td><td>${money(p.price)}</td><td>${s.qty}</td><td>${money(s.revenue)}</td>
      <td><span class="pill ${badgeCls}">${esc(p.badge||'Active')}</span></td>
      <td style="white-space:nowrap">
        <button class="eye" data-edit-prod="${esc(p.id)}" title="Edit">${ic('settings',16)}</button>
        <button class="eye" data-del-prod="${esc(p.id)}" title="Delete" style="color:var(--red);margin-left:6px">${ic('x',16)}</button>
      </td></tr>`;
  }).join('') : `<tr><td colspan="7"><div class="empty">No products yet. Click <b>Add Product</b> to post your first t-shirt.</div></td></tr>`;
}

/* ----- Add / Edit product form (supports multiple designs when adding) ----- */
let designRows = [];   // [{name, price, image}]
function openProductForm(editId) {
  const editing = editId ? Store.getProducts().find(p => p.id === editId) : null;
  designRows = editing
    ? [{ name: editing.name, price: editing.price, image: editing.image }]
    : [{ name:'', price:'', image:null }];
  document.getElementById('overlay').classList.add('show');
  const cats = Store.getCategories();
  const catOpts = cats.map(c => `<option ${editing && editing.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('');
  const badgeOpts = ['','New','Best Seller'].map(b => `<option value="${b}" ${editing && (editing.badge||'')===b ? 'selected':''}>${b || 'No badge'}</option>`).join('');
  const sizeChecks = HH.sizes.map(sz => {
    const on = editing ? (editing.sizes||[]).includes(sz) : ['M','L','XL'].includes(sz);
    return `<label class="sizechk"><input type="checkbox" value="${sz}" ${on?'checked':''}> ${sz}</label>`;
  }).join('');
  document.getElementById('drawer').innerHTML = `
    <div class="dh"><h3>${editing ? 'Edit product' : 'Add new t-shirt'}</h3><button class="close" id="closeDrawer">${ic('x',18)}</button></div>
    <div class="dgroup"><div class="t">Product type</div>
      <div class="sizes-row">
        <label class="sizechk"><input type="radio" name="pKind" value="tshirt" ${(!editing || editing.kind !== 'jersey') ? 'checked' : ''}> T-shirt / Hoodie</label>
        <label class="sizechk"><input type="radio" name="pKind" value="jersey" ${(editing && editing.kind === 'jersey') ? 'checked' : ''}> Jersey</label>
      </div>
      <small style="color:var(--muted);display:block;margin-top:6px">Jerseys show on the dedicated <b>Jersey</b> page; the rest show on the home page.</small></div>
    <div class="dgroup"><div class="t">Category</div>
      <input id="pCat" list="pCatList" placeholder="Type or pick a category (e.g. Oversized Tees)" value="${editing ? esc(editing.category||'') : ''}" style="width:100%;padding:11px 13px;border:1px solid var(--line);border-radius:10px">
      <datalist id="pCatList">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <small style="color:var(--muted);display:block;margin-top:6px">New categories are created automatically and shown on the home page.</small></div>
    <div class="dgroup"><div class="t">Available sizes</div><div class="sizes-row">${sizeChecks}</div></div>
    <div class="dgroup"><div class="t">Badge (optional)</div><select id="pBadge">${badgeOpts}</select></div>
    <div class="dgroup"><div class="t">${editing ? 'Design' : 'Designs & prices'}</div>
      <div id="designList"></div>
      ${editing ? '' : `<button class="btn btn-light btn-block" id="addDesign" style="margin-top:6px">${ic('plus',15)} Add another design</button>`}
    </div>
    <button class="btn btn-dark btn-block btn-lg" id="saveProd">${editing ? 'Save changes' : 'Publish to store'}</button>
    <small style="color:var(--muted);display:block;margin-top:10px;text-align:center">Products appear instantly on the home page.</small>`;
  renderDesignRows(!!editing);
  document.getElementById('closeDrawer').onclick = closeDrawer;
  const addBtn = document.getElementById('addDesign');
  if (addBtn) addBtn.onclick = () => { designRows.push({ name:'', price:'', image:null }); renderDesignRows(false); };
  document.getElementById('saveProd').onclick = () => saveProduct(editing);
}
function renderDesignRows(single) {
  syncDesignInputs();
  document.getElementById('designList').innerHTML = designRows.map((d, i) => `
    <div class="design-row" data-i="${i}">
      <div class="design-img" data-pick="${i}">${d.image ? `<img src="${d.image}">` : `${ic('plus',18)}<span>Photo</span>`}</div>
      <div style="flex:1">
        <input class="d-name" placeholder="Design name (e.g. Abstract Oversized Tee)" value="${esc(d.name)}">
        <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
          <input class="d-price" type="number" min="0" placeholder="Price ৳" value="${d.price}" style="flex:1">
          ${(!single && designRows.length > 1) ? `<button class="btn btn-light d-rm" data-rm="${i}" style="padding:8px 10px;color:var(--red)">${ic('x',15)}</button>` : ''}
        </div>
      </div>
      <input type="file" accept="image/*" class="d-file" data-file="${i}" hidden>
    </div>`).join('');
  document.querySelectorAll('.design-img').forEach(el => el.onclick = () => document.querySelector(`[data-file="${el.dataset.pick}"]`).click());
  document.querySelectorAll('.d-file').forEach(inp => inp.onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { syncDesignInputs(); designRows[+inp.dataset.file].image = await resizeImage(f); renderDesignRows(single); }
    catch { toast('Could not read that image'); }
  });
  document.querySelectorAll('.d-rm').forEach(b => b.onclick = () => { syncDesignInputs(); designRows.splice(+b.dataset.rm, 1); renderDesignRows(single); });
}
function syncDesignInputs() {
  document.querySelectorAll('.design-row').forEach(row => {
    const i = +row.dataset.i;
    if (!designRows[i]) return;
    designRows[i].name = row.querySelector('.d-name').value;
    designRows[i].price = row.querySelector('.d-price').value;
  });
}
async function saveProduct(editing) {
  syncDesignInputs();
  toast('Syncing with database...');

  const category = (document.getElementById('pCat').value || '').trim();
  const badge = document.getElementById('pBadge').value || null;
  const kind = (document.querySelector('input[name=pKind]:checked') || {}).value || 'tshirt';
  const sizes = [...document.querySelectorAll('.sizes-row input[type=checkbox]:checked')].map(c => c.value);
  const valid = designRows.filter(d => d.name.trim() && Number(d.price) > 0);

  if (!category) return toast('Enter a category');
  if (!valid.length) return toast('Add a design name and price');

  try {
    // 1. Ensure category rule exists in cloud first
    if (window.SB && SB.ready) {
      await SB.addCategory(category);
    }

    if (editing) {
      const d = valid[0];
      const patch = {
        name: d.name.trim(),
        price: Number(d.price),
        image: d.image,
        category,
        badge,
        sizes,
        kind
      };

      if (window.SB && SB.ready) {
        await SB.updateProduct(editing.id, patch);
      } else {
        Store.updateProduct(editing.id, patch);
      }
      toast('Product updated globally!');
    } else {
      // Create new entries formatted precisely
      const listToCreate = valid.map(d => ({
        name: d.name.trim(),
        price: Number(d.price),
        image: d.image,
        category,
        badge,
        sizes,
        kind
      }));

      if (window.SB && SB.ready) {
        await SB.createProducts(listToCreate);
      } else {
        listToCreate.forEach(p => Store.addProduct(p));
      }
      toast(`${valid.length} design(s) published live!`);
    }

    closeDrawer();
    refreshCurrent();

  } catch (err) {
    console.error("❌ CLOUD SAVE FAILURE:", err);
    alert("Could not sync data: " + err.message);
  }
}
function openCategoryManager() {
  document.getElementById('overlay').classList.add('show');
  const draw = () => {
    document.getElementById('drawer').innerHTML = `
      <div class="dh"><h3>Categories</h3><button class="close" id="closeDrawer">${ic('x',18)}</button></div>
      <div class="dgroup"><div class="t">Add category</div>
        <div style="display:flex;gap:8px"><input id="newCatName" placeholder="e.g. Winter Collection" style="flex:1;padding:11px 13px;border:1px solid var(--line);border-radius:10px">
        <button class="btn btn-dark" id="addCatBtn">Add</button></div></div>
      <div class="dgroup"><div class="t">Your categories</div>
        ${Store.getCategories().map(c => {
          const count = Store.getProducts().filter(p => p.category === c).length;
          return `<div class="kv"><span>${esc(c)} <small style="color:var(--muted-2)">(${count})</small></span>
            <button class="btn btn-light" data-del-cat="${esc(c)}" style="padding:5px 9px;color:var(--red)">${ic('x',14)}</button></div>`;
        }).join('')}</div>`;
    document.getElementById('closeDrawer').onclick = closeDrawer;
    document.getElementById('addCatBtn').onclick = async () => { const v = document.getElementById('newCatName').value; if (!v.trim()) return; if (window.SB) await SB.addCategory(v); else Store.addCategory(v); draw(); };
    document.querySelectorAll('[data-del-cat]').forEach(b => b.onclick = async () => { if (window.SB) await SB.removeCategory(b.dataset.delCat); else Store.removeCategory(b.dataset.delCat); draw(); });
  };
  draw();
}

/* ---------- CUSTOMERS ---------- */
function wireCustomers() {
  document.getElementById('custSearch').addEventListener('input', renderCustomers);
  document.getElementById('custExport').onclick = () => {
    const c = Store.customers();
    const head = ['Name','Phone','City','District','Address','Orders','Total Spent','Collected','Last Order'];
    const q = s => `"${String(s??'').replace(/"/g,'""')}"`;
    const lines = c.map(x => [x.name,x.phone,x.city,x.district,x.address,x.orders,x.spent,x.collected,fmtDate(x.last)].map(q).join(','));
    download(`halfhata-customers-${Date.now()}.csv`, [head.join(','), ...lines].join('\n'));
    toast(`Exported ${c.length} customers`);
  };
}
function renderCustomers() {
  const q = (document.getElementById('custSearch').value || '').toLowerCase();
  let c = Store.customers().filter(x => (x.name + x.phone + x.city).toLowerCase().includes(q));
  document.getElementById('custCount').textContent = Store.customers().length + ' customers';
  document.getElementById('custBody').innerHTML = c.length ? c.map(x => `
    <tr><td><b>${esc(x.name)}</b></td><td>${esc(x.phone)}</td><td>${esc(x.city)}</td><td>${x.orders}</td>
      <td>${money(x.spent)}</td><td>${money(x.collected)}</td><td>${fmtDate(x.last)}</td></tr>`).join('')
    : `<tr><td colspan="7"><div class="empty">No customers found.</div></td></tr>`;
}

/* ---------- ORDER DRAWER ---------- */
function openDrawer(id) {
  const o = Store.getOrder(id);
  document.getElementById('overlay').classList.add('show');
  const courierOpts = HH.couriers.map(c => `<option ${o.courier?.service===c?'selected':''}>${c}</option>`).join('');
  document.getElementById('drawer').innerHTML = `
    <div class="dh"><h3>#${esc(o.id)}</h3><button class="close" id="closeDrawer">${ic('x',18)}</button></div>
    <div style="display:flex;gap:8px;margin-bottom:16px"><span class="pill ${statusPill[o.status]}">${o.status}</span><span class="pill pill-grey">${esc(o.payment.label)}</span></div>
    <div class="dgroup"><div class="t">Customer</div>
      <div class="kv"><span>Name</span><b>${esc(o.customer.name)}</b></div>
      <div class="kv"><span>Phone</span><b>${esc(o.customer.phone)}</b></div>
      <div class="kv"><span>Address</span><b style="text-align:right;max-width:62%">${esc(o.customer.address)}, ${esc(o.customer.city)}, ${esc(o.customer.district)}</b></div></div>
    <div class="dgroup"><div class="t">Items</div>
      ${o.items.map(it => `<div class="kv"><span>${esc(it.name)} · ${esc(it.size)} ×${it.qty}</span><b>${money(it.price*it.qty)}</b></div>`).join('')}
      <div class="kv" style="border-top:1px solid var(--line);margin-top:8px;padding-top:10px"><span>Subtotal</span><b>${money(o.subtotal)}</b></div>
      <div class="kv"><span>Delivery</span><b>${money(o.delivery)}</b></div>
      <div class="kv"><span>Total</span><b>${money(o.total)}</b></div>
      <div class="kv"><span>Advance paid ${o.payment.txnId?`(Txn ${esc(o.payment.txnId)})`:''}</span><b>${money(o.payment.paid)}</b></div>
      <div class="kv"><span>Due on delivery</span><b>${money(o.payment.due)}</b></div></div>
    <div class="dgroup"><div class="t">Assign Courier & Tracking</div>
      <div class="field"><label>Courier Service</label><select id="dCourier">${courierOpts}</select></div>
      <div class="field"><label>Tracking ID</label><input id="dTrack" value="${esc(o.courier?.trackingId||'')}" placeholder="Courier tracking number"></div>
      <button class="btn btn-dark btn-block" id="dAssign">${ic('truck',16)} Ship & Notify Customer</button>
      <small style="color:var(--muted);display:block;margin-top:8px">Marks the order "On Courier" and sends the tracking notification to the customer's account.</small></div>
    <div class="dgroup"><div class="t">Update Status</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${['Pending','On Courier','Delivered','Cancelled'].map(s => `<button class="btn btn-light" data-status="${s}" style="flex:1">${s}</button>`).join('')}</div></div>
    <div class="dgroup"><div class="t">Timeline</div><div class="timeline">${o.timeline.slice().reverse().map(t => `<div class="tl"><b>${esc(t.status)}</b><small>${fmtTime(t.at)}${t.note?' · '+esc(t.note):''}</small></div>`).join('')}</div></div>`;
  document.getElementById('closeDrawer').onclick = closeDrawer;
  document.getElementById('dAssign').onclick = () => {
    const svc = document.getElementById('dCourier').value, tid = document.getElementById('dTrack').value.trim();
    if (!tid) return toast('Enter a tracking ID');
    Store.assignCourier(o.id, svc, tid); toast(`Customer notified · ${svc} ${tid}`); refreshCurrent(); openDrawer(o.id);
  };
  document.querySelectorAll('[data-status]').forEach(b => b.onclick = () => { Store.setStatus(o.id, b.dataset.status); toast(`Status → ${b.dataset.status}`); refreshCurrent(); openDrawer(o.id); });
}
function closeDrawer(){ document.getElementById('overlay').classList.remove('show'); }
document.getElementById('overlay').addEventListener('click', e => { if (e.target.id === 'overlay') closeDrawer(); });
function refreshCurrent(){ ({ dashboard:renderDashboard, orders:renderOrders, products:renderProducts, customers:renderCustomers }[state.view] || (()=>{}))(); updateAlerts(); }

/* auto-refresh: pick up new orders when the tab regains focus + every 15s */
window.addEventListener('focus', () => {
  if (Store.isAdmin() && document.getElementById('app').style.display !== 'none') refreshCurrent();
});
setInterval(() => {
  if (Store.isAdmin() && document.getElementById('app').style.display !== 'none'
      && !document.getElementById('overlay').classList.contains('show')) refreshCurrent();
}, 15000);
