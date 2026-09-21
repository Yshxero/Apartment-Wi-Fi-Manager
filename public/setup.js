/* ═══════════════════════════════════════════════════════════
   Connection Setup — Backend URL + API Key Configuration
   Shows setup modal when running on Vercel (remote mode)
   ═══════════════════════════════════════════════════════════ */

const STORAGE_KEY_URL = 'wifimanager_backend_url';
const STORAGE_KEY_API = 'wifimanager_api_key';

/**
 * Detect if we're running remotely (on Vercel or any non-localhost origin)
 */
function isRemoteMode() {
  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('192.168.');
}

/**
 * Get saved backend config from localStorage
 */
function getBackendConfig() {
  return {
    url: localStorage.getItem(STORAGE_KEY_URL) || '',
    apiKey: localStorage.getItem(STORAGE_KEY_API) || '',
  };
}

/**
 * Save backend config to localStorage
 */
function saveBackendConfig(url, apiKey) {
  localStorage.setItem(STORAGE_KEY_URL, url);
  localStorage.setItem(STORAGE_KEY_API, apiKey);
}

/**
 * Clear backend config
 */
function clearBackendConfig() {
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_API);
}

/**
 * Get the API base URL
 * - Local mode: '' (same origin)
 * - Remote mode: saved backend URL from localStorage
 */
function getApiBaseUrl() {
  if (!isRemoteMode()) return '';
  return getBackendConfig().url;
}

/**
 * Get API key for requests
 */
function getApiKey() {
  return getBackendConfig().apiKey;
}

/**
 * Test connection to the backend
 */
async function testBackendConnection(url, apiKey) {
  try {
    const cleanUrl = url.replace(/\/+$/, '');
    const opts = {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    };
    if (apiKey) opts.headers['x-api-key'] = apiKey;

    const res = await fetch(`${cleanUrl}/api/dashboard/stats`, opts);
    if (res.status === 401) {
      return { success: false, error: 'Invalid API key' };
    }
    if (!res.ok) {
      return { success: false, error: `Server error (${res.status})` };
    }
    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: 'Cannot reach backend. Check the URL and make sure ngrok is running.' };
  }
}

/**
 * Show the connection setup modal
 */
function showSetupModal(force = false) {
  const modal = document.getElementById('connectionSetupModal');
  if (!modal) return;

  // Pre-fill saved values
  const config = getBackendConfig();
  document.getElementById('setupBackendUrl').value = config.url || '';
  document.getElementById('setupApiKey').value = config.apiKey || '';
  document.getElementById('setupStatus').innerHTML = '';
  document.getElementById('setupStatus').className = 'setup-status';

  modal.classList.add('show');
}

/**
 * Handle connection setup form submission
 */
async function handleSetupSubmit(e) {
  e.preventDefault();

  const url = document.getElementById('setupBackendUrl').value.trim().replace(/\/+$/, '');
  const apiKey = document.getElementById('setupApiKey').value.trim();
  const statusEl = document.getElementById('setupStatus');
  const submitBtn = document.getElementById('setupSubmitBtn');

  if (!url) {
    statusEl.innerHTML = '❌ Please enter the backend URL';
    statusEl.className = 'setup-status error';
    return;
  }

  // Show loading
  submitBtn.disabled = true;
  submitBtn.textContent = 'Testing...';
  statusEl.innerHTML = '🔄 Testing connection...';
  statusEl.className = 'setup-status testing';

  const result = await testBackendConnection(url, apiKey);

  submitBtn.disabled = false;
  submitBtn.textContent = 'Connect';

  if (result.success) {
    saveBackendConfig(url, apiKey);
    statusEl.innerHTML = '✅ Connected! Loading dashboard...';
    statusEl.className = 'setup-status success';

    // Update the connection indicator
    updateConnectionIndicator(true);

    setTimeout(() => {
      closeModal('connectionSetupModal');
      // Reload the app with the new config
      if (typeof loadDashboard === 'function') {
        loadDashboard();
        loadRooms();
        loadAuditLog();
        checkRouterStatus();
      }
    }, 800);
  } else {
    statusEl.innerHTML = `❌ ${result.error}`;
    statusEl.className = 'setup-status error';
  }
}

/**
 * Disconnect and clear saved config
 */
function handleDisconnect() {
  clearBackendConfig();
  updateConnectionIndicator(false);
  showSetupModal(true);
}

/**
 * Update the connection indicator in the header
 */
function updateConnectionIndicator(connected) {
  const indicator = document.getElementById('connectionIndicator');
  if (!indicator) return;

  if (!isRemoteMode()) {
    indicator.innerHTML = '<span class="conn-dot local"></span><span class="conn-text">Local Mode</span>';
    return;
  }

  if (connected) {
    const config = getBackendConfig();
    // Extract the hostname for display
    let displayUrl = '';
    try {
      displayUrl = new URL(config.url).hostname;
    } catch { displayUrl = config.url; }
    indicator.innerHTML = `<span class="conn-dot online"></span><span class="conn-text" title="${config.url}">Connected</span>`;
  } else {
    indicator.innerHTML = '<span class="conn-dot offline"></span><span class="conn-text">Not Connected</span>';
  }
}

/**
 * Initialize setup — check if we need the setup modal
 */
function initConnectionSetup() {
  // If not remote mode, skip — local mode works as-is
  if (!isRemoteMode()) {
    updateConnectionIndicator(true);
    // Hide the connection button in local mode
    const btn = document.getElementById('btnConnection');
    if (btn) btn.style.display = 'none';
    return false; // no setup needed
  }

  // Show connection button
  const btn = document.getElementById('btnConnection');
  if (btn) {
    btn.style.display = '';
    btn.addEventListener('click', () => showSetupModal(true));
  }

  // Check if we have saved config
  const config = getBackendConfig();
  if (!config.url) {
    // No saved config — show setup modal
    updateConnectionIndicator(false);
    // Delay slightly so DOM is ready
    setTimeout(() => showSetupModal(true), 300);
    return true; // setup needed
  }

  // Has saved config — verify it still works
  updateConnectionIndicator(true);
  testBackendConnection(config.url, config.apiKey).then(result => {
    if (!result.success) {
      updateConnectionIndicator(false);
      showSetupModal(true);
    }
  });

  return false;
}
