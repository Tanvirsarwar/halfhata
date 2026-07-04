/* ============ Track ============ */
const statusPill = { 'Pending':'pill-amber','On Courier':'pill-blue','Delivered':'pill-green','Cancelled':'pill-red' };
const fmt = iso => new Date(iso).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });

function render(o) {
  const r = document.getElementById('result');
  if (!o) { r.innerHTML = `<div class="panel"><div class="empty">No order found with that ID. Check your Order ID or contact us on WhatsApp.</div></div>`; return; }
  const notif = o.notifications.length
    ? `<div class="dgroup"><div class="t">${ic('bell',13)} Notifications</div>${o.notifications.map(n =>
        `<div style="padding:8px 0;border-bottom:1px solid #f2f1ef"><b style="font-size:13.5px">${esc(n.title)}</b><br><small style="color:var(--muted)">${esc(n.body)} · ${fmt(n.at)}</small></div>`).join('')}</div>`
    : '';
  const courier = o.courier
    ? `<div class="kv"><span>Courier</span><b>${esc(o.courier.service)}</b></div><div class="kv"><span>Tracking ID</span><b>${esc(o.courier.trackingId)}</b></div>`
    : `<div class="kv"><span>Courier</span><span>Not shipped yet</span></div>`;
  r.innerHTML = `
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div><h3>#${esc(o.id)}</h3><small style="color:var(--muted)">Placed ${fmt(o.createdAt)}</small></div>
        <span class="pill ${statusPill[o.status]}">${o.status}</span>
      </div>
      <div class="dgroup"><div class="t">Delivery</div>
        <div class="kv"><span>Name</span><b>${esc(o.customer.name)}</b></div>
        <div class="kv"><span>Address</span><b style="text-align:right;max-width:60%">${esc(o.customer.address)}, ${esc(o.customer.city)}</b></div>
        ${courier}
      </div>
      <div class="dgroup"><div class="t">Payment</div>
        <div class="kv"><span>Total</span><b>${money(o.total)}</b></div>
        <div class="kv"><span>Paid</span><b>${money(o.payment.paid)}</b></div>
        <div class="kv"><span>Due on delivery</span><b>${money(o.payment.due)}</b></div>
      </div>
      ${notif}
      <div class="dgroup"><div class="t">Timeline</div><div class="timeline">${o.timeline.slice().reverse().map(t =>
        `<div class="tl"><b>${esc(t.status)}</b><small>${fmt(t.at)}${t.note ? ' · ' + esc(t.note) : ''}</small></div>`).join('')}</div></div>
    </div>`;
}

document.getElementById('go').onclick = () => render(Store.getOrder(document.getElementById('tid').value.trim().replace('#','')));
document.getElementById('tid').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('go').click(); });

const pre = new URLSearchParams(location.search).get('id');
if (pre) { document.getElementById('tid').value = pre; render(Store.getOrder(pre)); }
