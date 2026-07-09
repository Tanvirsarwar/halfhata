/* ============ Checkout ============ */
if (Store.cartCount() === 0) { location.replace('index.html'); }

let payMethod = 'cod';
let screenshotName = null;

function chrome() {
  document.getElementById('secure').innerHTML = ic('lock', 15) + '<span>Your data is secure</span>';
  document.getElementById('placeArrow').innerHTML = ic('arrow', 18);
  document.getElementById('shipNote').textContent = 'Please provide an accurate address for smooth delivery.';
  document.getElementById('chargedNote').innerHTML = ic('lock', 12) + ' You place the order once payment details are submitted.';
  document.getElementById('ourNumber').textContent = HH.phone;

  document.getElementById('districtList').innerHTML = HH.districts.map(d => `<option value="${d}">`).join('');

  document.getElementById('payChips').innerHTML = HH.channels.filter(c => c.key !== 'whatsapp')
    .map(c => `<span class="pill" style="background:${c.color}22;color:${c.color}">${c.label}</span>`).join('');

  document.getElementById('channels').innerHTML = HH.channels.map(c => `
    <div class="r"><span class="ic" style="background:${c.color}">${c.label[0]}</span>
      <div><b style="font-size:14px">${c.label}</b></div>
      <span class="num">${c.number}</span>
      ${c.key === 'whatsapp' ? '<a class="pill pill-green" style="text-decoration:none" target="_blank" href="https://wa.me/88'+c.number+'">Chat Now</a>' : ''}
    </div>`).join('');

  const why = [['shield','Premium Quality','Comfort & Durable'],['box','Easy Returns','Hassle Free'],
               ['wallet','Cash on Delivery','All Over Bangladesh'],['truck','Fast Delivery','Reliable & Secure']];
  document.getElementById('whyGrid').innerHTML = why.map(([i,t,s]) =>
    `<div class="feature"><div class="ic">${ic(i,20)}</div><div><b>${t}</b><small>${s}</small></div></div>`).join('');

  document.getElementById('footerChannels').innerHTML = HH.channels.map(c =>
    `<div class="it"><span style="width:26px;height:26px;border-radius:50%;background:${c.color};display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700">${c.label[0]}</span><div><b style="color:#fff;font-size:13px">${c.label}</b><small>${c.number}</small></div></div>`).join('');

  // auth: show signed-in state, or mount the login/create form
  const u = Store.getUser();
  if (u) fillUser(u);
  if (u && u.provider) { showSignedIn(u); }
  else { renderAuth('authMount', onAuthSuccess); }
}

function onAuthSuccess(u) { fillUser(u); showSignedIn(u); toast('Signed in'); updateStep(); }
function showSignedIn(u) {
  const m = document.getElementById('authMount'); if (m) m.classList.add('hide');
  const sub = document.getElementById('authSub'); if (sub) sub.classList.add('hide');
  markLoggedIn(u);
  document.getElementById('st1').classList.add('done');
}

function renderSummary() {
  const lines = Store.cartLines(), sub = Store.cartSubtotal(), del = HH.deliveryCharge, total = sub + del;
  if (!lines.length) { location.replace('index.html'); return; }
  document.getElementById('sumCount').textContent = `${Store.cartCount()} items`;
  document.getElementById('sumItems').innerHTML = lines.map(l => `
    <div class="sum-item">
      <div class="im">${productMedia(l.product, '80%')}</div>
      <div class="grow">
        <div class="nm">${esc(l.product.name)}</div>
        <div class="vr">Size:
          <select class="size-sel" data-id="${esc(l.id)}" data-size="${esc(l.size)}">
            ${(l.product.sizes || ['M']).map(s => `<option ${s === l.size ? 'selected' : ''}>${esc(s)}</option>`).join('')}
          </select>
        </div>
        <div class="qty">
          <button class="qbtn" data-dec="${l.id}" data-size="${esc(l.size)}" aria-label="decrease">−</button>
          <span class="qn">${l.qty}</span>
          <button class="qbtn" data-inc="${l.id}" data-size="${esc(l.size)}" aria-label="increase">+</button>
          <button class="rm" data-rm="${l.id}" data-size="${esc(l.size)}">${ic('x',13)} Remove</button>
        </div>
      </div>
      <div class="pr"><b>${money(l.lineTotal)}</b><span style="color:var(--muted)">${money(l.product.price)} × ${l.qty}</span></div>
    </div>`).join('');
  document.getElementById('sumSub').textContent = money(sub);
  document.getElementById('sumDel').textContent = money(del);
  document.getElementById('sumTotal').textContent = money(total);
  document.getElementById('fullTotal').textContent = money(total);
  document.getElementById('f_amount').max = total;
  const amt = document.getElementById('f_amount');
  if (Number(amt.value) > total) amt.value = total;
  applyPayMode();
}

