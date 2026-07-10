/* ============ Custom Design Order ============ */
const C = HH.custom;
let designFile = null, designPreview = null;
let selType = C.types[0].id;
let selColor = C.fabricColors[0];
const qty = {};            // { S: 2, M: 5, ... }

/* ---- chrome ---- */
document.getElementById('navUser').innerHTML = ic('user', 22);
document.getElementById('navCart').innerHTML = ic('cart', 22);
document.getElementById('cPayNum').textContent = HH.phone;
put('footerChannels', `
  <a class="it" href="mailto:${HH.email}"><span class="ficon">${ic('mail',15)}</span><div><b>Email</b><small>${HH.email}</small></div></a>
  <a class="it" href="https://wa.me/88${HH.phone}" target="_blank"><span class="ficon wa">${ic('wa',15)}</span><div><b>WhatsApp</b><small>${HH.phone}</small></div></a>`);
function put(id, html){ const el = document.getElementById(id); if (el) el.innerHTML = html; return el; }
document.getElementById('cDistricts').innerHTML = HH.districts.map(d => `<option value="${d}">`).join('');

/* ---- upload ---- */
document.getElementById('dropZone').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  if (!f.type.startsWith('image/')) return toast('Please upload an image file');
  designFile = f;
  const r = new FileReader();
  r.onload = () => {
    designPreview = r.result;
    document.getElementById('dropInner').innerHTML = `
      <img src="${designPreview}" class="c-preview">
      <b style="margin-top:10px">${esc(f.name)}</b>
      <small class="c-change">Click to change design</small>`;
    refresh();
  };
  r.readAsDataURL(f);
});

/* ---- type cards ---- */
function renderTypes() {
  document.getElementById('typeRow').innerHTML = C.types.map(t => `
    <div class="c-type ${selType === t.id ? 'on' : ''}" data-type="${t.id}">
      <b>${t.label}</b><small>${t.desc}</small>
      <span class="c-unit">৳${t.unit} <small>/pc</small></span>
    </div>`).join('');
  document.querySelectorAll('.c-type').forEach(el => el.onclick = () => { selType = el.dataset.type; renderTypes(); refresh(); });
}

/* ---- colors ---- */
function renderColors() {
  document.getElementById('colorRow').innerHTML = C.fabricColors.map(c => `
    <button class="c-swatch ${selColor.name === c.name ? 'on' : ''}" data-color="${c.name}" style="background:${c.hex}" title="${c.name}"></button>`).join('');
  document.getElementById('colorName').textContent = 'Selected: ' + selColor.name;
  document.querySelectorAll('.c-swatch').forEach(el => el.onclick = () => {
    selColor = C.fabricColors.find(c => c.name === el.dataset.color); renderColors(); refresh();
  });
}

/* ---- size grid ---- */
function renderSizes() {
  document.getElementById('sizeGrid').innerHTML = HH.sizes.map(sz => `
    <div class="c-size">
      <span class="c-size-lbl">${sz}</span>
      <div class="c-size-ctl">
        <button class="c-sbtn" data-dec="${sz}">&minus;</button>
        <span class="c-sn" id="q_${sz}">${qty[sz] || 0}</span>
        <button class="c-sbtn" data-inc="${sz}">+</button>
      </div>
    </div>`).join('');
}
document.getElementById('sizeGrid').addEventListener('click', e => {
  const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]');
  if (inc) { const s = inc.dataset.inc; qty[s] = (qty[s] || 0) + 1; }
  if (dec) { const s = dec.dataset.dec; qty[s] = Math.max(0, (qty[s] || 0) - 1); }
  if (inc || dec) { renderSizes(); refresh(); }
});

