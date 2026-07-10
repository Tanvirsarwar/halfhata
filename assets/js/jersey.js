/* ============ Jersey page ============ */
const wish = new Set();
let activeCat = 'all';
const waLink = () => `https://wa.me/88${HH.phone}`;

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
      <button class="btn btn-dark btn-block add" data-add="${esc(p.id)}">Add to Cart ${ic('cart',16)}</button>
    </div>
  </div>`;
}
const emptyState = msg => `<div style="grid-column:1/-1;text-align:center;padding:50px;color:var(--muted)">${msg}</div>`;

function renderJerseys() {
  const all = Store.getProducts().filter(p => p.active !== false && p.kind === 'jersey');
  const cats = [...new Set(all.map(p => p.category).filter(Boolean))];
  document.getElementById('catChips').innerHTML = all.length
    ? ['all', ...cats].map(c => `<button class="chip ${activeCat===c?'on':''}" data-cat="${esc(c)}">${c==='all'?'All':esc(c)}</button>`).join('')
    : '';
  const filtered = activeCat === 'all' ? all : all.filter(p => p.category === activeCat);
  document.getElementById('gridJersey').innerHTML = filtered.length ? filtered.map(card).join('')
    : emptyState('No jerseys yet. Add jerseys from the admin dashboard → Products → Add Product → set Type to <b>Jersey</b>.');
}

function renderChrome() {
  document.getElementById('navSearch').innerHTML = ic('search', 22);
  document.getElementById('navBell').innerHTML = ic('bell', 22);
  document.getElementById('navUser').innerHTML = ic('user', 22);
  document.getElementById('navCart').innerHTML = ic('cart', 22);
  document.getElementById('obCartIc').innerHTML = ic('cart', 22);
  document.getElementById('obArrow').innerHTML = ic('arrow', 18);

  document.getElementById('footerChannels').innerHTML = `
    <a class="it" href="mailto:${HH.email}"><span class="ficon">${ic('mail',15)}</span><div><b>Email</b><small>${HH.email}</small></div></a>
    <a class="it" href="${waLink()}" target="_blank"><span class="ficon wa">${ic('wa',15)}</span><div><b>WhatsApp</b><small>${HH.phone}</small></div></a>`;

  const waEl = document.getElementById('waFloat');
  waEl.href = waLink(); waEl.innerHTML = ic('wa', 26); waEl.style.color = '#fff';
}

function refreshCart() {
  const n = Store.cartCount(), sub = Store.cartSubtotal();
  const badge = document.getElementById('navCartBadge');
  badge.textContent = n; badge.classList.toggle('hide', n === 0);
  document.getElementById('obCount').textContent = n;
  document.getElementById('obItems').textContent = `${n} item${n !== 1 ? 's' : ''} in cart`;
  document.getElementById('obTotal').textContent = money(sub);
  document.getElementById('orderbar').classList.toggle('show', n > 0);
}
function goCheckout() { if (Store.cartCount() === 0) return toast('Your cart is empty'); location.href = 'checkout.html'; }

document.addEventListener('click', e => {
  const add = e.target.closest('[data-add]');
  if (add) { Store.addToCart(add.dataset.add); refreshCart(); toast('Added to cart'); }
  const w = e.target.closest('[data-wish]');
  if (w) { const id = w.dataset.wish; wish.has(id) ? wish.delete(id) : wish.add(id);
    w.classList.toggle('on', wish.has(id)); w.innerHTML = ic(wish.has(id) ? 'heartFill' : 'heart', 18); }
  const chip = e.target.closest('[data-cat]');
  if (chip) { activeCat = chip.dataset.cat; renderJerseys(); }
});

/* notifications bell */
const timeAgo = iso => {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
};
function renderNotifs() {
  const list = Store.userNotifications(), unread = list.filter(n => !n.read).length;
  const badge = document.getElementById('navBellBadge');
  badge.textContent = unread; badge.classList.toggle('hide', unread === 0);
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
document.getElementById('navBell').onclick = e => { e.stopPropagation(); document.getElementById('notifMenu').classList.toggle('open'); renderNotifs(); };
document.getElementById('markRead').onclick = () => { Store.markAllRead(); renderNotifs(); };
document.addEventListener('click', e => { if (!e.target.closest('.notif-wrap')) document.getElementById('notifMenu').classList.remove('open'); });

renderChrome(); refreshCart(); renderNotifs();
(async () => { if (window.SB) await SB.loadCatalog(); renderJerseys(); })();