/* size change */
document.getElementById('sumItems').addEventListener('change', e => {
  const sel = e.target.closest('.size-sel');
  if (sel) { Store.setSize(sel.dataset.id, sel.dataset.size, sel.value); toast('Size updated'); afterCartChange(); }
});

/* cart line actions: remove / change quantity */
document.getElementById('sumItems').addEventListener('click', e => {
  const rm = e.target.closest('[data-rm]');
  const inc = e.target.closest('[data-inc]');
  const dec = e.target.closest('[data-dec]');
  if (rm)  { Store.removeLine(rm.dataset.rm, rm.dataset.size); toast('Item removed'); afterCartChange(); }
  if (inc) { const l = Store.cartLines().find(x => x.id === inc.dataset.inc && x.size === inc.dataset.size); Store.setQty(inc.dataset.inc, inc.dataset.size, l.qty + 1); afterCartChange(); }
  if (dec) { const l = Store.cartLines().find(x => x.id === dec.dataset.dec && x.size === dec.dataset.size); Store.setQty(dec.dataset.dec, dec.dataset.size, l.qty - 1); afterCartChange(); }
});
function afterCartChange() {
  if (Store.cartCount() === 0) { toast('Your cart is empty'); setTimeout(() => location.replace('index.html'), 600); return; }
  renderSummary(); validate(false); updateStep();
}

/* payment option toggle */
document.querySelectorAll('.payopt').forEach(opt => opt.addEventListener('click', () => {
  payMethod = opt.dataset.opt;
  document.querySelectorAll('.payopt').forEach(o => o.classList.remove('sel'));
  opt.classList.add('sel');
  opt.querySelector('input[type=radio]').checked = true;
  applyPayMode();
  updateStep();
}));

function applyPayMode() {
  const total = Store.cartSubtotal() + HH.deliveryCharge;
  const amt = document.getElementById('f_amount');
  const label = document.getElementById('amtLabel');
  const hint = document.getElementById('minhint');
  if (!amt) return;
  if (payMethod === 'full') {
    amt.value = total; amt.readOnly = true;
    if (label) label.textContent = 'Full Amount';
    if (hint) { hint.textContent = `Pay the full ${money(total)} now`; hint.style.color = 'var(--muted)'; }
  } else {
    amt.readOnly = false;
    if (Number(amt.value) < HH.codMinAdvance || Number(amt.value) > total) amt.value = HH.codMinAdvance;
    if (label) label.textContent = `Payment Amount (Minimum ৳${HH.codMinAdvance})`;
    if (hint) hint.textContent = `Minimum required: ৳${HH.codMinAdvance}`;
  }
}

document.getElementById('f_shot').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 5 * 1024 * 1024) return toast('File too large (max 5MB)');
  screenshotName = f.name; document.getElementById('uploadLabel').textContent = f.name;
});

/* auth helpers */
function fillUser(u){ ['name','phone','district','city','address'].forEach(k => { const el = document.getElementById('f_'+k); if (el && u[k]) el.value = u[k]; }); }
function markLoggedIn(u){ const el = document.getElementById('loggedIn'); el.classList.remove('hide'); el.innerHTML = ic('check',16)+` Signed in as <b style="margin-left:4px">${esc(u.email || u.name || 'you')}</b>`; }

