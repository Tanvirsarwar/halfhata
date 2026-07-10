/* ============ HALFHATA — Brand config + catalogue ============ */
const HH = {
  brand: 'halfhata',
  logo: 'assets/img/logo.jpeg',
  phone: '0199210064',
  email: 'halfhata1@gmail.com',
  channels: [
    { key: 'whatsapp', label: 'WhatsApp', number: '0199210064', color: '#25d366' },
    { key: 'nagad',    label: 'Nagad',    number: '0199210064', color: '#ee4d2d' },
    { key: 'bkash',    label: 'bKash',    number: '0199210064', color: '#e2136e' },
  ],
  deliveryCharge: 80,
  codMinAdvance: 120,
  couriers: ['Steadfast', 'Pathao', 'RedX', 'Sundarban', 'Manual'],
  districts: ['Bagerhat','Bandarban','Barguna','Barishal','Bhola','Bogura','Brahmanbaria','Chandpur','Chapainawabganj','Chattogram','Chuadanga','Cox\'s Bazar','Cumilla','Dhaka','Dinajpur','Faridpur','Feni','Gaibandha','Gazipur','Gopalganj','Habiganj','Jamalpur','Jashore','Jhalokathi','Jhenaidah','Joypurhat','Khagrachhari','Khulna','Kishoreganj','Kurigram','Kushtia','Lakshmipur','Lalmonirhat','Madaripur','Magura','Manikganj','Meherpur','Moulvibazar','Munshiganj','Mymensingh','Naogaon','Narail','Narayanganj','Narsingdi','Natore','Netrokona','Nilphamari','Noakhali','Pabna','Panchagarh','Patuakhali','Pirojpur','Rajbari','Rajshahi','Rangamati','Rangpur','Satkhira','Shariatpur','Sherpur','Sirajganj','Sunamganj','Sylhet','Tangail','Thakurgaon'],
  sizes: ['S','M','L','XL','XXL','XXXL','XXXXL'],
};

/* SVG garment illustration (no photo dependency) */
function garment(type, color, w = '74%') {
  const c = color, sh = shade(color, -18), pr = shade(color, -34);
  const body = type === 'hoodie'
    ? `<path d="M60 78 L60 52 Q60 40 74 34 L96 26 Q110 22 128 22 Q146 22 160 26 L182 34 Q196 40 196 52 L196 78 L176 86 L176 168 Q176 176 168 176 L88 176 Q80 176 80 168 L80 86 Z" fill="${c}"/>
       <path d="M96 26 Q128 54 160 26 L152 40 Q128 62 104 40 Z" fill="${sh}"/>
       <rect x="112" y="30" width="32" height="70" rx="16" fill="${pr}" opacity=".55"/>`
    : `<path d="M52 62 L92 34 Q112 26 128 40 Q144 26 164 34 L204 62 L188 92 L172 82 L172 172 Q172 178 166 178 L90 178 Q84 178 84 172 L84 82 L68 92 Z" fill="${c}"/>
       <path d="M96 34 Q128 60 160 34 L150 46 Q128 66 106 46 Z" fill="${sh}"/>`;
  const mark = `<text x="128" y="118" text-anchor="middle" font-family="Inter,sans-serif" font-size="17" font-weight="800" fill="${textOn(c)}" opacity=".85">halfhata</text>`;
  return `<svg class="tee" viewBox="0 0 256 210" style="width:${w}" xmlns="http://www.w3.org/2000/svg">${body}${mark}</svg>`;
}
function shade(hex, p){let{r,g,b}=hx(hex);const f=t=>Math.max(0,Math.min(255,Math.round(t+(t*p/100))));return `rgb(${f(r)},${f(g)},${f(b)})`;}
function hx(h){h=h.replace('#','');if(h.length===3)h=[...h].map(x=>x+x).join('');return{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)};}
function textOn(hex){const{r,g,b}=hx(hex.replace('rgb','').match(/[0-9a-fA-F]{3,6}/)?hex:hex);const L=(0.299*r+0.587*g+0.114*b);return L>150?'#1a1a1a':'#f5f5f5';}

