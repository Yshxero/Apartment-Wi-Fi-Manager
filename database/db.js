const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'wifi-manager.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_number TEXT NOT NULL UNIQUE,
    max_persons INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    person_name TEXT NOT NULL,
    max_devices INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    registered_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    mac_address TEXT NOT NULL UNIQUE,
    device_name TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    synced_to_router INTEGER DEFAULT 0,
    registered_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER,
    details TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );
`);

// Insert default settings if not exists
const insertSetting = db.prepare(`
  INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
`);

insertSetting.run('router_ip', '192.168.1.1');
insertSetting.run('router_username', 'admin');
insertSetting.run('router_password', 'Converge@sky123');
insertSetting.run('wifi_name', 'Apartment WiFi');

// ─── Room helpers ────────────────────────────────────────

function getAllRooms() {
  return db.prepare(`
    SELECT r.*, 
      (SELECT COUNT(*) FROM tenants t WHERE t.room_id = r.id) as tenant_count,
      (SELECT COUNT(*) FROM tenants t WHERE t.room_id = r.id AND t.is_active = 1) as active_tenant_count,
      (SELECT COUNT(*) FROM devices d JOIN tenants t ON d.tenant_id = t.id WHERE t.room_id = r.id) as device_count,
      (SELECT COUNT(*) FROM devices d JOIN tenants t ON d.tenant_id = t.id WHERE t.room_id = r.id AND d.is_active = 1 AND t.is_active = 1) as active_device_count
    FROM rooms r 
    ORDER BY r.room_number ASC
  `).all();
}

function getRoomById(id) {
  return db.prepare(`
    SELECT r.*, 
      (SELECT COUNT(*) FROM tenants t WHERE t.room_id = r.id) as tenant_count,
      (SELECT COUNT(*) FROM tenants t WHERE t.room_id = r.id AND t.is_active = 1) as active_tenant_count,
      (SELECT COUNT(*) FROM devices d JOIN tenants t ON d.tenant_id = t.id WHERE t.room_id = r.id) as device_count,
      (SELECT COUNT(*) FROM devices d JOIN tenants t ON d.tenant_id = t.id WHERE t.room_id = r.id AND d.is_active = 1 AND t.is_active = 1) as active_device_count
    FROM rooms r 
    WHERE r.id = ?
  `).get(id);
}

function createRoom({ room_number, max_persons = 1, notes = '' }) {
  const result = db.prepare(`
    INSERT INTO rooms (room_number, max_persons, notes) 
    VALUES (?, ?, ?)
  `).run(room_number, max_persons, notes);
  
  logAction('CREATE', 'room', result.lastInsertRowid, `Room ${room_number} created`);
  return getRoomById(result.lastInsertRowid);
}

function updateRoom(id, { room_number, max_persons, is_active, notes }) {
  const room = getRoomById(id);
  if (!room) return null;

  db.prepare(`
    UPDATE rooms SET 
      room_number = COALESCE(?, room_number),
      max_persons = COALESCE(?, max_persons),
      is_active = COALESCE(?, is_active),
      notes = COALESCE(?, notes),
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(room_number, max_persons, is_active, notes, id);

  logAction('UPDATE', 'room', id, `Room ${room.room_number} updated`);
  return getRoomById(id);
}

function deleteRoom(id) {
  const room = getRoomById(id);
  if (!room) return false;

  db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
  logAction('DELETE', 'room', id, `Room ${room.room_number} deleted`);
  return true;
}

function toggleRoom(id) {
  const room = getRoomById(id);
  if (!room) return null;

  const newStatus = room.is_active ? 0 : 1;
  db.prepare('UPDATE rooms SET is_active = ?, updated_at = datetime("now", "localtime") WHERE id = ?')
    .run(newStatus, id);

  // Also toggle all tenants and their devices in this room
  const tenantIds = db.prepare('SELECT id FROM tenants WHERE room_id = ?').all(id).map(t => t.id);
  db.prepare('UPDATE tenants SET is_active = ? WHERE room_id = ?').run(newStatus, id);
  if (tenantIds.length > 0) {
    db.prepare(`UPDATE devices SET is_active = ? WHERE tenant_id IN (${tenantIds.join(',')})`).run(newStatus);
  }

  logAction('TOGGLE', 'room', id, `Room ${room.room_number} ${newStatus ? 'enabled' : 'disabled'}`);
  return getRoomById(id);
}

