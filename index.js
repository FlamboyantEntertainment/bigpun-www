/**
 * bigpun.uk auth worker
 * Routes:
 *   GET  /auth          -> serve registration form
 *   POST /auth/api      -> validate token + create user via Synapse admin API
 *
 * Secrets (set via `wrangler secret put`):
 *   - SYNAPSE_ADMIN_TOKEN: real admin access token (Bearer)
 *   - SYNAPSE_SHARED_SECRET: registration HMAC secret
 */

const SYNAPSE_URL = 'https://matrix.bigpun.uk';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/auth' && request.method === 'GET') {
      return new Response(renderHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if (path === '/auth/api' && request.method === 'POST') {
      return handleRegister(request, env);
    }

    if (path === '/favicon.ico') {
      return new Response(null, { status: 204 });
    }

    return new Response('Not found', { status: 404 });
  }
};

// ─── HTML form ───────────────────────────────────────────────────────────────
function renderHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>bigpun.uk \u2014 Register</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      background: #0d0d0d;
      background-image: radial-gradient(ellipse at 50% 30%, #1a1a2e 0%, #0d0d0d 70%);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      font-family: 'Courier New', Courier, monospace; color: #c9b89a; text-align: center; padding: 2rem;
    }
    h1 { font-size: 1rem; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 0.5rem; opacity: 0; animation: fadein 1.5s ease forwards; }
    .subtitle { font-size: 0.8rem; opacity: 0; animation: fadein 1.5s ease 0.3s forwards; margin-bottom: 2.5rem; color: #8a7a6a; max-width: 400px; line-height: 1.6; }
    .gate-container { opacity: 0; animation: fadein 1.5s ease 0.6s forwards; width: 100%; max-width: 320px; }
    .form-group { margin-bottom: 1rem; }
    label { display: block; font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; color: #6b5a4a; margin-bottom: 0.4rem; text-align: left; }
    input { width: 100%; padding: 0.7rem 1rem; background: #1a1209; border: 2px solid #3d2b1f; border-radius: 4px; color: #c9b89a; font-family: 'Courier New', monospace; font-size: 0.95rem; letter-spacing: 0.1em; text-align: center; outline: none; transition: border-color 0.3s, box-shadow 0.3s; }
    input:focus { border-color: #6b4f3a; box-shadow: 0 0 10px rgba(107, 79, 58, 0.3); }
    input::placeholder { color: #4a3a2a; letter-spacing: 0.1em; }
    button { margin-top: 0.5rem; width: 100%; padding: 0.8rem 2rem; background: #1a1209; border: 2px solid #3d2b1f; border-radius: 4px; color: #c9b89a; font-family: 'Courier New', monospace; font-size: 0.85rem; letter-spacing: 0.2em; text-transform: uppercase; cursor: pointer; transition: all 0.3s; }
    button:hover:not(:disabled) { background: #2a1d14; border-color: #6b4f3a; box-shadow: 0 0 15px rgba(107, 79, 58, 0.4); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    #result { margin-top: 1.2rem; font-size: 0.85rem; letter-spacing: 0.1em; min-height: 1.4em; opacity: 0; transition: opacity 0.3s; }
    #result.show { opacity: 1; }
    @keyframes fadein { to { opacity: 1; } }
  </style>
</head>
<body>
  <h1>bigpun.uk</h1>
  <p class="subtitle">Request an invite token to create your account.</p>
  <div class="gate-container">
    <form id="regForm" onsubmit="submitForm(event)">
      <div class="form-group">
        <label for="token">Invite Token</label>
        <input type="text" id="token" placeholder="your-token-here" required autocomplete="off" />
      </div>
      <div class="form-group">
        <label for="username">Username</label>
        <input type="text" id="username" placeholder="desired-username" required minlength="3" maxlength="30" autocomplete="username" />
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" placeholder="choose-a-password" required minlength="8" autocomplete="new-password" />
      </div>
      <button type="submit" id="submitBtn">Create Account</button>
    </form>
    <p id="result"></p>
  </div>
  <script>
    // Username allowed chars: letters, digits, underscores, dots, hyphens
    var USERNAME_RE = new RegExp('^[a-zA-Z0-9._-]+$');
    function submitForm(e) {
      e.preventDefault();
      var btn = document.getElementById('submitBtn');
      var result = document.getElementById('result');
      var token = document.getElementById('token').value.trim();
      var username = document.getElementById('username').value.trim();
      var password = document.getElementById('password').value;

      result.className = '';
      result.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Creating...';

      if (!USERNAME_RE.test(username)) {
        result.textContent = '\\u2715 Username may only contain letters, numbers, dots, underscores and hyphens';
        result.style.color = '#8a3a3a';
        result.className = 'show';
        btn.disabled = false;
        btn.textContent = 'Create Account';
        return;
      }

      fetch('/auth/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token, username: username, password: password })
      })
      .then(function(resp) { return resp.json().then(function(data) { return { ok: resp.ok, data: data }; }); })
      .then(function(r) {
        if (r.ok) {
          result.textContent = '\\u2694 Account created \\u2014 ' + (r.data.user_id || '');
          result.style.color = '#5a8a5a';
          document.getElementById('regForm').reset();
        } else {
          result.textContent = '\\u2715 ' + (r.data.error || 'Registration failed');
          result.style.color = '#8a3a3a';
        }
        result.className = 'show';
      })
      .catch(function() {
        result.textContent = '\\u2715 Network error \\u2014 try again';
        result.style.color = '#8a3a3a';
        result.className = 'show';
      })
      .finally(function() {
        btn.disabled = false;
        btn.textContent = 'Create Account';
      });
    }
  </script>
</body>
</html>`;
}

// ─── Registration handler ─────────────────────────────────────────────────────
async function handleRegister(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const { token, username, password } = body;

  if (!token || !username || !password) {
    return jsonResponse({ error: 'Missing fields' }, 400);
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return jsonResponse({ error: 'Username may only contain letters, numbers, dots, underscores and hyphens' }, 400);
  }
  if (password.length < 8) {
    return jsonResponse({ error: 'Password must be at least 8 characters' }, 400);
  }

  const adminToken = env.SYNAPSE_ADMIN_TOKEN;
  const sharedSecret = env.SYNAPSE_SHARED_SECRET;
  if (!adminToken || !sharedSecret) {
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  // Step 1: Validate the registration token via Synapse admin API
  const tokenRes = await fetch(`${SYNAPSE_URL}/_synapse/admin/v1/registration_tokens/${encodeURIComponent(token)}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` },
  });

  if (!tokenRes.ok) {
    if (tokenRes.status === 404) {
      return jsonResponse({ error: 'Invalid token' }, 400);
    }
    const err = await tokenRes.json().catch(() => ({}));
    return jsonResponse({ error: err.error || 'Token validation failed' }, tokenRes.status);
  }

  const tokenInfo = await tokenRes.json();

  if (tokenInfo.uses_allowed !== null && tokenInfo.completed >= tokenInfo.uses_allowed) {
    return jsonResponse({ error: 'Token has already been used' }, 400);
  }
  if (tokenInfo.expiry_time !== null && Date.now() > tokenInfo.expiry_time) {
    return jsonResponse({ error: 'Token has expired' }, 400);
  }

  // Step 2: Register the user via /admin/v1/register (uses shared_secret + nonce + HMAC)
  const nonceRes = await fetch(`${SYNAPSE_URL}/_synapse/admin/v1/register`);
  if (!nonceRes.ok) {
    return jsonResponse({ error: 'Could not reach Matrix server' }, 502);
  }
  const { nonce } = await nonceRes.json();

  const mac = await generateMAC(nonce, username, password, false, sharedSecret);

  const regRes = await fetch(`${SYNAPSE_URL}/_synapse/admin/v1/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nonce,
      username,
      password,
      admin: false,
      mac,
    }),
  });

  if (!regRes.ok) {
    const err = await regRes.json().catch(() => ({}));
    const msg = err.error || 'Registration failed';
    if (msg.toLowerCase().includes('user in use') || msg.toLowerCase().includes('already taken')) {
      return jsonResponse({ error: 'Username already taken' }, 400);
    }
    return jsonResponse({ error: msg }, regRes.status);
  }

  const result = await regRes.json();
  return jsonResponse({
    success: true,
    user_id: result.user_id,
  }, 200);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function generateMAC(nonce, username, password, admin, secret) {
  const adminStr = admin ? 'admin' : 'notadmin';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const data = new TextEncoder().encode(`${nonce}\x00${username}\x00${password}\x00${adminStr}`);
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
