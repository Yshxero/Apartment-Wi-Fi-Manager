# 📋 Apartment Wi-Fi Manager — User Guide

Welcome to the **Apartment Wi-Fi Manager**! This guide explains how to connect to the app, set up router credentials, and manage tenant Wi-Fi access.

---

## 1️⃣ First-Time Connection Setup

When you first open the web application link, a **Connect to Backend** modal will pop up.

1. Open the website URL provided by the host (e.g., `https://your-app.vercel.app`).
2. Fill in the connection form:
   - **Backend URL**: `https://xxxx.ngrok-free.dev` *(provided by the host)*
   - **API Key**: `your-api-key` *(provided by the host)*
3. Click **Connect & Save**.

> 💡 **Note**: Your browser saves these settings automatically in `localStorage`, so you will only need to do this step once unless you clear your browser cache.

---

## 2️⃣ Router Setup (One-Time)

Before syncing devices, configure the Skyworth router credentials:

1. Click the **⚙️ Settings** icon in the top navigation bar.
2. Enter the router details:
   - **Router IP Address**: Default is usually `192.168.1.1`
   - **Router Username**: Default is usually `admin`
   - **Router Password**: Enter the admin password for the router
3. Click **Save Settings**.

---

## 3️⃣ Managing Rooms, Tenants & Devices

### A. Adding a Room
1. Click the **+ Add Room** button at the top of the dashboard.
2. Enter the **Room Number** (e.g., `Room 101`).
3. Set the **Max Person Capacity** for that room.
4. Click **Create Room**.

---

### B. Adding a Tenant
1. Locate the room card on the dashboard and click **+ Add Tenant**.
2. Enter the tenant's full name (e.g., `John Doe`).
3. Set the **Max Devices Allowed** for this tenant.
4. Click **Add Tenant**.

---

### C. Registering a Device
1. Under the tenant's profile, click **+ Add Device**.
2. Enter a descriptive **Device Name** (e.g., `John's iPhone` or `Work Laptop`).
3. Enter the device's **MAC Address** (format: `AA:BB:CC:DD:EE:FF` or `AABBCCDDEEFF`).
4. Click **Register Device**.

> 📌 **How tenants find their MAC Address**:
> - **iOS / iPhone**: Settings → General → About → *Wi-Fi Address* (Ensure "Private Wi-Fi Address" is off for the apartment Wi-Fi network).
> - **Android**: Settings → About Phone → Status → *Wi-Fi MAC Address*.
> - **Windows**: Settings → Network & Internet → Wi-Fi → Hardware properties → *Physical address (MAC)*.

---

## 4️⃣ Activating, Deactivating & Syncing Wi-Fi Access

- **Granting Access**: Make sure both the Tenant and Device status toggles are turned **ON** (green).
- **Revoking Access** (unpaid rent, tenant moved out): Switch the Tenant or Device toggle to **OFF** (gray).
- **Syncing to Router**:
  - Whenever you add, remove, or toggle devices, click the **⚡ Sync to Router** button in the top menu.
  - The backend will immediately update the router's MAC filtering / ACL rules to block or allow the devices.

---

## 🔍 Troubleshooting & Status Indicators

- **Connection Indicator (Top Bar)**:
  - 🟢 **Connected (Remote)**: Backend is reachable via ngrok.
  - 🔴 **Disconnected**: Check if the backend laptop is running and ngrok is active. Click **⚙️ Setup** to update the URL/API key if needed.
- **Router Status Pill**:
  - 🟢 **Online**: Backend can communicate with the router.
  - 🔴 **Offline**: Check router IP, credentials, or physical router power/cables.
