/**
 * bigpun.uk auth worker
 * Routes:
 *   GET  /auth          -> serve auth.html (registration form)
 *   POST /auth/api      -> validate token + create user via Synapse admin API
 */

const SYNAPSE_URL = 'https://matrix.bigpun.uk';
const SYNAPSE_ADMIN_SECRET = '_2W.h@l4oM2HaE+rRiZk+oSQ=#yO=_QEpP4dEWCvK.-D0jQ@W=';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route: registration form
    if (path === '/auth' && request.method === 'GET') {
      return new Response(renderHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Route: registration API
    if (path === '/auth/api' && request.method === 'POST') {
      return handleRegister(request);
    }

    // Everything else -> static assets (existing behavior)
    return env.ASSETS.fetch(request);
  }
};

// ─── HTML form (inline, no separate file needed) ────────────────────────────
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
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: 'Courier New', Courier, monospace;
      color: #c9b89a;
      text-align: center;
      padding: 2rem;
    }
    h1 {
      font-size: 1rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      margin-bottom: 0.5rem;
      opacity: 0;
      animation: fadein 1.5s ease forwards;
    }
    .subtitle {
      font-size: 0.8rem;
      opacity: 0;
      animation: fadein 1.5s ease 0.3s forwards;
      margin-bottom: 2.5rem;
      color: #8a7a6a;
      max-width: 400px;
      line-height: 1.6;
    }
    .gate-container {
      opacity: 0;
      animation: fadein 1.5s ease 0.6s forwards;
      width: 100%;
      max-width: 320px;
    }
    .form-group { margin-bottom: 1rem; }
    label {
      display: block;
      font-size: 0.7rem;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #6b5a4a;
      margin-bottom: 0.4rem;
      text-align: left;
    }
    input {
      width: 100%;
      padding: 0.7rem 1rem;
      background: #1a1209;
      border: 2px solid #3d2b1f;
      border-radius: 4px;
      color: #c9b89a;
      font-family: 'Courier New', monospace;
      font-size: 0.95rem;
      letter-spacing: 0.1em;
      text-align: center;
      outline: none;
      transition: border-color 0.3s, box-shadow 0.3s;
    }
    input:focus {
      border-color: #6b4f3a;
      box-shadow: 0 0 10px rgba(107, 79, 58, 0.3);
    }
    input::placeholder { color: #4a3a2a; letter-spacing: 0.1em; }
    button {
      margin-top: 0.5rem;
      width: 100%;
      padding: 0.8rem 2rem;
      background: #1a1209;
      border: 2px solid #3d2b1f;
      border-radius: 4px;
      color: #c9b89a;
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.3s;
    }
    button:hover:not(:disabled) {
      background: #2a1d14;
      border-color: #6b4f3a;
      box-shadow: 0 0 15px rgba(107, 79, 58, 0.4);
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    #result {
      margin-top: 1.2rem;
      font-size: 0.85rem;
      letter-spacing: 0.1em;
      min-height: 1.4em;
      opacity: 0;
      transition: opacity 0.3s;
    }
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
        <input type="text" id="username" placeholder="desired-username" required minlength="3" maxlength="30" pattern="[a-zA-Z0-9_.-]+" autocomplete="username" />
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
    async function submitForm(e) {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      const result = document.getElementById('result');
      const token = document.getElementById('token').value.trim();
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      result.className = '';
      result.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Creating...';

      try {
        const resp = await fetch('/auth/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, username, password })
        });
        const data = await resp.json();
        if (resp.ok) {
          result.textContent = '\u2694 Account created \u2694';
          result.style.color = '#5a8a5a';
          document.getElementById('regForm').reset();
        } else {
          result.textContent = '\u2715 ' + (data.error || 'Registration failed');
          result.style.color = '#8a3a3a';
        }
      } catch(err) {
        result.textContent = '\u2715 Network error \u2014 try again';
        result.style.color = '#8a3a3a';
      }
      result.className = 'show';
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  </script>
</body>
</html>`;
}

// ─── Registration handler ─────────────────────────────────────────────────────
async function handleRegister(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const { token, username, password } = body;

  // Basic validation
  if (!token || !username || !password) {
    return jsonResponse({ error: 'Missing fields' }, 400);
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return jsonResponse({ error: 'Username may only contain letters, numbers, dots, underscores and hyphens' }, 400);
  }
  if (password.length < 8) {
    return jsonResponse({ error: 'Password must be at least 8 characters' }, 400);
  }

  // Step 1: Validate the registration token via Synapse admin API
  const tokenRes = await fetch(`${SYNAPSE_URL}/_synapse/admin/v1/registration_tokens/${encodeURIComponent(token)}`, {
    headers: { 'Authorization': `Bearer ${SYNAPSE_ADMIN_SECRET}` },
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    if (tokenRes.status === 404) {
      return jsonResponse({ error: 'Invalid token' }, 400);
    }
    return jsonResponse({ error: err.error || 'Token validation failed' }, tokenRes.status);
  }

  const tokenInfo = await tokenRes.json();

  // Check if token has uses remaining
  if (tokenInfo.uses_allowed !== null && tokenInfo.completed >= tokenInfo.uses_allowed) {
    return jsonResponse({ error: 'Token has already been used' }, 400);
  }

  // Check if token is expired
  if (tokenInfo.expiry_time !== null && Date.now() > tokenInfo.expiry_time) {
    return jsonResponse({ error: 'Token has expired' }, 400);
  }

  // Step 2: Register the user via Synapse admin API
  // Get a fresh nonce
  const nonceRes = await fetch(`${SYNAPSE_URL}/_synapse/admin/v1/register`, {
    headers: { 'Authorization': `Bearer ${SYNAPSE_ADMIN_SECRET}` },
  });

  if (!nonceRes.ok) {
    return jsonResponse({ error: 'Could not reach Matrix server' }, 502);
  }

  const { nonce } = await nonceRes.json();

  // Generate MAC (HMAC-SHA1 of the registration request)
  const mac = await generateMAC(nonce, username, password, false, SYNAPSE_ADMIN_SECRET);

  const regRes = await fetch(`${SYNAPSE_URL}/_synapse/admin/v1/register`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SYNAPSE_ADMIN_SECRET}`, 'Content-Type': 'application/json' },
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
    return jsonResponse({ error: err.error || 'Registration failed' }, regRes.status);
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
  const msg = `\x00${nonce}\x00${username}\x00${password}\x00${admin ? '1' : '0'}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