/* validation */
function readForm() {
  return { name:val('f_name'), phone:val('f_phone'), district:val('f_district'), city:val('f_city'), address:val('f_address'),
           amount:val('f_amount'), txn:val('f_txn') };
}
const val = id => document.getElementById(id).value.trim();
function setErr(id, on){ document.getElementById(id).closest('.field').classList.toggle('err', on); }

function validate(showErrors) {
  const f = readForm(); let ok = true;
  const checks = {
    f_name: f.name.length > 1, f_phone: /^01\d{9}$/.test(f.phone.replace(/\s/g,'')),
    f_district: !!f.district, f_city: !!f.city, f_address: f.address.length > 4,
  };
  for (const [id, good] of Object.entries(checks)) { if (showErrors) setErr(id, !good); if (!good) ok = false; }
  // payment: both COD and Full require a valid amount + transaction ID
  const amt = Number(f.amount);
  const total = Store.cartSubtotal() + HH.deliveryCharge;
  const min = payMethod === 'full' ? total : HH.codMinAdvance;
  const amtOk = amt >= min && amt <= total;
  const txnOk = f.txn.length >= 4;
  if (showErrors) setErr('f_txn', !txnOk);
  const hint = document.getElementById('minhint');
  if (hint && payMethod === 'cod') {
    hint.style.color = amtOk ? 'var(--muted)' : 'var(--red)';
    hint.textContent = amt < HH.codMinAdvance ? `Minimum ৳${HH.codMinAdvance} required` : `Minimum required: ৳${HH.codMinAdvance}`;
  }
  if (!amtOk || !txnOk) ok = false;
  return ok;
}
['f_name','f_phone','f_city','f_address','f_txn','f_amount'].forEach(id => document.getElementById(id).addEventListener('input', () => { validate(false); updateStep(); }));
document.getElementById('f_district').addEventListener('input', () => { validate(false); updateStep(); });

/* stepper progress */
function updateStep() {
  const u = Store.getUser();
  const loggedIn = !!(u && u.provider);
  const shipOk = ['f_name','f_phone','f_district','f_city','f_address'].every(id => val(id));
  document.getElementById('st1').classList.toggle('done', loggedIn);
  document.getElementById('st2').classList.toggle('active', loggedIn);
  document.getElementById('st2').classList.toggle('done', shipOk);
  document.getElementById('st3').classList.toggle('active', shipOk);
  const payOk = validate(false);
  document.getElementById('st3').classList.toggle('done', payOk);
  document.getElementById('st4').classList.toggle('active', payOk && loggedIn);
  const btn = document.getElementById('placeBtn');
  if (btn) btn.innerHTML = loggedIn
    ? `Proceed &amp; Place Order <span id="placeArrow">${ic('arrow',18)}</span>`
    : `Sign in to Place Order`;
}

/* place order */
document.getElementById('placeBtn').onclick = () => {
  const user = Store.getUser();
  if (!user || !user.provider) {
    toast('Please sign in first to place your order');
    document.getElementById('authMount')?.classList.remove('hide');
    document.getElementById('authMount')?.scrollIntoView({ behavior:'smooth', block:'center' });
    return;
  }
  if (!validate(true)) { toast('Please complete the required fields'); document.querySelector('.field.err')?.scrollIntoView({behavior:'smooth',block:'center'}); return; }
  const f = readForm();
  const customer = { name:f.name, phone:f.phone, district:f.district, city:f.city, address:f.address, email:user.email || '' };
  Store.setUser({ ...user, ...customer });
  const payment = payMethod === 'full'
    ? { method:'full', amount:Number(f.amount), txnId:f.txn, channel:'nagad', screenshot:screenshotName }
    : { method:'cod', amount:Number(f.amount), txnId:f.txn, channel:'nagad', screenshot:screenshotName };
  const order = Store.placeOrder({ customer, payment });
  location.href = 'success.html?id=' + order.id;
};

chrome(); renderSummary(); updateStep();
