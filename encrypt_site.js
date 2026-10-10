#!/usr/bin/env node
/**
 * Docking Bay 94 - AES-256 Vault Encryptor
 * Encrypts app.html into a self-contained, zero-dependency index.html vault
 * using PBKDF2 (100,000 iterations) + AES-GCM 256.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = __dirname;
const SRC_FILE = path.join(BASE_DIR, 'app.html');
const DEST_FILE = path.join(BASE_DIR, 'index.html');
const PASSWORD = process.argv[2] || process.env.DB94_PASSWORD || 'gamenight';

if (!fs.existsSync(SRC_FILE)) {
  console.error('Source file app.html not found!');
  process.exit(1);
}

const plaintext = fs.readFileSync(SRC_FILE, 'utf8');

// 1. Generate cryptographic salt and IV
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);

// 2. Derive 256-bit AES key with PBKDF2
const key = crypto.pbkdf2Sync(PASSWORD, salt, 100000, 32, 'sha256');

// 3. Encrypt with AES-GCM
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();

const saltHex = salt.toString('hex');
const ivHex = iv.toString('hex');
const tagHex = tag.toString('hex');
const ciphertextB64 = encrypted.toString('base64');

// 4. Generate the self-contained encrypted index.html vault
const vaultHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="robots" content="noindex, nofollow">
  <title>Docking Bay 94 - Encrypted Vault</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #090d16;
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
    .ambient-glow {
      position: fixed;
      top: 0; left: 50%;
      transform: translateX(-50%);
      width: 600px; height: 350px;
      background: radial-gradient(ellipse at top, rgba(239, 68, 68, 0.16) 0%, rgba(59, 130, 246, 0.08) 50%, transparent 80%);
      pointer-events: none;
      z-index: 0;
    }
    .vault-card {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 440px;
      background: rgba(17, 24, 39, 0.88);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(239, 68, 68, 0.28);
      border-radius: 18px;
      padding: 2.25rem 2rem;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.75), 0 0 35px rgba(239, 68, 68, 0.12);
      text-align: center;
    }
    .crest-container {
      width: 72px; height: 72px;
      margin: 0 auto 1.25rem;
      border-radius: 16px;
      background: linear-gradient(135deg, #220808 0%, #111827 100%);
      border: 1px solid rgba(239, 68, 68, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 25px rgba(239, 68, 68, 0.22);
    }
    .vault-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.28);
      color: #f87171;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin-bottom: 0.85rem;
      font-family: 'JetBrains Mono', monospace;
    }
    .vault-title {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #ffffff;
      margin-bottom: 0.35rem;
    }
    .vault-desc {
      font-size: 0.86rem;
      color: #94a3b8;
      line-height: 1.45;
      margin-bottom: 1.75rem;
    }
    .form-group {
      margin-bottom: 1rem;
      text-align: left;
    }
    .input-label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      color: #cbd5e1;
      margin-bottom: 0.4rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .password-input {
      width: 100%;
      padding: 0.85rem 1rem;
      background: rgba(9, 13, 22, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 10px;
      color: #fff;
      font-size: 0.95rem;
      outline: none;
      transition: all 0.2s ease;
      font-family: inherit;
    }
    .password-input:focus {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
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
      accent-color: #ef4444;
      cursor: pointer;
    }
    .btn-unlock {
      width: 100%;
      padding: 0.85rem 1.25rem;
      background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
      border: 1px solid rgba(239, 68, 68, 0.5);
      border-radius: 10px;
      color: #ffffff;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.2s ease;
      box-shadow: 0 4px 18px rgba(239, 68, 68, 0.35);
    }
    .btn-unlock:hover {
      background: linear-gradient(135deg, #f87171 0%, #dc2626 100%);
      transform: translateY(-1px);
      box-shadow: 0 6px 22px rgba(239, 68, 68, 0.45);
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
      border: 1px solid rgba(239, 68, 68, 0.35);
      color: #fca5a5;
      animation: shake 0.35s ease;
    }
    .status-msg.loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: rgba(59, 130, 246, 0.12);
      border: 1px solid rgba(59, 130, 246, 0.25);
      color: #93c5fd;
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%, 60% { transform: translateX(-6px); }
      40%, 80% { transform: translateX(6px); }
    }
    .spinner {
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,0.25);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="ambient-glow"></div>

  <div class="vault-card">
    <div class="crest-container">
      <img src="assets/imperial_logo.webp" alt="Imperial Crest" style="width: 44px; height: 44px; object-fit: contain; filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.6));">
    </div>

    <div class="vault-badge">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <span>AES-256 Encrypted</span>
    </div>

    <h1 class="vault-title">Docking Bay 94</h1>
    <p class="vault-desc">Classified Game Night Archives. Enter your group authorization passcode to decrypt and unlock.</p>

    <form id="vaultForm">
      <div class="form-group">
        <label class="input-label" for="passInput">Group Passcode</label>
        <input type="password" id="passInput" class="password-input" placeholder="Enter group passcode" autocomplete="current-password" autofocus required>
      </div>

      <label class="remember-row">
        <input type="checkbox" id="rememberBox" checked>
        <span>Remember authorization on this device</span>
      </label>

      <button type="submit" class="btn-unlock" id="unlockBtn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M7 11V7a5 5 0 0 1 9.9-1"/><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/></svg>
        <span>Authorize & Decrypt</span>
      </button>

      <div id="statusBox" class="status-msg"></div>
    </form>
  </div>

  <script>
    // AES-GCM 256 Payload (zero readable plain text)
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
      const encoder = new TextEncoder();
      const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: hexToBytes(VAULT_SALT),
          iterations: 100000,
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
      showLoading('Deriving key & decrypting archives...');

      try {
        const decryptedHtml = await decryptVault(password);
        
        if (shouldSave) {
          try {
            localStorage.setItem('db94_vault_pass', password);
          } catch(e) {}
        }

        // Replace current document with decrypted app
        document.open();
        document.write(decryptedHtml);
        document.close();

      } catch (err) {
        console.error('Decryption error:', err);
        showError('Invalid authorization passcode. Access denied.');
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

    // Auto-unlock checks:
    window.addEventListener('DOMContentLoaded', () => {
      const urlParams = new URLSearchParams(window.location.search);
      const urlKey = urlParams.get('key') || urlParams.get('passcode') || urlParams.get('code');

      if (urlKey) {
        input.value = urlKey;
        handleUnlock(urlKey, true);
        return;
      }

      // Check saved password
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