// ─── Tenant helpers ──────────────────────────────────────

function getTenantsByRoom(roomId) {
  const tenants = db.prepare(`
    SELECT t.*,
      (SELECT COUNT(*) FROM devices d WHERE d.tenant_id = t.id) as device_count,
      (SELECT COUNT(*) FROM devices d WHERE d.tenant_id = t.id AND d.is_active = 1) as active_device_count
    FROM tenants t 
    WHERE t.room_id = ? 
    ORDER BY t.registered_at ASC
  `).all(roomId);

  // Attach devices to each tenant
  for (const tenant of tenants) {
    tenant.devices = db.prepare('SELECT * FROM devices WHERE tenant_id = ? ORDER BY registered_at ASC').all(tenant.id);
  }

  return tenants;
}

function getTenantById(id) {
  const tenant = db.prepare(`
    SELECT t.*,
      r.room_number,
      (SELECT COUNT(*) FROM devices d WHERE d.tenant_id = t.id) as device_count,
      (SELECT COUNT(*) FROM devices d WHERE d.tenant_id = t.id AND d.is_active = 1) as active_device_count
    FROM tenants t
    JOIN rooms r ON t.room_id = r.id
    WHERE t.id = ?
  `).get(id);
  return tenant;
}

function createTenant(roomId, { person_name, max_devices = 1 }) {
  const room = getRoomById(roomId);
  if (!room) throw new Error('Room not found');

  // Check person limit
  const currentCount = db.prepare('SELECT COUNT(*) as count FROM tenants WHERE room_id = ?').get(roomId).count;
  if (currentCount >= room.max_persons) {
    throw new Error(`Room ${room.room_number} already has ${currentCount}/${room.max_persons} person(s)`);
  }

  const result = db.prepare(`
    INSERT INTO tenants (room_id, person_name, max_devices) VALUES (?, ?, ?)
  `).run(roomId, person_name, max_devices);

  logAction('REGISTER', 'tenant', result.lastInsertRowid, 
    `${person_name} added to Room ${room.room_number}`);
  
  return getTenantById(result.lastInsertRowid);
}

function updateTenant(id, { person_name, max_devices }) {
  const tenant = getTenantById(id);
  if (!tenant) return null;

  db.prepare(`
    UPDATE tenants SET person_name = ?, max_devices = ? WHERE id = ?
  `).run(person_name || tenant.person_name, max_devices || tenant.max_devices, id);

  logAction('UPDATE', 'tenant', id, `Updated ${person_name || tenant.person_name} (Max Devices: ${max_devices})`);
  return getTenantById(id);
}

function deleteTenant(id) {
  const tenant = getTenantById(id);
  if (!tenant) return false;

  db.prepare('DELETE FROM tenants WHERE id = ?').run(id);
  logAction('REMOVE', 'tenant', id, 
    `${tenant.person_name} removed from Room ${tenant.room_number}`);
  return true;
}

function toggleTenant(id) {
  const tenant = getTenantById(id);
  if (!tenant) return null;

  const newStatus = tenant.is_active ? 0 : 1;
  db.prepare('UPDATE tenants SET is_active = ? WHERE id = ?').run(newStatus, id);
  // Also toggle all devices of this tenant
  db.prepare('UPDATE devices SET is_active = ? WHERE tenant_id = ?').run(newStatus, id);

  logAction('TOGGLE', 'tenant', id, 
    `${tenant.person_name} ${newStatus ? 'enabled' : 'disabled'}`);
  
  return getTenantById(id);
}

// ─── Device helpers ──────────────────────────────────────

function getAllActiveDevices() {
  return db.prepare(`
    SELECT d.*, t.person_name, r.room_number 
    FROM devices d 
    JOIN tenants t ON d.tenant_id = t.id 
    JOIN rooms r ON t.room_id = r.id 
    WHERE d.is_active = 1 AND t.is_active = 1 AND r.is_active = 1
    ORDER BY r.room_number ASC
  `).all();
}

