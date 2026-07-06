/* ============ Customer Account ============ */
const statusPill = { 'Pending':'pill-amber','On Courier':'pill-blue','Delivered':'pill-green','Cancelled':'pill-red' };
const fmt = iso => new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });

function render() {
  const u = Store.getUser(); const body = document.getElementById('acctBody');
  if (!u) {
    body.innerHTML = `<div class="panel" style="max-width:440px;margin:0 auto;padding:30px">
      <h2 style="font-size:22px;text-align:center">Sign in to your account</h2>
      <p style="color:var(--muted);margin:8px 0 20px;text-align:center">See your orders, delivery status and notifications.</p>
      <div id="authMount"></div>
    </div>`;
    renderAuth('authMount', () => { location.href = 'index.html'; });
    return;
  }
  const orders = Store.userOrders(); const notifs = Store.userNotifications();
  const unread = notifs.filter(n => !n.read).length;
  body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div><h1 style="font-size:26px">Hi, ${esc(u.name || 'there')} 👋</h1>
        <div class="muted" style="color:var(--muted)">${esc(u.email || u.phone || '')}</div></div>
      <button class="btn btn-light" id="logout">Log out</button>
    </div>

    <div class="panel"><h3 style="margin-bottom:12px">Notifications ${unread?`<span class="pill pill-red">${unread} new</span>`:''}</h3>
      ${notifs.length ? notifs.slice(0,6).map(n => `<div style="padding:10px 0;border-bottom:1px solid #f2f1ef">
        <b style="font-size:13.5px">${esc(n.title)}</b><br><small style="color:var(--muted)">${esc(n.body)} · ${fmt(n.at)}</small>
        <a href="track.html?id=${esc(n.orderId)}" style="font-size:12px;font-weight:600;display:block;margin-top:4px">Track →</a></div>`).join('')
        : '<div class="empty">No notifications yet.</div>'}
      ${notifs.length ? '<button class="btn btn-light" id="markRead" style="margin-top:12px">Mark all read</button>' : ''}
    </div>

    <div class="panel"><h3 style="margin-bottom:12px">My orders (${orders.length})</h3>
      ${orders.length ? orders.map(o => `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f2f1ef">
        <div style="flex:1"><b>#${esc(o.id)}</b> <span class="pill ${statusPill[o.status]}" style="margin-left:6px">${o.status}</span>
          <div class="muted" style="color:var(--muted);font-size:12.5px;margin-top:3px">${o.items.length} item(s) · ${money(o.total)} · ${fmt(o.createdAt)}${o.courier?` · ${esc(o.courier.service)} ${esc(o.courier.trackingId)}`:''}</div></div>
        <a class="btn btn-light" href="track.html?id=${esc(o.id)}">Track</a></div>`).join('')
        : '<div class="empty">You have no orders yet. <a href="index.html" style="font-weight:600">Start shopping →</a></div>'}
    </div>

    <div class="panel"><h3 style="margin-bottom:12px">Saved details</h3>
      <div class="kv"><span>Name</span><b>${esc(u.name||'—')}</b></div>
      <div class="kv"><span>Phone</span><b>${esc(u.phone||'—')}</b></div>
      <div class="kv"><span>City</span><b>${esc(u.city||'—')}</b></div>
      <div class="kv"><span>Address</span><b style="text-align:right;max-width:60%">${esc(u.address||'—')}</b></div>
      <small style="color:var(--muted);display:block;margin-top:8px">These autofill at checkout for faster ordering.</small>
    </div>`;
  document.getElementById('logout').onclick = () => { Store.logout(); render(); };
  const mr = document.getElementById('markRead'); if (mr) mr.onclick = () => { Store.markAllRead(); render(); };
}
render();