/* ---- totals ---- */
const totalQty = () => Object.values(qty).reduce((a, b) => a + b, 0);
function pricing() {
  const t = C.types.find(x => x.id === selType);
  const n = totalQty();
  let off = 0;
  for (const tier of C.bulkTiers) if (n >= tier.min) off = tier.off;
  const unit = Math.round(t.unit * (1 - off / 100));
  const subtotal = unit * n;
  const delivery = n === 0 ? 0 : (subtotal >= HH.freeDeliveryOver ? 0 : HH.deliveryCharge);
  return { t, n, off, unit, subtotal, delivery, total: subtotal + delivery };
}
function refresh() {
  const { t, n, off, unit, subtotal, delivery, total } = pricing();
  const sizeBits = HH.sizes.filter(s => qty[s]).map(s => `${s}×${qty[s]}`).join(' · ');
  document.getElementById('cSummary').innerHTML = `
    <div class="c-sum-row"><span>Design</span><b>${designFile ? '✓ uploaded' : '— not uploaded'}</b></div>
    <div class="c-sum-row"><span>Type</span><b>${t.label}</b></div>
    <div class="c-sum-row"><span>Fabric</span><b>${selColor.name}</b></div>
    <div class="c-sum-row"><span>Pieces</span><b>${n}${sizeBits ? ` <small style="color:#8a8a90">(${sizeBits})</small>` : ''}</b></div>
    <div class="c-sum-row"><span>Unit price</span><b>৳${unit}${off ? ` <span class="c-off">−${off}% bulk</span>` : ''}</b></div>`;
  document.getElementById('cSubtotal').textContent = money(subtotal);
  document.getElementById('cDelivery').textContent = delivery === 0 && n > 0 ? 'FREE' : money(delivery);
  document.getElementById('cTotal').textContent = money(total);
  document.getElementById('bulkHint').innerHTML = C.bulkTiers.map(b =>
    `<span class="${n >= b.min ? 'hit' : ''}">${b.min}+ pcs → ${b.off}% off</span>`).join('');
}

/* ---- auth ---- */
function showShip(u) {
  const el = document.getElementById('cLogged');
  el.classList.remove('hide');
  el.innerHTML = ic('check', 16) + ` Signed in as <b style="margin-left:4px">${esc(u.email || 'you')}</b>`;
  const am = document.getElementById('authMount'); if (am) am.classList.add('hide');
  document.getElementById('cShipWrap').classList.remove('hide');
  ['name','phone','district','address'].forEach(k => { const el = document.getElementById('c_' + k); if (el && u[k]) el.value = u[k]; });
}
const u0 = Store.getUser();
if (u0 && u0.provider) showShip(u0);
else renderAuth('authMount', u => { showShip(u); toast('Signed in'); });

/* ---- place order ---- */
document.getElementById('cPlace').onclick = async () => {
  const user = Store.getUser();
  if (!user || !user.provider) return toast('Please sign in first');
  if (!designFile) return toast('Please upload your design first');
  const n = totalQty();
  if (n === 0) return toast('Add at least 1 piece in sizes');
  const name = document.getElementById('c_name').value.trim();
  const phone = document.getElementById('c_phone').value.trim();
  const district = document.getElementById('c_district').value.trim();
  const address = document.getElementById('c_address').value.trim();
  const txn = document.getElementById('c_txn').value.trim();
  if (!name || !/^01\d{9}$/.test(phone) || !district || address.length < 5) return toast('Please complete name, valid phone, district & address');
  if (txn.length < 4) return toast('Enter your advance payment Transaction ID');

  const btn = document.getElementById('cPlace');
  btn.disabled = true; btn.textContent = 'Uploading design…';

  let designUrl = null;
  if (window.SB) designUrl = await SB.uploadFile(designFile);
  if (!designUrl) designUrl = designPreview; // offline fallback

  const { t, off, unit, subtotal, delivery, total } = pricing();
  const items = HH.sizes.filter(s => qty[s]).map(s => ({
    id: 'custom-' + selType, name: `Custom ${t.label} — ${selColor.name}`, price: unit, qty: qty[s], size: s, image: designUrl,
  }));
  const custom = {
    designUrl, designName: designFile.name, type: t.label, unit, bulkOff: off,
    fabric: selColor.name, fabricHex: selColor.hex,
    notes: document.getElementById('cNotes').value.trim(),
    breakdown: HH.sizes.filter(s => qty[s]).map(s => ({ size: s, qty: qty[s] })),
  };
  const customer = { name, phone, district, city: district, address, email: user.email || '' };
  Store.setUser({ ...user, ...customer });
  const order = Store.placeCustomOrder({ customer, payment: { method: 'cod', amount: 120, txnId: txn, channel: 'nagad' }, custom, items, subtotal, delivery, total });
  location.href = 'success.html?id=' + order.id;
};

renderTypes(); renderColors(); renderSizes(); refresh();
