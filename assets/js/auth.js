/* ============ Shared auth UI ============ */

/* ── To enable REAL Google sign-in (opens all your Google accounts) ──
   1. Create an OAuth Client ID at https://console.cloud.google.com/apis/credentials
      (Application type: Web). Add your site URL to "Authorized JavaScript origins".
   2. Paste the Client ID below. That's it — the real Google account picker turns on.
   Until then, the button does a smooth one-click demo sign-in.                       */
const GOOGLE_CLIENT_ID = ''; // e.g. '1234567890-abcd.apps.googleusercontent.com'

function renderAuth(mountId, onSuccess) {
  const el = document.getElementById(mountId);
  el.classList.remove('hide');
  el.innerHTML = `
    <div id="gBtnReal" style="display:flex;justify-content:center"></div>
    <button class="btn btn-google btn-block" id="auGoogle">${ic('google',18)} Continue with Google</button>
    <div class="auth-divider"><span>or use your email</span></div>
    <div class="auth-tabs">
      <button class="atab on" data-tab="login">Log in</button>
      <button class="atab" data-tab="signup">Create account</button>
    </div>
    <div class="field"><label>Email address</label><input id="auEmail" type="email" placeholder="you@example.com" autocomplete="email"></div>
    <div class="field"><label>Password</label><input id="auPass" type="password" placeholder="At least 6 characters" autocomplete="current-password"></div>
    <div class="field hide" id="auConfirmWrap"><label>Confirm password</label><input id="auPass2" type="password" placeholder="Re-enter password" autocomplete="new-password"></div>
    <div class="auth-msg hide" id="auMsg"></div>
    <button class="btn btn-dark btn-block" id="auSubmit">Log in</button>`;

  let mode = 'login';
  const $ = id => document.getElementById(id);
  const show = (t, ok) => { const m = $('auMsg'); m.className = 'auth-msg ' + (ok ? 'ok' : 'err'); m.textContent = t; m.classList.remove('hide'); };

  el.querySelectorAll('.atab').forEach(b => b.onclick = () => {
    mode = b.dataset.tab;
    el.querySelectorAll('.atab').forEach(x => x.classList.toggle('on', x === b));
    $('auConfirmWrap').classList.toggle('hide', mode !== 'signup');
    $('auSubmit').textContent = mode === 'signup' ? 'Create account' : 'Log in';
    $('auPass').setAttribute('autocomplete', mode === 'signup' ? 'new-password' : 'current-password');
    $('auMsg').classList.add('hide');
  });

  async function submit() {
    const email = $('auEmail').value.trim(), pass = $('auPass').value, pass2 = $('auPass2').value;
    if (!/^\S+@\S+\.\S+$/.test(email)) return show('Enter a valid email address');
    if (pass.length < 6) return show('Password must be at least 6 characters');
    if (mode === 'signup' && pass !== pass2) return show('Passwords do not match');
    const res = mode === 'signup' ? await Store.registerUser(email, pass) : await Store.loginUser(email, pass);
    if (!res.ok) return show(res.error);
    onSuccess(Store.getUser());
  }
  $('auSubmit').onclick = submit;
  [$('auEmail'), $('auPass'), $('auPass2')].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));

  mountGoogle(el, onSuccess);
}

/* Google: real account picker if a Client ID is set, else smooth one-click demo. */
function mountGoogle(el, onSuccess) {
  const demoBtn = el.querySelector('#auGoogle');
  const realBox = el.querySelector('#gBtnReal');
  const configured = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.length > 20;

  if (!configured) {
    demoBtn.onclick = () => { Store.loginGoogle(''); onSuccess(Store.getUser()); };
    return;
  }
  let tries = 0;
  (function ready() {
    if (window.google && google.accounts && google.accounts.id) {
      demoBtn.style.display = 'none';
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: r => { try { const p = JSON.parse(atob(r.credential.split('.')[1])); Store.loginGoogle(p.email); onSuccess(Store.getUser()); } catch (e) {} },
      });
      google.accounts.id.renderButton(realBox, { theme:'outline', size:'large', text:'continue_with', width:320, logo_alignment:'center' });
      try { google.accounts.id.prompt(); } catch (e) {}
    } else if (tries++ < 40) { setTimeout(ready, 80); }
    else { demoBtn.onclick = () => { Store.loginGoogle(''); onSuccess(Store.getUser()); }; }
  })();
}