/* Products are created by the admin (see Store.getProducts / addProduct).
   No seed catalogue — the store starts empty until you post t-shirts. */
const productById = id => Store.getProducts().find(p => p.id === id) || null;
const money = n => '৳' + Number(n).toLocaleString('en-IN');

/* product card image: uploaded design photo, or SVG fallback */
function productMedia(p, w = '74%') {
  const imgs = (p && p.images && p.images.length) ? p.images : (p && p.image ? [p.image] : []);
  if (imgs.length) {
    const dataAttr = ` class="pimg" data-pid="${esc(p.id)}" data-images='${JSON.stringify(imgs).replace(/'/g, "&#39;")}' data-name="${esc(p.name)}"`;
    const dots = imgs.length > 1 ? `<span class="img-dots">${imgs.map((_,i)=>`<i class="${i===0?'on':''}"></i>`).join('')}</span>` : '';
    return `<img src="${imgs[0]}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover"${dataAttr}>${dots}`;
  }
  return garment((p && p.type) || 'tee', (p && p.color) || '#141416', w);
}

/* ---- image lightbox: click a product photo to view it big, × to close ---- */
let _lbImgs = [], _lbI = 0;
function openLightbox(imgs, name, start = 0) {
  _lbImgs = imgs; _lbI = start;
  let lb = document.getElementById('lightbox');
  if (!lb) {
    lb = document.createElement('div'); lb.id = 'lightbox'; lb.className = 'lightbox';
    lb.innerHTML = `
      <button class="lb-close" aria-label="close">&times;</button>
      <button class="lb-prev" aria-label="previous">&#8249;</button>
      <img class="lb-img" alt="">
      <button class="lb-next" aria-label="next">&#8250;</button>
      <div class="lb-caption"></div>`;
    document.body.appendChild(lb);
    lb.querySelector('.lb-close').onclick = closeLightbox;
    lb.querySelector('.lb-prev').onclick  = e => { e.stopPropagation(); lbShow(_lbI - 1); };
    lb.querySelector('.lb-next').onclick  = e => { e.stopPropagation(); lbShow(_lbI + 1); };
    lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
    document.addEventListener('keydown', e => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') lbShow(_lbI - 1);
      if (e.key === 'ArrowRight') lbShow(_lbI + 1);
    });
  }
  lb.querySelector('.lb-caption').textContent = name || '';
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
  lbShow(start);
}
function lbShow(i) {
  const lb = document.getElementById('lightbox'); if (!lb) return;
  _lbI = (i + _lbImgs.length) % _lbImgs.length;
  lb.querySelector('.lb-img').src = _lbImgs[_lbI];
  const multi = _lbImgs.length > 1;
  lb.querySelector('.lb-prev').style.display = multi ? '' : 'none';
  lb.querySelector('.lb-next').style.display = multi ? '' : 'none';
}
function closeLightbox() {
  const lb = document.getElementById('lightbox'); if (!lb) return;
  lb.classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('click', e => {
  const img = e.target.closest('img.pimg'); if (!img) return;
  e.preventDefault(); e.stopPropagation();
  const p = img.dataset.pid && typeof productById === 'function' ? productById(img.dataset.pid) : null;
  if (p) openProductModal(p.id);
  else openLightbox(JSON.parse(img.dataset.images), img.dataset.name || '', 0);
});

/* ================= PRODUCT MODAL (details + mandatory size) ================= */
function descHtml(text) {
  if (!text) return '';
  const lines = String(text).split('\n').map(l => l.trim()).filter(Boolean);
  let out = '', inList = false;
  for (const l of lines) {
    if (l.startsWith('*') || l.startsWith('-')) {
      if (!inList) { out += '<ul>'; inList = true; }
      out += `<li>${esc(l.replace(/^[-*]\s*/, ''))}</li>`;
    } else {
      if (inList) { out += '</ul>'; inList = false; }
      out += `<p>${esc(l)}</p>`;
    }
  }
  if (inList) out += '</ul>';
  return out;
}

function openProductModal(id) {
  const p = productById(id); if (!p) return;
  const imgs = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
  const oos = p.in_stock === false;
  let m = document.getElementById('pmodal');
  if (!m) { m = document.createElement('div'); m.id = 'pmodal'; m.className = 'pmodal'; document.body.appendChild(m); }
  m.innerHTML = `
    <div class="pm-card">
      <button class="pm-close">&times;</button>
      <div class="pm-gallery">
        <div class="pm-main">${imgs.length ? `<img src="${imgs[0]}" id="pmMain">` : garment(p.type||'tee', p.color||'#141416', '70%')}
          ${oos ? '<span class="pm-oos">Out of Stock</span>' : ''}</div>
        ${imgs.length > 1 ? `<div class="pm-thumbs">${imgs.map((im,i)=>`<img src="${im}" data-pm="${i}" class="${i===0?'on':''}">`).join('')}</div>` : ''}
      </div>
      <div class="pm-info">
        <div class="pm-cat">${esc(p.category || '')}${p.badge ? ` · <span class="pill pill-black" style="font-size:10px">${esc(p.badge)}</span>` : ''}</div>
        <h2>${esc(p.name)}</h2>
        <div class="pm-price">${money(p.price)}</div>
        <div class="pm-desc">${descHtml(p.description) || '<p style="color:var(--muted)">Premium quality — crafted for comfort and built to last.</p>'}</div>
        <div class="pm-size-head">Select Size <span class="req">*</span></div>
        <div class="pm-sizes" id="pmSizes">
          ${(p.sizes && p.sizes.length ? p.sizes : ['M','L','XL']).map(sz => `<button class="pm-sz" data-sz="${esc(sz)}">${esc(sz)}</button>`).join('')}
        </div>
        <div class="pm-hint" id="pmHint">Please select a size to continue</div>
        <div class="pm-qty-row">
          <span class="pm-qty-label">Quantity</span>
          <div class="pm-qty">
            <button class="pm-qbtn" id="pmMinus">&minus;</button>
            <span class="pm-qn" id="pmQty">1</span>
            <button class="pm-qbtn" id="pmPlus">+</button>
          </div>
        </div>
        <button class="btn btn-dark btn-block btn-lg" id="pmAdd" ${oos ? 'disabled' : ''}>${oos ? 'Out of Stock' : `Add to Cart&nbsp; ${ic('cart',18)}`}</button>
        ${(() => { const ch = SIZE_CHARTS[p.kind === 'jersey' ? 'jersey' : 'tshirt']; return `
        <div class="pm-chart-wrap">
          <div class="pm-chart-title">${ch.title}</div>
          <table class="sc-table">
            <thead><tr>${ch.cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
            <tbody>${ch.rows.map(r => `<tr>${r.map((v,i) => i===0?`<td><b>${v}</b></td>`:`<td>${v}"</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
          <p class="sc-note">${ch.note}</p>
        </div>`; })()}
      </div>
    </div>`;
  m.classList.add('open');
  document.body.style.overflow = 'hidden';

  let chosen = null, qty = 1;
  const qEl = document.getElementById('pmQty');
  const minus = document.getElementById('pmMinus'), plus = document.getElementById('pmPlus');
  if (minus) minus.onclick = () => { qty = Math.max(1, qty - 1); qEl.textContent = qty; };
  if (plus)  plus.onclick  = () => { qty = Math.min(20, qty + 1); qEl.textContent = qty; };
  m.querySelector('.pm-close').onclick = closeProductModal;
  m.onclick = e => { if (e.target === m) closeProductModal(); };
  m.querySelectorAll('.pm-sz').forEach(b => b.onclick = () => {
    chosen = b.dataset.sz;
    m.querySelectorAll('.pm-sz').forEach(x => x.classList.toggle('on', x === b));
    document.getElementById('pmHint').style.visibility = 'hidden';
  });
  m.querySelectorAll('[data-pm]').forEach(t => t.onclick = () => {
    document.getElementById('pmMain').src = imgs[+t.dataset.pm];
    m.querySelectorAll('[data-pm]').forEach(x => x.classList.toggle('on', x === t));
  });
  const main = document.getElementById('pmMain');
  if (main) main.onclick = () => openLightbox(imgs, p.name, [...m.querySelectorAll('[data-pm]')].findIndex(x=>x.classList.contains('on')) || 0);
  const add = document.getElementById('pmAdd');
  if (add && !oos) add.onclick = () => {
    if (!chosen) { const h = document.getElementById('pmHint'); h.style.visibility = 'visible'; h.classList.add('shake'); setTimeout(()=>h.classList.remove('shake'),400); return; }
    for (let k = 0; k < qty; k++) Store.addToCart(p.id, { size: chosen });
    if (typeof refreshCart === 'function') refreshCart();
    toast(`Added — ${p.name} (${chosen}) × ${qty}`);
    closeProductModal();
  };
}
function closeProductModal() {
  const m = document.getElementById('pmodal'); if (!m) return;
  m.classList.remove('open'); document.body.style.overflow = '';
}


/* ================= SIZE CHART (built-in table) ================= */
const SIZE_CHARTS = {
  tshirt: {
    title: 'T-Shirt Size Chart',
    note: 'Measurements in inches. Length = shoulder to hem · Width = chest, side to side.',
    cols: ['Size', 'Length', 'Width'],
    rows: [
      ['S',   27, 38],
      ['M',   28, 40],
      ['L',   29, 42],
      ['XL',  30, 44],
      ['XXL', 31, 46],
    ],
  },
  jersey: {
    title: 'Jersey Size Chart',
    note: 'Measurements in inches. Chest = side to side · Length = shoulder to hem.',
    cols: ['Size', 'Chest', 'Length'],
    rows: [
      ['S',     36, 26],
      ['M',     38, 27],
      ['L',     40, 28],
      ['XL',    42, 29],
      ['XXL',   44, 30],
      ['XXXL',  46, 31],
      ['XXXXL', 48, 32],
    ],
  },
};
function openSizeChart() { const SIZE_CHART = SIZE_CHARTS.tshirt;
  let sc = document.getElementById('scmodal');
  if (!sc) { sc = document.createElement('div'); sc.id = 'scmodal'; sc.className = 'scmodal'; document.body.appendChild(sc); }
  sc.innerHTML = `
    <div class="sc-card">
      <button class="sc-close">&times;</button>
      <h3>${SIZE_CHART.title}</h3>
      <table class="sc-table">
        <thead><tr>${SIZE_CHART.cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${SIZE_CHART.rows.map(r => `<tr>${r.map((v,i) => i===0?`<td><b>${v}</b></td>`:`<td>${v}"</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
      <p class="sc-note">${SIZE_CHART.note}</p>
    </div>`;
  sc.classList.add('open');
  sc.querySelector('.sc-close').onclick = () => sc.classList.remove('open');
  sc.onclick = e => { if (e.target === sc) sc.classList.remove('open'); };
}

/* ================= MOBILE MENU (hamburger) ================= */
(function mobileNav() {
  const navBar = document.querySelector('.nav');
  const links = document.querySelector('.nav-links');
  const icons = document.querySelector('.nav-icons');
  if (!navBar || !links || !icons) return;
  const btn = document.createElement('button');
  btn.className = 'nav-burger'; btn.setAttribute('aria-label', 'menu');
  btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
  icons.appendChild(btn);
  const panel = document.createElement('div');
  panel.className = 'mobile-menu';
  panel.innerHTML = links.innerHTML;
  navBar.appendChild(panel);
  btn.onclick = e => { e.stopPropagation(); panel.classList.toggle('open'); };
  document.addEventListener('click', e => {
    if (!e.target.closest('.mobile-menu') && !e.target.closest('.nav-burger')) panel.classList.remove('open');
  });
  panel.addEventListener('click', e => { if (e.target.closest('a')) panel.classList.remove('open'); });
})();
