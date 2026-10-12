#!/usr/bin/env node
/**
 * Docking Bay 94 - AES-256 Vault Encryptor
 * Encrypts app.html into a self-contained, zero-dependency index.html vault
 * using PBKDF2 + AES-GCM 256.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = __dirname;
const SRC_FILE = path.join(BASE_DIR, 'app.html');
const DEST_FILE = path.join(BASE_DIR, 'index.html');
const PASSWORD = (process.argv[2] || process.env.DB94_PASSWORD || 'gamenight').toLowerCase().trim();

if (!fs.existsSync(SRC_FILE)) {
  console.error('Source file app.html not found!');
  process.exit(1);
}

const plaintext = fs.readFileSync(SRC_FILE, 'utf8');

// 1. Generate cryptographic salt and IV
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);

// 2. Derive 256-bit AES key with PBKDF2 (10,000 iterations for instant mobile unlock)
const key = crypto.pbkdf2Sync(PASSWORD, salt, 10000, 32, 'sha256');

// 3. Encrypt with AES-GCM
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();

const saltHex = salt.toString('hex');
const ivHex = iv.toString('hex');
const tagHex = tag.toString('hex');
const ciphertextB64 = encrypted.toString('base64');

// 4. Generate the self-contained Star Wars themed encrypted index.html vault
const vaultHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="robots" content="noindex, nofollow">
  <title>DOCKING BAY 94 // IMPERIAL HOLONET ARCHIVES</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;800;900&family=Rajdhani:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #030509;
      background-image:
        radial-gradient(1.5px 1.5px at 15% 20%, rgba(255, 255, 255, 0.85) 50%, transparent 100%),
        radial-gradient(1px 1px at 35% 65%, rgba(255, 232, 31, 0.65) 50%, transparent 100%),
        radial-gradient(2px 2px at 70% 30%, rgba(75, 213, 238, 0.75) 50%, transparent 100%),
        radial-gradient(1px 1px at 85% 80%, rgba(255, 255, 255, 0.7) 50%, transparent 100%),
        radial-gradient(1.5px 1.5px at 50% 12%, rgba(239, 68, 68, 0.7) 50%, transparent 100%),
        radial-gradient(1px 1px at 22% 88%, rgba(255, 255, 255, 0.6) 50%, transparent 100%),
        radial-gradient(ellipse at top, rgba(220, 38, 38, 0.2) 0%, rgba(12, 20, 38, 0.5) 50%, #030509 90%);
      background-size: 320px 320px, 260px 260px, 400px 400px, 280px 280px, 350px 350px, 300px 300px, 100% 100%;
      color: #f1f5f9;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
      position: relative;
      overflow-x: hidden;
    }
    /* Subtle CRT Holocron Scanline Overlay */
    body::after {
      content: "";
      position: fixed;
      inset: 0;
      background: repeating-linear-gradient(
        to bottom,
        transparent 0px,
        transparent 2px,
        rgba(0, 0, 0, 0.25) 3px,
        rgba(0, 0, 0, 0.25) 4px
      );
      pointer-events: none;
      z-index: 2;
      opacity: 0.45;
    }
    .vault-card {
      position: relative;
      z-index: 3;
      width: 100%;
      max-width: 450px;
      background: linear-gradient(165deg, rgba(14, 20, 34, 0.94) 0%, rgba(7, 10, 18, 0.97) 100%);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 232, 31, 0.35);
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(239, 68, 68, 0.16), inset 0 0 25px rgba(75, 213, 238, 0.05);
      border-radius: 14px;
      padding: 2.25rem 2rem;
      text-align: center;
    }
    /* Tactical Corner Brackets */
    .vault-card::before, .vault-card::after {
      content: "";
      position: absolute;
      width: 18px;
      height: 18px;
      border-color: #FFE81F;
      border-style: solid;
      pointer-events: none;
    }
    .vault-card::before {
      top: -1px; left: -1px;
      border-width: 2px 0 0 2px;
      border-top-left-radius: 14px;
    }
    .vault-card::after {
      bottom: -1px; right: -1px;
      border-width: 0 2px 2px 0;
      border-bottom-right-radius: 14px;
    }
    .sector-header {
      font-family: 'Orbitron', sans-serif;
      font-size: 0.68rem;
      letter-spacing: 0.22em;
      color: #4bd5ee;
      text-transform: uppercase;
      margin-bottom: 1rem;
      text-shadow: 0 0 10px rgba(75, 213, 238, 0.5);
    }
    .crest-container {
      width: 78px; height: 78px;
      margin: 0 auto 1.15rem;
      border-radius: 50%;
      background: radial-gradient(circle, #2a0808 0%, #070a12 100%);
      border: 2px solid rgba(239, 68, 68, 0.65);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 30px rgba(239, 68, 68, 0.35), inset 0 0 15px rgba(239, 68, 68, 0.25);
    }
    .vault-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.85rem;
      border-radius: 4px;
      background: rgba(255, 232, 31, 0.1);
      border: 1px solid rgba(255, 232, 31, 0.4);
      color: #FFE81F;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 0.85rem;
      font-family: 'Orbitron', monospace;
    }
    .vault-title {
      font-family: 'Orbitron', sans-serif;
      font-size: 1.65rem;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #FFE81F;
      text-shadow: 0 0 18px rgba(255, 232, 31, 0.35);
      margin-bottom: 0.4rem;
    }
    .vault-desc {
      font-size: 0.85rem;
      color: #94a3b8;
      line-height: 1.5;
      margin-bottom: 1.65rem;
    }
    .form-group {
      margin-bottom: 1rem;
      text-align: left;
    }
    .input-label {
      display: flex;
      justify-content: space-between;
      font-family: 'Orbitron', sans-serif;
      font-size: 0.7rem;
      font-weight: 700;
      color: #4bd5ee;
      margin-bottom: 0.45rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .password-input {
      width: 100%;
      padding: 0.85rem 1rem;
      background: rgba(3, 5, 9, 0.9);
      border: 1px solid rgba(75, 213, 238, 0.35);
      border-radius: 8px;
      color: #FFE81F;
      font-size: 1rem;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: 0.08em;
      outline: none;
      transition: all 0.2s ease;
    }
    .password-input:focus {
      border-color: #FFE81F;
      box-shadow: 0 0 15px rgba(255, 232, 31, 0.25);
    }
    .remember-row {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
      font-size: 0.8rem;
      color: #94a3b8;
      cursor: pointer;
    }
    .remember-row input {
      accent-color: #FFE81F;
      cursor: pointer;
    }
    .btn-unlock {
      width: 100%;
      padding: 0.9rem 1.25rem;
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
      border: 1px solid #ef4444;
      border-radius: 8px;
      color: #ffffff;
      font-family: 'Orbitron', sans-serif;
      font-weight: 800;
      font-size: 0.88rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.55rem;
      transition: all 0.2s ease;
      box-shadow: 0 0 22px rgba(239, 68, 68, 0.4);
    }
    .btn-unlock:hover {
      background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
      border-color: #FFE81F;
      color: #FFE81F;
      transform: translateY(-1px);
      box-shadow: 0 0 28px rgba(255, 232, 31, 0.35);
    }
    .btn-unlock:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .status-msg {
      margin-top: 1rem;
      font-size: 0.82rem;
      padding: 0.65rem;
      border-radius: 8px;
      display: none;
    }
    .status-msg.error {
      display: block;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.45);
      color: #fca5a5;
      animation: shake 0.35s ease;
    }
    .status-msg.loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: rgba(75, 213, 238, 0.12);
      border: 1px solid rgba(75, 213, 238, 0.35);
      color: #4bd5ee;
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%, 60% { transform: translateX(-6px); }
      40%, 80% { transform: translateX(6px); }
    }
    .spinner {
      width: 14px; height: 14px;
      border: 2px solid rgba(75, 213, 238, 0.25);
      border-top-color: #4bd5ee;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="vault-card">
    <div class="sector-header">// MOS EISLEY SPACEPORT &bull; TATOOINE SECTOR //</div>

    <div class="crest-container">
      <img src="assets/imperial_logo.webp" alt="Imperial Crest" style="width: 48px; height: 48px; object-fit: contain; filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.8));">
    </div>

    <div class="vault-badge">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <span>IMPERIAL CLEARANCE REQUIRED</span>
    </div>

    <h1 class="vault-title">Docking Bay 94</h1>
    <p class="vault-desc">HoloNet Tactical Game Archives. Transmit your Imperial clearance code (<code style="color:#FFE81F;">gamenight</code>) to unlock the bay doors.</p>

    <form id="vaultForm">
      <div class="form-group">
        <label class="input-label" for="passInput">
          <span>Clearance Code</span>
          <span style="color:#FFE81F; opacity:0.85;">SEC-LEVEL 94</span>
        </label>
        <input type="password" id="passInput" class="password-input" placeholder="Enter clearance code..." autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" autofocus required>
      </div>

      <label class="remember-row">
        <input type="checkbox" id="rememberBox" checked>
        <span>Maintain HoloNet clearance on this datapad</span>
      </label>

      <button type="submit" class="btn-unlock" id="unlockBtn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M7 11V7a5 5 0 0 1 9.9-1"/><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/></svg>
        <span>Transmit Clearance</span>
      </button>

      <div id="statusBox" class="status-msg"></div>
    </form>
  </div>

  <script>
    const VAULT_SALT = "${saltHex}";
    const VAULT_IV = "${ivHex}";
    const VAULT_TAG = "${tagHex}";
    const VAULT_DATA = "${ciphertextB64}";

    function hexToBytes(hex) {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
      return bytes;
    }

    function base64ToBytes(b64) {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    }

    async function decryptVault(password) {
      const normalized = String(password || '').toLowerCase().trim();
      const encoder = new TextEncoder();
      const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(normalized),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: hexToBytes(VAULT_SALT),
          iterations: 10000,
          hash: 'SHA-256'
        },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const rawCipher = base64ToBytes(VAULT_DATA);
      const tag = hexToBytes(VAULT_TAG);
      const combined = new Uint8Array(rawCipher.length + tag.length);
      combined.set(rawCipher);
      combined.set(tag, rawCipher.length);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: hexToBytes(VAULT_IV) },
        derivedKey,
        combined
      );

      return new TextDecoder().decode(decrypted);
    }

    const form = document.getElementById('vaultForm');
    const input = document.getElementById('passInput');
    const statusBox = document.getElementById('statusBox');
    const unlockBtn = document.getElementById('unlockBtn');
    const rememberBox = document.getElementById('rememberBox');

    function showError(msg) {
      statusBox.className = 'status-msg error';
      statusBox.textContent = msg;
      unlockBtn.disabled = false;
      input.focus();
    }

    function showLoading(msg) {
      statusBox.className = 'status-msg loading';
      statusBox.innerHTML = '<span class="spinner"></span> <span>' + msg + '</span>';
      unlockBtn.disabled = true;
    }

    async function handleUnlock(password, shouldSave = true) {
      if (!password) return;
      const normalized = String(password).toLowerCase().trim();
      showLoading('Opening Docking Bay 94 blast doors...');

      try {
        const decryptedHtml = await decryptVault(normalized);
        
        if (shouldSave) {
          try {
            localStorage.setItem('db94_vault_pass', normalized);
          } catch(e) {}
        }

        document.open();
        document.write(decryptedHtml);
        document.close();

      } catch (err) {
        console.error('Decryption error:', err);
        showError('Clearance code rejected. Hint: gamenight');
        try {
          localStorage.removeItem('db94_vault_pass');
        } catch(e) {}
      }
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = input.value.trim();
      handleUnlock(val, rememberBox.checked);
    });

    window.addEventListener('DOMContentLoaded', () => {
      const urlParams = new URLSearchParams(window.location.search);
      const urlKey = urlParams.get('key') || urlParams.get('passcode') || urlParams.get('code');

      if (urlKey) {
        input.value = urlKey;
        handleUnlock(urlKey, true);
        return;
      }

      try {
        const saved = localStorage.getItem('db94_vault_pass');
        if (saved) {
          input.value = saved;
          handleUnlock(saved, false);
        }
      } catch(e) {}
    });
  </script>
</body>
</html>
`;

fs.writeFileSync(DEST_FILE, vaultHtml, 'utf8');
const sizeKb = Math.round(vaultHtml.length / 1024);
console.log(`✅ Successfully generated encrypted index.html (${sizeKb} KB) with AES-GCM 256.`);

