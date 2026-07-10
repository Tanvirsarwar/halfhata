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

    <div class="panel"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h3>Saved details</h3><button class="btn btn-light" id="editDetails" style="padding:7px 14px">${ic('settings',15)} Edit</button></div>
      <div id="detailsView">
        <div class="kv"><span>Name</span><b>${esc(u.name||'—')}</b></div>
        <div class="kv"><span>Phone</span><b>${esc(u.phone||'—')}</b></div>
        <div class="kv"><span>District</span><b>${esc(u.district||'—')}</b></div>
        <div class="kv"><span>City / Area</span><b>${esc(u.city||'—')}</b></div>
        <div class="kv"><span>Address</span><b style="text-align:right;max-width:60%">${esc(u.address||'—')}</b></div>
        <small style="color:var(--muted);display:block;margin-top:8px">These autofill at checkout for faster ordering.</small>
      </div>
      <div id="detailsEdit" class="hide">
        <div class="field"><label>Full name</label><input id="e_name" value="${esc(u.name||'')}" placeholder="Your full name"></div>
        <div class="row2">
          <div class="field"><label>Phone</label><input id="e_phone" value="${esc(u.phone||'')}" placeholder="01XXXXXXXXX" maxlength="11"></div>
          <div class="field"><label>District</label><input id="e_district" list="eDistricts" value="${esc(u.district||'')}" placeholder="Type to search"><datalist id="eDistricts">${HH.districts.map(d=>`<option value="${d}">`).join('')}</datalist></div>
        </div>
        <div class="field"><label>City / Area</label><input id="e_city" value="${esc(u.city||'')}" placeholder="Area / thana"></div>
        <div class="field"><label>Full address</label><input id="e_address" value="${esc(u.address||'')}" placeholder="House, road, area"></div>
        <div class="auth-msg err hide" id="eMsg"></div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-dark" id="saveDetails" style="flex:1">Save changes</button>
          <button class="btn btn-light" id="cancelEdit" style="flex:1">Cancel</button>
        </div>
      </div>
    </div>`;
  document.getElementById('logout').onclick = () => { Store.logout(); render(); };
  const eBtn = document.getElementById('editDetails');
  if (eBtn) eBtn.onclick = () => {
    document.getElementById('detailsView').classList.toggle('hide');
    document.getElementById('detailsEdit').classList.toggle('hide');
  };
  const cBtn = document.getElementById('cancelEdit');
  if (cBtn) cBtn.onclick = () => {
    document.getElementById('detailsView').classList.remove('hide');
    document.getElementById('detailsEdit').classList.add('hide');
  };
  const sBtn = document.getElementById('saveDetails');
  if (sBtn) sBtn.onclick = () => {
    const name = document.getElementById('e_name').value.trim();
    const phone = document.getElementById('e_phone').value.trim();
    const district = document.getElementById('e_district').value.trim();
    const city = document.getElementById('e_city').value.trim();
    const address = document.getElementById('e_address').value.trim();
    const msg = document.getElementById('eMsg');
    if (phone && !/^01\d{9}$/.test(phone)) { msg.textContent = 'Phone must be 11 digits starting with 01'; msg.classList.remove('hide'); return; }
    Store.setUser({ ...Store.getUser(), name, phone, district, city, address });
    toast('Details saved ✓');
    render();
  };
  const mr = document.getElementById('markRead'); if (mr) mr.onclick = () => { Store.markAllRead(); render(); };
}
(async () => { if (window.SB) await SB.loadOrders(); render(); })();
