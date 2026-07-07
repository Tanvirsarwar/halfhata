/* ============ HALFHATA — Client store (mock API over localStorage) ============
   In production every method below maps 1:1 to a Supabase query / RPC.
   Kept sync + local so the prototype runs with zero setup.                     */
const Store = (() => {
  const K = { cart:'hh_cart', orders:'hh_orders', user:'hh_user', seq:'hh_seq' };
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  /* ---- cart ---- */
  const getCart = () => read(K.cart, []);
  const cartCount = () => getCart().reduce((n, i) => n + i.qty, 0);
  const cartLines = () => getCart().map(i => ({ ...i, product: productById(i.id) }))
                            .filter(l => l.product)
                            .map(l => ({ ...l, lineTotal: l.product.price * l.qty }));
  const cartSubtotal = () => cartLines().reduce((s, l) => s + l.lineTotal, 0);

  function addToCart(id, { size = null, color = null } = {}) {
    const p = productById(id); if (!p) return cartCount();
    size = size || (p.sizes && p.sizes[0]) || 'M';
    const cart = getCart();
    const key = i => i.id === id && i.size === size;
    const ex = cart.find(key);
    if (ex) ex.qty++; else cart.push({ id, qty: 1, size, color: color || p.color });
    write(K.cart, cart); return cartCount();
  }
  function setSize(id, oldSize, newSize) {
    const cart = getCart();
    const line = cart.find(i => i.id === id && i.size === oldSize); if (!line) return;
    const existing = cart.find(i => i.id === id && i.size === newSize && i !== line);
    if (existing) { existing.qty += line.qty; cart.splice(cart.indexOf(line), 1); }
    else line.size = newSize;
    write(K.cart, cart);
  }
  function setQty(id, size, qty) {
    let cart = getCart();
    cart = cart.map(i => (i.id === id && i.size === size ? { ...i, qty } : i)).filter(i => i.qty > 0);
    write(K.cart, cart);
  }
  function removeLine(id, size) { write(K.cart, getCart().filter(i => !(i.id === id && i.size === size))); }
  function clearCart() { write(K.cart, []); }

  /* ---- user ---- */
  const getUser = () => read(K.user, null);
  const setUser = u => write(K.user, u);
  const logout = () => localStorage.removeItem(K.user);

  /* ---- customer accounts (email + password, hashed) ---- */
  const getUsers = () => read('hh_users', {});
  async function registerUser(email, password) {
    email = (email || '').trim().toLowerCase();
    const users = getUsers();
    if (users[email]) return { ok:false, error:'An account with this email already exists — please log in.' };
    users[email] = { email, passHash: await sha256(password), createdAt: new Date().toISOString() };
    write('hh_users', users);
    setUser({ ...(getUser() || {}), email, provider:'email' });
    return { ok:true };
  }
  async function loginUser(email, password) {
    email = (email || '').trim().toLowerCase();
    const u = getUsers()[email];
    if (!u) return { ok:false, error:'No account found with this email.' };
    if (await sha256(password) !== u.passHash) return { ok:false, error:'Incorrect password.' };
    setUser({ ...(getUser() || {}), email, name:u.name || '', provider:'email' });
    return { ok:true };
  }
  function loginGoogle(email) {
    setUser({ ...(getUser() || {}), email:(email || '').trim().toLowerCase(), provider:'google' });
    return { ok:true };
  }

  /* ---- orders ---- */
  const getOrders = () => read(K.orders, []);
  function nextId() { const n = read(K.seq, 1287) + 1; write(K.seq, n); return 'HALF' + n; }

  function placeOrder({ customer, payment }) {
    const lines = cartLines();
    const subtotal = cartSubtotal();
    const delivery = HH.deliveryCharge;
    const total = subtotal + delivery;
    const paid = payment.method === 'full' ? total : Number(payment.amount || HH.codMinAdvance);
    const now = new Date().toISOString();
    const order = {
      id: nextId(), createdAt: now,
      customer,
      items: lines.map(l => ({ id:l.id, name:l.product.name, price:l.product.price, qty:l.qty, size:l.size, color:l.color, image:l.product.image || null })),
      subtotal, delivery, total,
      payment: {
        method: payment.method, channel: payment.channel || null,
        paid, due: total - paid, txnId: payment.txnId || null, screenshot: payment.screenshot || null,
        label: payment.method === 'full' ? 'Full Paid' : (paid > HH.codMinAdvance ? 'Partial Paid' : 'Cash on Delivery'),
      },
      status: 'Pending',
      courier: null,
      notifications: [],
      timeline: [{ status:'Order Placed', at:now, note:`Advance ${money(paid)} received. Due ${money(total - paid)}.` }],
    };
    order.notifications.push({ id: order.id + '-0', at: now, title: 'Order received ✅',
      body: `We got order #${order.id}. We'll confirm on WhatsApp shortly. Due on delivery: ${money(total - paid)}.` });
    const orders = getOrders(); orders.unshift(order); write(K.orders, orders);
    clearCart();
    return order;
  }
  const getOrder = id => getOrders().find(o => o.id === id || ('#'+o.id) === id || o.id === id.replace('#',''));

  /* ---- admin actions ---- */
  function updateOrder(id, patch) {
    const orders = getOrders();
    const o = orders.find(x => x.id === id); if (!o) return;
    Object.assign(o, patch); write(K.orders, orders); return o;
  }
  function assignCourier(id, service, trackingId) {
    const o = getOrder(id); if (!o) return;
    const at = new Date().toISOString();
    o.courier = { service, trackingId };
    o.status = 'On Courier';
    o.timeline.push({ status:'Handed to Courier', at, note:`${service} — Tracking ${trackingId}` });
    // in-account customer notification (production: notifications table + Realtime)
    o.notifications.push({ id:`${o.id}-${o.notifications.length}`, at, title:'Your order is on the way 🚚',
      body:`Order #${o.id} shipped via ${service}. Track ID: ${trackingId}` });
    return updateOrder(id, o);
  }
  function setStatus(id, status) {
    const o = getOrder(id); if (!o) return;
    const at = new Date().toISOString();
    o.status = status;
    o.timeline.push({ status, at, note:'' });
    const nid = () => `${o.id}-${o.notifications.length}`;
    if (status === 'Delivered') o.notifications.push({ id:nid(), at, title:'Delivered ✅', body:`Order #${o.id} has been delivered. Thank you for choosing halfhata!` });
    if (status === 'Cancelled') o.notifications.push({ id:nid(), at, title:'Order cancelled', body:`Order #${o.id} was cancelled. Contact us for a refund of any advance paid.` });
    return updateOrder(id, o);
  }

  /* ---- in-account notifications (aggregated across the user's orders) ---- */
  const matchUser = (c, u) =>
    (u.phone && c.phone === u.phone) || (u.email && c.email && c.email === u.email) || (u.name && c.name === u.name);
  const readSet = () => new Set(read('hh_notif_read', []));
  function userOrders() { const u = getUser(); return u ? getOrders().filter(o => matchUser(o.customer, u)) : []; }
  function userNotifications() {
    const rs = readSet(); const list = [];
    userOrders().forEach(o => o.notifications.forEach((n, i) => {
      const nid = n.id || `${o.id}-${i}`;
      list.push({ ...n, id: nid, orderId: o.id, read: rs.has(nid) });
    }));
    return list.sort((a, b) => new Date(b.at) - new Date(a.at));
  }
  const unreadCount = () => userNotifications().filter(n => !n.read).length;
  function markAllRead() { write('hh_notif_read', userNotifications().map(n => n.id)); }

  /* ---- analytics (dashboard) ---- */
  const paidRevenue = o => o.payment.paid;                    // money actually collected
  const grossRevenue = o => o.status === 'Cancelled' ? 0 : o.total;
  function analytics() {
    const o = getOrders();
    const active = o.filter(x => x.status !== 'Cancelled');
    const collected = o.reduce((s, x) => s + paidRevenue(x), 0);
    const gross = active.reduce((s, x) => s + x.total, 0);
    const delivered = o.filter(x => x.status === 'Delivered');
    return {
      orders: o.length,
      revenueGross: gross,
      revenueCollected: collected,
      due: active.reduce((s, x) => s + x.payment.due, 0),
      aov: active.length ? Math.round(gross / active.length) : 0,
      pending: o.filter(x => x.status === 'Pending').length,
      onCourier: o.filter(x => x.status === 'On Courier').length,
      delivered: delivered.length,
      cancelled: o.filter(x => x.status === 'Cancelled').length,
      customers: new Set(o.map(x => x.customer.phone)).size,
      deliveryRate: o.length ? Math.round(delivered.length / o.length * 100) : 0,
    };
  }
  function revenueSeries(days = 14) {
    const o = getOrders(); const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const sum = o.filter(x => { const t = new Date(x.createdAt); return t >= d && t < next && x.status !== 'Cancelled'; })
                   .reduce((s, x) => s + x.total, 0);
      out.push({ label: d.toLocaleDateString('en-GB', { day:'numeric', month:'short' }), value: sum });
    }
    return out;
  }
  function statusSplit() {
    const o = getOrders();
    return ['Pending','On Courier','Delivered','Cancelled'].map(s => ({ label: s, value: o.filter(x => x.status === s).length }));
  }
  function paymentSplit() {
    const o = getOrders();
    return ['Cash on Delivery','Partial Paid','Full Paid'].map(l => ({ label: l, value: o.filter(x => x.payment.label === l).length }));
  }
  function topProducts(n = 5) {
    const map = {};
    getOrders().filter(o => o.status !== 'Cancelled').forEach(o => o.items.forEach(it => {
      map[it.id] = map[it.id] || { id: it.id, name: it.name, qty: 0, revenue: 0 };
      map[it.id].qty += it.qty; map[it.id].revenue += it.price * it.qty;
    }));
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, n);
  }
  function customers() {
    const map = {};
    getOrders().forEach(o => {
      const k = o.customer.phone || o.customer.name;
      map[k] = map[k] || { name:o.customer.name, phone:o.customer.phone, city:o.customer.city, district:o.customer.district,
                           address:o.customer.address, orders:0, spent:0, collected:0, last:o.createdAt };
      map[k].orders++; map[k].spent += (o.status === 'Cancelled' ? 0 : o.total); map[k].collected += o.payment.paid;
      if (new Date(o.createdAt) > new Date(map[k].last)) { map[k].last = o.createdAt; map[k].address = o.customer.address; }
    });
    return Object.values(map).sort((a, b) => b.spent - a.spent);
  }
  function recentActivity(n = 8) {
    const acts = [];
    getOrders().forEach(o => o.timeline.forEach(t => acts.push({ orderId:o.id, name:o.customer.name, status:t.status, at:t.at })));
    return acts.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, n);
  }

  /* ---- admin gate ----
     Password stored as a SHA-256 hash (not plaintext) so viewing the source
     no longer reveals it. Still a CLIENT gate for demo use — real protection
     is Supabase Auth + the is_admin() RLS in schema.sql. */
  const ADMIN_HASH = 'a2d0bcf6921f75cd43d45d6a63a6d919e85e9595de9224e2d8783d5a1e0cc7ab';
  async function sha256(str) {
    if (self.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return null;
  }
  const isAdmin = () => localStorage.getItem('hh_admin') === '1';
  async function adminLogin(pw) {
    const h = await sha256(pw);
    if (h === ADMIN_HASH) { localStorage.setItem('hh_admin', '1'); return true; }
    return false;
  }
  function adminLogout() { localStorage.removeItem('hh_admin'); }
  /* wipe EVERYTHING for a clean fresh launch */
  function resetAllData() {
    ['hh_cart','hh_orders','hh_user','hh_seq','hh_products','hh_categories','hh_notif_read','hh_users'].forEach(k => localStorage.removeItem(k));
  }

  /* ---- PRODUCTS + CATEGORIES (admin-managed, start empty) ---- */
  function getCategories() { return read('hh_categories', []); }
  function addCategory(name) {
    name = (name || '').trim(); if (!name) return getCategories();
    const c = getCategories();
    if (!c.some(x => x.toLowerCase() === name.toLowerCase())) { c.push(name); write('hh_categories', c); }
    return c;
  }
  function removeCategory(name) { write('hh_categories', getCategories().filter(c => c !== name)); }

  const getProducts = () => read('hh_products', []);
  const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  function addProduct(p) {
    const list = getProducts();
    const id = (slugify(p.name) || 'item') + '-' + Math.random().toString(36).slice(2, 6);
    const prod = {
      id, name: p.name.trim(), category: p.category || getCategories()[0],
      kind: p.kind || 'tshirt',
      price: Number(p.price) || 0, sizes: p.sizes && p.sizes.length ? p.sizes : ['M','L','XL'],
      image: p.image || null, badge: p.badge || null, color: p.color || '#141416', type: p.type || 'tee',
      active: p.active !== false, createdAt: new Date().toISOString(),
    };
    list.unshift(prod); write('hh_products', list); return prod;
  }
  function updateProduct(id, patch) {
    const list = getProducts(); const p = list.find(x => x.id === id); if (!p) return;
    Object.assign(p, patch); write('hh_products', list); return p;
  }
  function deleteProduct(id) { write('hh_products', getProducts().filter(p => p.id !== id)); }

  /* seed() — intentionally empty. No assumed data anywhere. */
  function seed() {}

  /* one-time clean upgrade: erase any legacy demo/seed/test data left in this
     browser from earlier versions, so the site loads truly fresh. Runs once. */
  const DATA_VERSION = '2026-07-04-fresh';
  if (localStorage.getItem('hh_version') !== DATA_VERSION) {
    resetAllData();
    localStorage.setItem('hh_version', DATA_VERSION);
  }

  return { getCart, cartCount, cartLines, cartSubtotal, addToCart, setQty, setSize, removeLine, clearCart,
           getUser, setUser, logout, registerUser, loginUser, loginGoogle,
           getOrders, getOrder, placeOrder, updateOrder, assignCourier, setStatus, seed,
           userOrders, userNotifications, unreadCount, markAllRead,
           analytics, revenueSeries, statusSplit, paymentSplit, topProducts, customers, recentActivity,
           isAdmin, adminLogin, adminLogout, resetAllData,
           getProducts, addProduct, updateProduct, deleteProduct,
           getCategories, addCategory, removeCategory };
})();

