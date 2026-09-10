require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database/db');
const SkyworthRouter = require('./router/skyworth');

const app = express();
const PORT = process.env.PORT || 3000;

const router = new SkyworthRouter({
  ip: db.getSetting('router_ip'),
  username: db.getSetting('router_username'),
  password: db.getSetting('router_password'),
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Dashboard Stats ────────────────────────────────────

app.get('/api/dashboard/stats', (req, res) => {
  try { res.json(db.getDashboardStats()); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

// ─── Room Endpoints ─────────────────────────────────────

app.get('/api/rooms', (req, res) => {
  try { res.json(db.getAllRooms()); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/rooms/:id', (req, res) => {
  try {
    const room = db.getRoomById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/rooms', (req, res) => {
  try {
    const { room_number, max_persons, notes } = req.body;
    if (!room_number) return res.status(400).json({ error: 'Room number is required' });
    const room = db.createRoom({ room_number, max_persons, notes });
    res.status(201).json(room);
  } catch (error) {
    if (error.message.includes('UNIQUE')) return res.status(409).json({ error: 'Room number already exists' });
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/rooms/:id', (req, res) => {
  try {
    const room = db.updateRoom(req.params.id, req.body);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/rooms/:id', (req, res) => {
  try {
    const deleted = db.deleteRoom(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Room not found' });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/rooms/:id/toggle', (req, res) => {
  try {
    const room = db.toggleRoom(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─── Tenant Endpoints ────────────────────────────────────

app.get('/api/rooms/:id/tenants', (req, res) => {
  try { res.json(db.getTenantsByRoom(req.params.id)); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/tenants/:id', (req, res) => {
  try {
    const tenant = db.getTenantById(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/rooms/:id/tenants', (req, res) => {
  try {
    const { person_name, max_devices } = req.body;
    if (!person_name) return res.status(400).json({ error: 'Person name is required' });
    const tenant = db.createTenant(req.params.id, { person_name, max_devices });
    res.status(201).json(tenant);
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.put('/api/tenants/:id', (req, res) => {
  try {
    const { person_name, max_devices } = req.body;
    const tenant = db.updateTenant(req.params.id, { person_name, max_devices });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.delete('/api/tenants/:id', (req, res) => {
  try {
    const deleted = db.deleteTenant(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/tenants/:id/toggle', (req, res) => {
  try {
    const tenant = db.toggleTenant(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─── Device Endpoints ───────────────────────────────────

app.post('/api/tenants/:id/devices', (req, res) => {
  try {
    const { mac_address, device_name } = req.body;
    if (!mac_address) return res.status(400).json({ error: 'MAC address is required' });
    if (!db.isValidMac(mac_address)) return res.status(400).json({ error: 'Invalid MAC address format' });
    const device = db.createDevice(req.params.id, { mac_address, device_name });
    res.status(201).json(device);
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.delete('/api/devices/:id', (req, res) => {
  try {
    const deleted = db.deleteDevice(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Device not found' });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/devices/:id/toggle', (req, res) => {
  try {
    const device = db.toggleDevice(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─── Router Endpoints ───────────────────────────────────

app.get('/api/router/status', async (req, res) => {
  try { res.json(await router.checkConnection()); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/router/sync', async (req, res) => {
  try {
    const activeDevices = db.getAllActiveDevices();
    const macList = activeDevices.map(d => d.mac_address);
    const result = await router.syncWhitelist(macList);
    
    if (result.success) {
      activeDevices.forEach(d => db.markDeviceSynced(d.id, 1));
      db.logAction('SYNC', 'router', null, `Synced ${macList.length} devices to router`);
    }
    res.json(result);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─── Audit Log ──────────────────────────────────────────

app.get('/api/audit-log', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    res.json(db.getAuditLog(limit));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─── Settings ───────────────────────────────────────────

app.get('/api/settings', (req, res) => {
  try { res.json(db.getAllSettings()); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/settings', (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ error: 'Key and value required' });
    db.setSetting(key, value);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/settings/bulk', (req, res) => {
  try {
    const settings = req.body;
    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) db.setSetting(key, value);
    }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─── Catch-all ──────────────────────────────────────────

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ──────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║   🏠 Apartment Wi-Fi Manager             ║');
  console.log(`  ║   Running at http://localhost:${PORT}        ║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});
