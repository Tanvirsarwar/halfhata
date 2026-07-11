/* ============ Landing ============ */
/* safe setter: skips missing elements instead of crashing the page */
function put(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; return el; }

const wish = new Set();
let activeCat = 'all';

function card(p) {
  const badge = p.badge ? `<span class="badge pill pill-black">${esc(p.badge)}</span>` : '';
  return `<div class="card">
    <div class="thumb">
      ${badge}
      <button class="wish" data-wish="${esc(p.id)}" aria-label="wishlist">${ic('heart',18)}</button>
      ${productMedia(p)}
    </div>
    <div class="body">
      <div class="name">${esc(p.name)}</div>
      <div class="cat" style="color:var(--muted);font-size:12px">${esc(p.category || '')}</div>
      <div class="price">${money(p.price)}</div>
      ${p.in_stock === false
        ? `<button class="btn btn-block add oos-btn" disabled>Out of Stock</button>`
        : `<button class="btn btn-dark btn-block add" data-add="${esc(p.id)}">Add to Cart ${ic('cart',16)}</button>`}
    </div>
  </div>`;
}

const emptyState = msg => `<div style="grid-column:1/-1;text-align:center;padding:44px;color:var(--muted)">${msg}</div>`;

function renderGrids() {
  const all = Store.getProducts().filter(p => p.active !== false && p.kind !== 'jersey');

  // New Arrivals: show all products (newest first)
  document.getElementById('gridNew').innerHTML = all.length ? all.map(card).join('')
    : emptyState('No products yet. Add t-shirts from the admin dashboard → Products → Add Product.');

  // Best Sellers
  const best = all.filter(p => p.badge === 'Best Seller');
  const bestSection = document.getElementById('best');
  if (best.length) { bestSection.style.display = ''; document.getElementById('gridBest').innerHTML = best.slice(0, 5).map(card).join(''); }
  else if (bestSection) bestSection.style.display = 'none';
}

function renderChrome() {
  /* trust strip */
  put('trustRow', [
    ['truck','Free Delivery','On orders above ৳1,500'],
    ['refresh','Easy Returns','Hassle-free exchange'],
    ['lock','Secure Payment','bKash, Nagad & COD'],
    ['check','100% Authentic','Premium 175 GSM cotton'],
    ['wa','WhatsApp Support','0199210064'],
  ].map(([i,t,d]) => `<div class="ti"><div class="ic">${ic(i,20)}</div><div><b>${t}</b><small>${d}</small></div></div>`).join(''));

  /* hero slider */
  (function slider(){
    const slides = [...document.querySelectorAll('.hslide')];
    if (!slides.length) return;
    let cur = 0, timer;
    const count = document.getElementById('hsCount');
    function show(i){
      cur = (i + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle('on', k === cur));
      if (count) count.textContent = String(cur+1).padStart(2,'0') + ' / ' + String(slides.length).padStart(2,'0');
    }
    function auto(){ clearInterval(timer); timer = setInterval(() => show(cur+1), 5500); }
    const p = document.getElementById('hsPrev'), n = document.getElementById('hsNext');
    if (p) p.onclick = () => { show(cur-1); auto(); };
    if (n) n.onclick = () => { show(cur+1); auto(); };
    auto();
  })();
  put('navBell', ic('bell', 22));
  put('navUser', ic('user', 22));
  put('navCart', ic('cart', 22));
  put('heroArrow', ic('arrow', 18));
  put('va1', ic('arrow', 16));
  put('va2', ic('arrow', 16));
  put('obCartIc', ic('cart', 22));
  put('obArrow', ic('arrow', 18));

  put('footerChannels', `
    <a class="it" href="mailto:${HH.email}"><span class="ficon">${ic('mail',15)}</span><div><b>Email</b><small>${HH.email}</small></div></a>
    <a class="it" href="https://wa.me/88${HH.phone}" target="_blank"><span class="ficon wa">${ic('wa',15)}</span><div><b>WhatsApp</b><small>${HH.phone}</small></div></a>`);


  const wa = HH.channels[0];
  const waEl = document.getElementById('waFloat');
  if (waEl) { waEl.href = waLink(wa); waEl.innerHTML = ic('wa', 26); waEl.style.color = '#fff'; }
}
const waLink = c => c.key === 'whatsapp' ? `https://wa.me/88${c.number}` : '#';

function refreshCart() {
  const n = Store.cartCount(), sub = Store.cartSubtotal();
  const badge = document.getElementById('navCartBadge');
  if (badge) { badge.textContent = n; badge.classList.toggle('hide', n === 0); }
  const oc=document.getElementById('obCount'); if (oc) oc.textContent = n;
  const oi=document.getElementById('obItems'); if (oi) oi.textContent = `${n} item${n !== 1 ? 's' : ''} in cart`;
  const ot=document.getElementById('obTotal'); if (ot) ot.textContent = money(sub);
  const ob=document.getElementById('orderbar'); if (ob) ob.classList.toggle('show', n > 0);
}
function goCheckout() { if (Store.cartCount() === 0) return toast('Your cart is empty'); location.href = 'checkout.html'; }

document.addEventListener('click', e => {
  const add = e.target.closest('[data-add]');
  if (add) { openProductModal(add.dataset.add); }
  const w = e.target.closest('[data-wish]');
  if (w) { const id = w.dataset.wish; wish.has(id) ? wish.delete(id) : wish.add(id);
    w.classList.toggle('on', wish.has(id)); w.innerHTML = ic(wish.has(id) ? 'heartFill' : 'heart', 18); }
  const chip = e.target.closest('[data-cat]');
  if (chip) { activeCat = chip.dataset.cat; renderGrids(); }
});

/* ---- account notifications ---- */
const timeAgo = iso => {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
};
function renderNotifs() {
  const nl = document.getElementById('notifList'); if (!nl) return;
  const list = Store.userNotifications(), unread = list.filter(n => !n.read).length;
  const badge = document.getElementById('navBellBadge');
  if (badge) { badge.textContent = unread; badge.classList.toggle('hide', unread === 0); }
  document.getElementById('notifList').innerHTML = list.length ? list.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}">
      <span class="ni-dot"></span>
      <div><b>${esc(n.title)}</b><small>${esc(n.body)}</small>
        <a class="ni-track" href="track.html?id=${esc(n.orderId)}">Track order →</a>
        <div class="ni-time">${timeAgo(n.at)}</div>
      </div>
    </div>`).join('')
    : `<div class="notif-empty">No notifications yet.<br>Place an order to get delivery updates here.</div>`;
}
const _bell = document.getElementById('navBell');
if (_bell) _bell.onclick = e => {
  e.stopPropagation();
  const m = document.getElementById('notifMenu'); if (m) m.classList.toggle('open');
  renderNotifs();
};
const _mr = document.getElementById('markRead');
if (_mr) _mr.onclick = () => { Store.markAllRead(); renderNotifs(); };
document.addEventListener('click', e => {
  if (!e.target.closest('.notif-wrap')) document.getElementById('notifMenu').classList.remove('open');
});

renderChrome(); refreshCart(); renderNotifs();
(async () => { if (window.SB) await SB.loadCatalog(); renderGrids(); })();
