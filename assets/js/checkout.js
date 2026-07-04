/* ============ Checkout ============ */
if (Store.cartCount() === 0) { location.replace('index.html'); }

let payMethod = 'cod';
let screenshotName = null;

function chrome() {
  document.getElementById('secure').innerHTML = ic('lock', 15) + '<span>Your data is secure</span>';
  document.getElementById('btnGoogle').innerHTML = ic('google', 18) + ' Continue with Google';
  document.getElementById('btnCreate').innerHTML = ic('user', 18) + ' Create New Account';
  document.getElementById('placeArrow').innerHTML = ic('arrow', 18);
  document.getElementById('shipNote').textContent = 'Please provide an accurate address for smooth delivery.';
  document.getElementById('chargedNote').innerHTML = ic('lock', 12) + ' You place the order once payment details are submitted.';
  document.getElementById('ourNumber').textContent = HH.phone;

  document.getElementById('f_district').innerHTML =
    '<option value="">Select district</option>' + HH.districts.map(d => `<option>${d}</option>`).join('');

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

  // prefill saved user
  const u = Store.getUser();
  if (u) { fillUser(u); markLoggedIn(u); }
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
        <div class="vr">${l.product.color === '#141416' ? 'Black · ' : ''}${esc(l.size)}</div>
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
  // keep the COD advance valid if it now exceeds the new total
  const amt = document.getElementById('f_amount');
  if (Number(amt.value) > total) amt.value = total;
}

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
  document.getElementById('opt_cod').querySelector('.detail').style.display = payMethod === 'cod' ? 'grid' : 'none';
  updateStep();
}));

document.getElementById('f_shot').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 5 * 1024 * 1024) return toast('File too large (max 5MB)');
  screenshotName = f.name; document.getElementById('uploadLabel').textContent = f.name;
});

/* fake auth */
function fillUser(u){ ['name','phone','district','city','address'].forEach(k => { const el = document.getElementById('f_'+k); if (el && u[k]) el.value = u[k]; }); }
function markLoggedIn(u){ const el = document.getElementById('loggedIn'); el.classList.remove('hide'); el.innerHTML = ic('check',16)+` Signed in as <b style="margin-left:4px">${esc(u.email || u.name || 'you')}</b>`;
  document.getElementById('st1').classList.add('done'); }
document.getElementById('btnGoogle').onclick = () => { const email = prompt('Your Google email'); if (email === null) return; const u = { ...(Store.getUser()||{}), email:(email||'').trim() }; Store.setUser(u); fillUser(u); markLoggedIn(u); toast('Signed in'); updateStep(); };
document.getElementById('btnCreate').onclick = () => { const name = prompt('Full name'); if (!name) return; const email = prompt('Email') || ''; const u = { name, email }; Store.setUser(u); fillUser(u); markLoggedIn(u); toast('Account created'); updateStep(); };

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
  if (payMethod === 'cod') {
    const amt = Number(f.amount);
    const amtOk = amt >= HH.codMinAdvance && amt <= Store.cartSubtotal() + HH.deliveryCharge;
    const txnOk = f.txn.length >= 4;
    if (showErrors) setErr('f_txn', !txnOk);
    document.getElementById('minhint').style.color = amtOk ? 'var(--muted)' : 'var(--red)';
    document.getElementById('minhint').textContent = amt < HH.codMinAdvance ? `Minimum ৳${HH.codMinAdvance} required` : `Minimum required: ৳${HH.codMinAdvance}`;
    if (!amtOk || !txnOk) ok = false;
  }
  return ok;
}
['f_name','f_phone','f_city','f_address','f_txn','f_amount'].forEach(id => document.getElementById(id).addEventListener('input', () => { validate(false); updateStep(); }));
document.getElementById('f_district').addEventListener('change', () => { validate(false); updateStep(); });

/* stepper progress */
function updateStep() {
  const u = Store.getUser();
  const shipOk = ['f_name','f_phone','f_district','f_city','f_address'].every(id => val(id));
  document.getElementById('st1').classList.toggle('done', !!u);
  document.getElementById('st2').classList.toggle('active', !!u);
  document.getElementById('st2').classList.toggle('done', shipOk);
  document.getElementById('st3').classList.toggle('active', shipOk);
  const payOk = validate(false);
  document.getElementById('st3').classList.toggle('done', payOk);
  document.getElementById('st4').classList.toggle('active', payOk);
}

/* place order */
document.getElementById('placeBtn').onclick = () => {
  if (!validate(true)) { toast('Please complete the required fields'); document.querySelector('.field.err')?.scrollIntoView({behavior:'smooth',block:'center'}); return; }
  const f = readForm();
  const customer = { name:f.name, phone:f.phone, district:f.district, city:f.city, address:f.address, email:(Store.getUser()||{}).email || '' };
  Store.setUser({ ...(Store.getUser()||{}), ...customer });
  const payment = payMethod === 'full'
    ? { method:'full' }
    : { method:'cod', amount:Number(f.amount), txnId:f.txn, channel:'nagad', screenshot:screenshotName };
  const order = Store.placeOrder({ customer, payment });
  location.href = 'success.html?id=' + order.id;
};

chrome(); renderSummary(); updateStep();
