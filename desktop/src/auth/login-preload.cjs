const params = new URLSearchParams(window.location.search);
const code = params.get('code') || '------';
const version = params.get('version') || '';
const expires = params.get('expires') || '';

window.addEventListener('DOMContentLoaded', () => {
  const codeElement = document.getElementById('code');
  const metaElement = document.getElementById('meta');
  if (/^[A-Z2-9]{6}$/.test(code)) codeElement.textContent = code;
  const expiry = Date.parse(expires);
  if (Number.isFinite(expiry)) {
    metaElement.textContent = `Version ${version.slice(0, 32)} · Expires ${new Date(expiry).toLocaleTimeString()}`;
  }
});