/* tiny shared helpers */
/* resizeImage(): compress an uploaded image to a small dataURL so it fits localStorage */
function resizeImage(file, max = 700, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image failed'));
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
        else if (h > max) { w = Math.round(w * max / h); h = max; }
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
/* esc(): prevents stored XSS — always wrap user-supplied strings before innerHTML */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
/* ---- inline SVG charts (no libraries) ---- */
function svgLineArea(data, w = 520, h = 150) {
  const max = Math.max(1, ...data.map(d => d.value));
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((d, i) => [i * step, h - (d.value / max) * (h - 24) - 8]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = `M0 ${h} ` + pts.map(p => 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + ` L${w} ${h} Z`;
  const dots = pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="#141416"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="none" style="overflow:visible">
    <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141416" stop-opacity=".14"/><stop offset="1" stop-color="#141416" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#ga)"/><path d="${line}" fill="none" stroke="#141416" stroke-width="2"/>${dots}</svg>`;
}
function svgDonut(data, size = 150) {
  const colors = { 'Pending':'#b7791f','On Courier':'#2563eb','Delivered':'#16a34a','Cancelled':'#dc2626',
                   'Cash on Delivery':'#6b7280','Partial Paid':'#2563eb','Full Paid':'#16a34a' };
  const total = data.reduce((s, d) => s + d.value, 0);
  const denom = total || 1;
  const r = 54, cx = size/2, cy = size/2, C = 2 * Math.PI * r; let off = 0;
  const rings = data.filter(d => d.value).map(d => {
    const frac = d.value / denom, dash = frac * C;
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors[d.label]||'#999'}" stroke-width="16"
      stroke-dasharray="${dash.toFixed(1)} ${(C-dash).toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    off += dash; return seg;
  }).join('');
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${rings}
    <text x="${cx}" y="${cy-2}" text-anchor="middle" font-size="26" font-weight="800" fill="#141416">${total}</text>
    <text x="${cx}" y="${cy+16}" text-anchor="middle" font-size="11" fill="#6b6b70">total</text></svg>`;
}
function svgBars(data, w = 260, h = 150) {
  const max = Math.max(1, ...data.map(d => d.value)); const bw = w / data.length;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%">` + data.map((d, i) => {
    const bh = (d.value / max) * (h - 30), x = i * bw + bw*0.2, y = h - bh - 20;
    return `<rect x="${x}" y="${y}" width="${bw*0.6}" height="${bh}" rx="4" fill="#141416"/>
      <text x="${x+bw*0.3}" y="${h-6}" text-anchor="middle" font-size="10" fill="#6b6b70">${esc(d.label)}</text>
      <text x="${x+bw*0.3}" y="${y-5}" text-anchor="middle" font-size="10" font-weight="700" fill="#141416">${d.value}</text>`;
  }).join('') + `</svg>`;
}

function toast(msg) {
  let w = document.querySelector('.toast-wrap'); if (!w) { w = document.createElement('div'); w.className = 'toast-wrap'; document.body.appendChild(w); }
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; w.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
function ic(name, s = 20) { return ICONS[name] ? ICONS[name].replace('<svg ', `<svg width="${s}" height="${s}" `) : ''; }
const ICONS = {
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  cart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 13h11l2-9H6"/></svg>',
  heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-4.5-9.5-9C.8 8.5 2.5 5 6 5c2 0 3.2 1.2 4 2.5C10.8 6.2 12 5 14 5c3.5 0 5.2 3.5 3.5 7-2.5 4.5-9.5 9-9.5 9Z"/></svg>',
  heartFill:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.5-9.5-9C.8 8.5 2.5 5 6 5c2 0 3.2 1.2 4 2.5C10.8 6.2 12 5 14 5c3.5 0 5.2 3.5 3.5 7-2.5 4.5-9.5 9-9.5 9Z"/></svg>',
  arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
  wa:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.4A10 10 0 1 0 12 2Zm5 14c-.2.6-1.2 1.1-1.7 1.1-.5.1-1 .1-3-.8s-3.4-3.2-3.5-3.4c-.2-.2-1-1.3-1-2.4s.6-1.7.8-1.9c.2-.2.4-.3.6-.3h.4c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.5c-.1.2-.3.3-.1.6.2.3.7 1.2 1.6 1.9 1.1.9 1.4.9 1.7.8.2-.1.5-.6.7-.8.1-.2.3-.2.5-.1l1.8.9c.2.1.4.2.4.3.1.2.1.5 0 .9Z"/></svg>',
  mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  truck:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.7"/><circle cx="17.5" cy="18" r="1.7"/></svg>',
  shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 3v6c0 4-3 6.5-7 9-4-2.5-7-5-7-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  tee:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 4 4 7l2 3 2-1v9h8v-9l2 1 2-3-4-3-3 2-3-2z"/></svg>',
  wallet:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M16 12h3"/></svg>',
  box:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8l9-4 9 4-9 4-9-4z"/><path d="M3 8v8l9 4 9-4V8"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 13 4 4L19 7"/></svg>',
  checkCircle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
  dashboard:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/></svg>',
  orders:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  users:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M16 5.5a3 3 0 0 1 0 5.5M21 20c0-2.5-1.5-4-4-4.5"/></svg>',
  tag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>',
  chart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
  logout:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h9"/></svg>',
  filter:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>',
  download:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m-4-4 4 4 4-4M4 21h16"/></svg>',
  eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  google:'<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6a4.8 4.8 0 0 1-2 3.2v2.6h3.3c1.9-1.8 3-4.4 3-7.6z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.3-2.6c-.9.6-2 1-3.3 1-2.6 0-4.7-1.7-5.5-4H3.1v2.6A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.5 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1A10 10 0 0 0 2 12c0 1.6.4 3.2 1.1 4.6z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.5 10c.8-2.3 2.9-4 5.5-4z"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
};
