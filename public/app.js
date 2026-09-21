/* ═══════════════════════════════════════════════════════════
   Apartment Wi-Fi Manager — Frontend App (3-level hierarchy)
   Room → Tenant → Device
   ═══════════════════════════════════════════════════════════ */

const API = ''; // overridden by setup.js in remote mode
let selectedRoomId = null;
let rooms = [];
let currentRoomFilter = 'all';

// ─── Security: HTML Sanitizer ────────────────────────────

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Init ────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Initialize connection setup (for remote/Vercel mode)
  const needsSetup = (typeof initConnectionSetup === 'function') ? initConnectionSetup() : false;
  
  if (!needsSetup) {
    loadDashboard();
    loadRooms();
    loadAuditLog();
    checkRouterStatus();
  }
  startLiveClock();

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => renderRooms(e.target.value));
  }

  document.getElementById('btnAddRoom').addEventListener('click', () => openModal('addRoomModal'));
  document.getElementById('addRoomForm').addEventListener('submit', handleAddRoom);
  document.getElementById('editRoomForm').addEventListener('submit', handleEditRoom);
  document.getElementById('editTenantForm').addEventListener('submit', handleEditTenant);
  document.getElementById('addTenantForm').addEventListener('submit', handleAddTenant);
  document.getElementById('addDeviceForm').addEventListener('submit', handleAddDevice);
  document.getElementById('btnSettings').addEventListener('click', openSettingsModal);
  document.getElementById('settingsForm').addEventListener('submit', handleSaveSettings);
  document.getElementById('btnSync').addEventListener('click', handleSync);
  document.getElementById('btnRefreshLog').addEventListener('click', loadAuditLog);
  document.getElementById('btnCloseSyncPanel').addEventListener('click', () => {
    document.getElementById('syncPanel').style.display = 'none';
  });

  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
});

// ─── API ─────────────────────────────────────────────────