function createDevice(tenantId, { mac_address, device_name = '' }) {
  mac_address = normalizeMac(mac_address);

  const tenant = getTenantById(tenantId);
  if (!tenant) throw new Error('Tenant not found');

  // Check device limit
  const currentCount = db.prepare('SELECT COUNT(*) as count FROM devices WHERE tenant_id = ?').get(tenantId).count;
  if (currentCount >= tenant.max_devices) {
    throw new Error(`${tenant.person_name} already has ${currentCount}/${tenant.max_devices} device(s)`);
  }

  // Check if MAC already exists
  const existing = db.prepare('SELECT * FROM devices WHERE mac_address = ?').get(mac_address);
  if (existing) {
    throw new Error(`MAC address ${mac_address} is already registered`);
  }

  const result = db.prepare(`
    INSERT INTO devices (tenant_id, mac_address, device_name) VALUES (?, ?, ?)
  `).run(tenantId, mac_address, device_name);

  logAction('ADD_DEVICE', 'device', result.lastInsertRowid, 
    `${device_name || mac_address} added for ${tenant.person_name} (Room ${tenant.room_number})`);
  
  return db.prepare('SELECT * FROM devices WHERE id = ?').get(result.lastInsertRowid);
}

function deleteDevice(id) {
  const device = db.prepare(`
    SELECT d.*, t.person_name, r.room_number 
    FROM devices d 
    JOIN tenants t ON d.tenant_id = t.id 
    JOIN rooms r ON t.room_id = r.id 
    WHERE d.id = ?
  `).get(id);
  if (!device) return false;

  db.prepare('DELETE FROM devices WHERE id = ?').run(id);
  logAction('REMOVE_DEVICE', 'device', id, 
    `${device.device_name || device.mac_address} removed from ${device.person_name}`);
  return true;
}

function toggleDevice(id) {
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
  if (!device) return null;

  const newStatus = device.is_active ? 0 : 1;
  db.prepare('UPDATE devices SET is_active = ? WHERE id = ?').run(newStatus, id);

  logAction('TOGGLE', 'device', id, 
    `Device ${device.device_name || device.mac_address} ${newStatus ? 'enabled' : 'disabled'}`);
  
  return db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
}

function markDeviceSynced(id, synced = 1) {
  db.prepare('UPDATE devices SET synced_to_router = ? WHERE id = ?').run(synced, id);
}

// ─── Settings helpers ────────────────────────────────────

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

function getAllSettings() {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  return settings;
}

// ─── Audit log helpers ───────────────────────────────────

function logAction(action, targetType, targetId, details = '') {
  db.prepare(`
    INSERT INTO audit_log (action, target_type, target_id, details) VALUES (?, ?, ?, ?)
  `).run(action, targetType, targetId, details);
}

function getAuditLog(limit = 50) {
  return db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?').all(limit);
}

// ─── Dashboard stats ────────────────────────────────────

function getDashboardStats() {
  const totalRooms = db.prepare('SELECT COUNT(*) as count FROM rooms').get().count;
  const activeRooms = db.prepare('SELECT COUNT(*) as count FROM rooms WHERE is_active = 1').get().count;
  const totalTenants = db.prepare('SELECT COUNT(*) as count FROM tenants').get().count;
  const activeTenants = db.prepare('SELECT COUNT(*) as count FROM tenants WHERE is_active = 1').get().count;
  const totalDevices = db.prepare('SELECT COUNT(*) as count FROM devices').get().count;
  const activeDevices = db.prepare('SELECT COUNT(*) as count FROM devices WHERE is_active = 1').get().count;
  const unsyncedDevices = db.prepare('SELECT COUNT(*) as count FROM devices WHERE synced_to_router = 0 AND is_active = 1').get().count;

  return { totalRooms, activeRooms, totalTenants, activeTenants, totalDevices, activeDevices, unsyncedDevices };
}

// ─── Utility ────────────────────────────────────────────

function normalizeMac(mac) {
  const clean = mac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (clean.length !== 12) throw new Error(`Invalid MAC address: ${mac}`);
  return clean.match(/.{2}/g).join(':');
}

function isValidMac(mac) {
  try {
    normalizeMac(mac);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  db,
  // Rooms
  getAllRooms, getRoomById, createRoom, updateRoom, deleteRoom, toggleRoom,
  // Tenants
  getTenantsByRoom, getTenantById, createTenant, updateTenant, deleteTenant, toggleTenant,
  // Devices
  getAllActiveDevices, createDevice, deleteDevice, toggleDevice, markDeviceSynced,
  // Settings
  getSetting, setSetting, getAllSettings,
  // Audit
  logAction, getAuditLog,
  // Dashboard
  getDashboardStats,
  // Util
  normalizeMac, isValidMac,
};