async function api(method, url, body = null) {
  const baseUrl = (typeof getApiBaseUrl === 'function') ? getApiBaseUrl() : API;
  const apiKey = (typeof getApiKey === 'function') ? getApiKey() : '';
  
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (apiKey) opts.headers['x-api-key'] = apiKey;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${url}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// ─── Dashboard ───────────────────────────────────────────

async function loadDashboard() {
  try {
    const s = await api('GET', '/api/dashboard/stats');
    document.getElementById('statTotalRooms').textContent = s.totalRooms;
    document.getElementById('statActiveTenants').textContent = s.activeTenants;
    document.getElementById('statActiveDevices').textContent = s.activeDevices;
    document.getElementById('statUnsyncedDevices').textContent = s.unsyncedDevices;
  } catch (err) { console.error(err); }
}

async function checkRouterStatus() {
  try {
    const status = await api('GET', '/api/router/status');
    const el = document.getElementById('routerStatus');
    const dot = el.querySelector('.status-dot');
    const text = el.querySelector('.status-text');
    dot.className = status.connected ? 'status-dot online' : 'status-dot offline';
    text.textContent = status.connected ? `Router: Connected (${status.ip})` : 'Router: Not Connected';
  } catch (err) { console.error(err); }
}

// ─── Rooms ───────────────────────────────────────────────

async function loadRooms() {
  try {
    rooms = await api('GET', '/api/rooms');
    renderRooms();
  } catch (err) { showToast('Failed to load rooms', 'error'); }
}

function setRoomFilter(mode, btn) {
  currentRoomFilter = mode;
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderRooms(document.getElementById('searchInput')?.value || '');
}

function renderRooms(filterQuery = '') {
  const container = document.getElementById('roomsList');
  const q = filterQuery.trim().toLowerCase();

  let filtered = rooms;

  if (currentRoomFilter === 'active') {
    filtered = filtered.filter(r => r.is_active);
  } else if (currentRoomFilter === 'available') {
    filtered = filtered.filter(r => r.tenant_count < r.max_persons);
  }

  if (q) {
    filtered = filtered.filter(room => {
      const matchRoom = room.room_number.toString().toLowerCase().includes(q);
      const matchNotes = (room.notes || '').toLowerCase().includes(q);
      return matchRoom || matchNotes;
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">🔍</span><p>${q ? 'No matching rooms' : 'No rooms found'}</p></div>`;
    return;
  }
  container.innerHTML = filtered.map(room => `
    <div class="room-card ${room.id === selectedRoomId ? 'active' : ''} ${room.is_active ? '' : 'disabled'}" onclick="selectRoom(${room.id})">
      <div class="room-icon ${room.is_active ? 'active-room' : 'inactive-room'}">${room.is_active ? '🏠' : '🚫'}</div>
      <div class="room-info">
        <div class="room-number">Room ${escapeHtml(room.room_number)}</div>
        <div class="room-tenant">👤 ${room.tenant_count}/${room.max_persons} · 📱 ${room.device_count} device${room.device_count !== 1 ? 's' : ''}</div>
      </div>
    </div>
  `).join('');
}

async function selectRoom(id) {
  selectedRoomId = id;
  renderRooms();
  await loadRoomDetail(id);
}

async function loadRoomDetail(id) {
  try {
    const room = await api('GET', `/api/rooms/${id}`);
    const tenants = await api('GET', `/api/rooms/${id}/tenants`);
    renderRoomDetail(room, tenants);
  } catch (err) { showToast('Failed to load room', 'error'); }
}

function renderRoomDetail(room, tenants) {
  const panel = document.getElementById('detailPanel');
  
  panel.innerHTML = `
    <div class="detail-header">
      <div class="detail-title-row">
        <div class="detail-title">Room ${escapeHtml(room.room_number)}</div>
        <span class="status-badge ${room.is_active ? 'active' : 'inactive'}">
          ${room.is_active ? '✅ Active' : '❌ Disabled'}
        </span>
      </div>
      <div class="detail-meta">
        <div class="detail-meta-item">👤 ${room.tenant_count}/${room.max_persons} tenants</div>
        <div class="detail-meta-item">📱 ${room.device_count} devices</div>
        ${room.notes ? `<div class="detail-meta-item">📝 ${escapeHtml(room.notes)}</div>` : ''}
      </div>
      <div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-ghost btn-sm" onclick="handleToggleRoom(${room.id})">${room.is_active ? '⏸️ Disable' : '▶️ Enable'}</button>
        <button class="btn btn-ghost btn-sm" onclick="openEditRoom(${room.id})">✏️ Edit</button>
        <button class="btn btn-ghost btn-sm" style="color: var(--color-danger);" onclick="handleDeleteRoom(${room.id})">🗑️ Delete</button>
      </div>
    </div>

    <div class="device-list-header">
      <h3>Tenants</h3>
      <button class="btn btn-primary btn-sm" onclick="openAddTenant(${room.id})"
        ${room.tenant_count >= room.max_persons ? 'disabled style="opacity:0.5;cursor:not-allowed" title="Room is full"' : ''}>
        + Add Tenant
      </button>
    </div>

    <div class="device-list" style="padding: 12px 16px;">
      ${tenants.length === 0 ? `
        <div class="empty-state"><span class="empty-icon">👤</span><p>No tenants yet</p><p class="empty-hint">Click "+ Add Tenant" to add a person</p></div>
      ` : tenants.map(tenant => renderTenantCard(tenant)).join('')}
    </div>
  `;
}

function getInitials(name) {
  if (!name) return '👤';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderTenantCard(tenant) {
  return `
    <div class="tenant-card ${tenant.is_active ? '' : 'disabled'}">
      <div class="tenant-header">
        <div class="tenant-info">
          <div class="tenant-name">
            <span class="tenant-avatar">${escapeHtml(getInitials(tenant.person_name))}</span>
            <span>${escapeHtml(tenant.person_name)}</span>
          </div>
          <div class="tenant-badges">
            <span class="tenant-badge">📱 ${tenant.device_count}/${tenant.max_devices} devices</span>
            <span class="status-badge-sm ${tenant.is_active ? 'active' : 'inactive'}">
              ${tenant.is_active ? '🟢 Active' : '🔴 Disabled'}
            </span>
          </div>
        </div>
        <div class="tenant-actions">
          <button class="btn btn-ghost btn-icon-only btn-sm" onclick="openEditTenant(${tenant.id})" title="Edit Tenant">
            ✏️
          </button>
          <button class="btn btn-ghost btn-icon-only btn-sm" onclick="handleToggleTenant(${tenant.id})" title="${tenant.is_active ? 'Disable Tenant' : 'Enable Tenant'}">
            ${tenant.is_active ? '⏸️' : '▶️'}
          </button>
          <button class="btn btn-ghost btn-icon-only btn-sm" onclick="handleDeleteTenant(${tenant.id})" title="Remove Tenant" style="color: var(--color-danger);">
            🗑️
          </button>
        </div>
      </div>

      <div class="tenant-device-section">
        <div class="tenant-device-bar">
          <span class="tenant-device-label">Registered Devices</span>
          <button class="btn btn-primary btn-sm" onclick="openAddDevice(${tenant.id})"
            ${tenant.device_count >= tenant.max_devices ? 'disabled style="opacity:0.5;cursor:not-allowed" title="Device limit reached"' : ''}>
            + Add Device
          </button>
        </div>

        ${tenant.devices && tenant.devices.length > 0 ? `
          <div class="tenant-devices">
            ${tenant.devices.map(device => `
              <div class="device-card ${device.is_active ? '' : 'disabled'}">
                <div class="sync-indicator ${device.synced_to_router ? 'synced' : 'unsynced'}" title="${device.synced_to_router ? 'Synced to router' : 'Not synced'}"></div>
                <div class="device-icon">${getDeviceIcon(device.device_name)}</div>
                <div class="device-info">
                  <div class="device-name">${escapeHtml(device.device_name || 'Unknown Device')}</div>
                  <div class="device-mac">${escapeHtml(device.mac_address)}</div>
                </div>
                <div class="device-actions">
                  <button class="btn btn-ghost btn-icon-only btn-sm" onclick="handleToggleDevice(${device.id})" title="${device.is_active ? 'Disable Device' : 'Enable Device'}">
                    ${device.is_active ? '⏸️' : '▶️'}
                  </button>
                  <button class="btn btn-ghost btn-icon-only btn-sm" onclick="handleDeleteDevice(${device.id})" title="Remove Device" style="color: var(--color-danger);">
                    🗑️
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="tenant-devices-empty">No devices registered yet</div>
        `}
      </div>
    </div>
  `;
}

// ─── Room Actions ────────────────────────────────────────

async function handleAddRoom(e) {
  e.preventDefault();
  try {
    const room = await api('POST', '/api/rooms', {
      room_number: document.getElementById('roomNumber').value.trim(),
      max_persons: parseInt(document.getElementById('maxPersons').value) || 1,
      notes: document.getElementById('roomNotes').value.trim(),
    });
    closeModal('addRoomModal');
    document.getElementById('addRoomForm').reset();
    document.getElementById('maxPersons').value = '1';
    showToast(`Room ${room.room_number} created!`, 'success');
    await refresh();
    selectRoom(room.id);
  } catch (err) { showToast(err.message, 'error'); }
}

function openEditRoom(id) {
  const room = rooms.find(r => r.id === id);
  if (!room) return;
  document.getElementById('editRoomId').value = room.id;
  document.getElementById('editRoomNumber').value = room.room_number;
  document.getElementById('editMaxPersons').value = room.max_persons;
  document.getElementById('editRoomNotes').value = room.notes || '';
  openModal('editRoomModal');
}

async function handleEditRoom(e) {
  e.preventDefault();
  const id = document.getElementById('editRoomId').value;
  try {
    await api('PUT', `/api/rooms/${id}`, {
      room_number: document.getElementById('editRoomNumber').value.trim(),
      max_persons: parseInt(document.getElementById('editMaxPersons').value) || 1,
      notes: document.getElementById('editRoomNotes').value.trim(),
    });
    closeModal('editRoomModal');
    showToast('Room updated!', 'success');
    await refresh();
    if (selectedRoomId == id) await loadRoomDetail(id);
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleToggleRoom(id) {
  try {
    const room = await api('POST', `/api/rooms/${id}/toggle`);
    showToast(`Room ${room.room_number} ${room.is_active ? 'enabled' : 'disabled'}`, 'success');
    await refresh();
    if (selectedRoomId == id) await loadRoomDetail(id);
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleDeleteRoom(id) {
  const room = rooms.find(r => r.id === id);
  if (!room) return;
  if (!await showConfirm('Delete Room', `Delete Room ${room.room_number}? All tenants and devices will be removed.`)) return;
  try {
    await api('DELETE', `/api/rooms/${id}`);
    showToast(`Room ${room.room_number} deleted`, 'success');
    selectedRoomId = null;
    document.getElementById('detailPanel').innerHTML = `<div class="empty-state"><span class="empty-icon">👈</span><p>Select a room</p></div>`;
    await refresh();
  } catch (err) { showToast(err.message, 'error'); }
}

// ─── Tenant Actions ──────────────────────────────────────

function openAddTenant(roomId) {
  document.getElementById('tenantRoomId').value = roomId;
  document.getElementById('addTenantForm').reset();
  document.getElementById('tenantRoomId').value = roomId;
  document.getElementById('tenantMaxDevices').value = '1';
  openModal('addTenantModal');
}

async function handleAddTenant(e) {
  e.preventDefault();
  const roomId = document.getElementById('tenantRoomId').value;
  try {
    const tenant = await api('POST', `/api/rooms/${roomId}/tenants`, {
      person_name: document.getElementById('personName').value.trim(),
      max_devices: parseInt(document.getElementById('tenantMaxDevices').value) || 1,
    });
    closeModal('addTenantModal');
    showToast(`${tenant.person_name} added!`, 'success');
    await refresh();
    await loadRoomDetail(roomId);
  } catch (err) { showToast(err.message, 'error'); }
}

async function openEditTenant(id) {
  try {
    const tenant = await api('GET', `/api/tenants/${id}`);
    document.getElementById('editTenantId').value = tenant.id;
    document.getElementById('editPersonName').value = tenant.person_name;
    document.getElementById('editTenantMaxDevices').value = tenant.max_devices;
    openModal('editTenantModal');
  } catch (err) {
    showToast('Failed to load tenant details', 'error');
  }
}

async function handleEditTenant(e) {
  e.preventDefault();
  const id = document.getElementById('editTenantId').value;
  try {
    await api('PUT', `/api/tenants/${id}`, {
      person_name: document.getElementById('editPersonName').value.trim(),
      max_devices: parseInt(document.getElementById('editTenantMaxDevices').value) || 1,
    });
    closeModal('editTenantModal');
    showToast('Tenant updated!', 'success');
    await refresh();
    if (selectedRoomId) await loadRoomDetail(selectedRoomId);
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleToggleTenant(id) {
  try {
    const tenant = await api('POST', `/api/tenants/${id}/toggle`);
    showToast(`${tenant.person_name} ${tenant.is_active ? 'enabled' : 'disabled'}`, 'success');
    await refresh();
    if (selectedRoomId) await loadRoomDetail(selectedRoomId);
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleDeleteTenant(id) {
  if (!await showConfirm('Remove Tenant', 'Remove this tenant and all their devices?')) return;
  try {
    await api('DELETE', `/api/tenants/${id}`);
    showToast('Tenant removed', 'success');
    await refresh();
    if (selectedRoomId) await loadRoomDetail(selectedRoomId);
  } catch (err) { showToast(err.message, 'error'); }
}

// ─── Device Actions ──────────────────────────────────────

function openAddDevice(tenantId) {
  document.getElementById('deviceTenantId').value = tenantId;
  document.getElementById('addDeviceForm').reset();
  document.getElementById('deviceTenantId').value = tenantId;
  openModal('addDeviceModal');
}

async function handleAddDevice(e) {
  e.preventDefault();
  const tenantId = document.getElementById('deviceTenantId').value;
  try {
    const device = await api('POST', `/api/tenants/${tenantId}/devices`, {
      mac_address: document.getElementById('macAddress').value.trim(),
      device_name: document.getElementById('deviceName').value.trim(),
    });
    closeModal('addDeviceModal');
    showToast(`Device ${device.device_name || device.mac_address} added!`, 'success');
    await refresh();
    if (selectedRoomId) await loadRoomDetail(selectedRoomId);
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleToggleDevice(id) {
  try {
    const device = await api('POST', `/api/devices/${id}/toggle`);
    showToast(`Device ${device.is_active ? 'enabled' : 'disabled'}`, 'success');
    await refresh();
    if (selectedRoomId) await loadRoomDetail(selectedRoomId);
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleDeleteDevice(id) {
  if (!await showConfirm('Remove Device', 'Remove this device? It will lose Wi-Fi access after sync.')) return;
  try {
    await api('DELETE', `/api/devices/${id}`);
    showToast('Device removed', 'success');
    await refresh();
    if (selectedRoomId) await loadRoomDetail(selectedRoomId);
  } catch (err) { showToast(err.message, 'error'); }
}

// ─── Router Sync ─────────────────────────────────────────

async function handleSync() {
  try {
    const result = await api('POST', '/api/router/sync');
    if (result.success) {
      showToast(`Synced ${result.synced} devices!`, 'success');
    } else {
      showSyncInstructions(result);
      showToast('Router not connected — showing manual instructions', 'warning');
    }
    await refresh();
    if (selectedRoomId) await loadRoomDetail(selectedRoomId);
  } catch (err) { showToast(err.message, 'error'); }
}

function showSyncInstructions(result) {
  const panel = document.getElementById('syncPanel');
  const container = document.getElementById('syncInstructions');
  if (!result.manualInstructions) {
    container.innerHTML = `<p style="color: var(--text-secondary);">${escapeHtml(result.message)}</p>`;
    panel.style.display = 'block';
    return;
  }
  const inst = result.manualInstructions;
  const safeRouterUrl = escapeHtml(inst.routerUrl || 'http://192.168.1.1');
  container.innerHTML = `
    <div style="margin-bottom: 16px; color: var(--text-secondary); font-size: 14px;">
      <strong>⚠️ Automatic sync not configured yet.</strong> Manually update your router:
    </div>
    ${inst.steps.slice(0, 4).map((step, i) => `
      <div class="sync-step"><div class="sync-step-number">${i + 1}</div><div>${escapeHtml(step.replace(/^\d+\.\s*/, ''))}</div></div>
    `).join('')}
    <div style="margin: 16px 0 8px; font-weight: 600; color: var(--text-primary);">MAC Addresses to Whitelist (${inst.macList.length}):</div>
    <div class="mac-list-box">
      ${inst.macList.length > 0 ? inst.macList.map(mac => `
        <div class="mac-entry"><span>${escapeHtml(mac)}</span><span class="mac-copy-btn" onclick="copyToClipboard('${escapeHtml(mac)}')" title="Copy">📋</span></div>
      `).join('') : '<span style="color: var(--text-muted);">No active devices</span>'}
    </div>
    <div class="sync-step"><div class="sync-step-number">5</div><div>Click <strong>Save / Apply</strong></div></div>
    <div class="sync-step"><div class="sync-step-number">6</div><div>Repeat for both <strong>2.4GHz</strong> and <strong>5GHz</strong></div></div>
    <div style="margin-top: 16px;">
      <a href="${safeRouterUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">🌐 Open Router Admin</a>
    </div>
  `;
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth' });
}

// ─── Audit Log ───────────────────────────────────────────

async function loadAuditLog() {
  try {
    const logs = await api('GET', '/api/audit-log?limit=30');
    const container = document.getElementById('auditList');
    if (logs.length === 0) {
      container.innerHTML = `<div class="empty-state"><span class="empty-icon">📋</span><p>No activity yet</p></div>`;
      return;
    }
    container.innerHTML = logs.map(log => `
      <div class="audit-item">
        <span class="audit-time">${escapeHtml(formatDateTime(log.created_at))}</span>
        <span class="audit-action ${escapeHtml(log.action)}">${escapeHtml(log.action)}</span>
        <span class="audit-details">${escapeHtml(log.details)}</span>
      </div>
    `).join('');
  } catch (err) { console.error(err); }
}

// ─── Helpers ─────────────────────────────────────────────

async function refresh() {
  await loadRooms();
  await loadDashboard();
  await loadAuditLog();
}

function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

function showConfirm(title, message) {
  return new Promise((resolve) => {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    openModal('confirmModal');
    const okBtn = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');
    function cleanup() { okBtn.removeEventListener('click', onOk); cancelBtn.removeEventListener('click', onCancel); closeModal('confirmModal'); }
    function onOk() { cleanup(); resolve(true); }
    function onCancel() { cleanup(); resolve(false); }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  toast.innerHTML = `<span>${icons[type] || ''}</span> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function getDeviceIcon(name) {
  if (!name) return `<img src="android.png" class="device-icon-img" alt="Device">`;
  const l = name.toLowerCase();
  if (l.includes('iphone') || l.includes('apple') || l.includes('ipad') || l.includes('mac') || l.includes('ios')) {
    return `<img src="apple.png" class="device-icon-img" alt="Apple">`;
  }
  if (l.includes('laptop') || l.includes('pc') || l.includes('windows') || l.includes('desktop') || l.includes('computer')) {
    return '💻';
  }
  return `<img src="android.png" class="device-icon-img" alt="Android">`;
}

function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : ''; }
function formatDateTime(d) { return d ? new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : ''; }

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => showToast(`Copied: ${text}`, 'success')).catch(() => {
    const input = document.createElement('input'); input.value = text; document.body.appendChild(input); input.select(); document.execCommand('copy'); document.body.removeChild(input);
    showToast(`Copied: ${text}`, 'success');
  });
}

// ─── Settings ───────────────────────────────────────────

async function openSettingsModal() {
  try {
    const settings = await api('GET', '/api/settings');
    document.getElementById('settingRouterIp').value = settings.router_ip || '192.168.1.1';
    document.getElementById('settingRouterUsername').value = settings.router_username || 'admin';
    const pwdInput = document.getElementById('settingRouterPassword');
    pwdInput.value = settings.router_password || '';
    if (settings.has_router_password) {
      pwdInput.placeholder = '•••••••• (Current password saved)';
    } else {
      pwdInput.placeholder = 'Enter router password';
    }
    openModal('settingsModal');
  } catch (err) {
    showToast('Failed to load settings', 'error');
  }
}

async function handleSaveSettings(e) {
  e.preventDefault();
  try {
    const routerIp = document.getElementById('settingRouterIp').value.trim();
    const routerUsername = document.getElementById('settingRouterUsername').value.trim();
    const routerPassword = document.getElementById('settingRouterPassword').value.trim();

    const payload = {
      router_ip: routerIp,
      router_username: routerUsername,
    };

    // Only send password if changed by user and not the masked placeholder
    if (routerPassword && routerPassword !== '••••••••') {
      payload.router_password = routerPassword;
    }

    await api('POST', '/api/settings/bulk', payload);
    closeModal('settingsModal');
    showToast('Router settings saved successfully!', 'success');
    await checkRouterStatus();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Live Clock ──────────────────────────────────────────

function startLiveClock() {
  function update() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const timeEl = document.getElementById('liveClockTime');
    const dateEl = document.getElementById('liveClockDate');
    if (timeEl) timeEl.textContent = timeStr;
    if (dateEl) dateEl.textContent = dateStr;
  }
  update();
  setInterval(update, 1000);
}
