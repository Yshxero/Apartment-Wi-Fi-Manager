# 🏠 Apartment Wi-Fi Manager

A modern, local management system designed for apartment landlords and property owners to control tenant Wi-Fi access through **Skyworth Wi-Fi Routers** (e.g., GN256VH) using hardware MAC Address Whitelisting.

---

## 📌 Project Overview

Managing Wi-Fi access in apartment buildings can be frustrating when tenants share Wi-Fi passwords with non-paying guests or connect multiple unauthorized devices. 

**Apartment Wi-Fi Manager** solves this problem by enforcing **Hardware MAC Filtering**. Rather than sharing passwords, landlords register specific device MAC addresses for each tenant. Only approved devices can connect to the Wi-Fi network.

---

## ✨ Key Features

- 🏢 **3-Level Hierarchy Management**:
  - **Rooms**: Set room numbers and max capacity (e.g., Room 301, max 2 persons).
  - **Tenants**: Register individual tenant names with customizable device limits (e.g., Juan dela Cruz, max 1 device; can be increased if they pay for extra slots).
  - **Devices**: Register specific device names and MAC addresses (e.g., iPhone 13 `A4:B1:C7:3F:22:9E`).

- ⚡ **One-Click Router Whitelist Sync**:
  - Push all active tenant device MAC addresses directly to the **Skyworth Router** MAC filtering table with a single click.

- ⏸️ **Instant Access Control (Enable / Disable)**:
  - Temporarily disable Wi-Fi access per **Room**, per **Tenant**, or per **Device** (useful when rent or Wi-Fi fees are pending) without losing registered device records.

- 📋 **Audit Activity Log**:
  - Automatically logs every action (room additions, device registration, enable/disable toggles, router syncs) with timestamps for full accountability.

- 📊 **Real-Time Landlord Dashboard**:
  - High-level overview displaying total rooms, active tenants, connected devices, and unsynced device alerts.

- 🎨 **Modern Glassmorphic Dark UI**:
  - Fast, responsive user interface with visual device icons (Apple, Samsung, Laptops, Tablets) and status badges.

---

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (`better-sqlite3`) — zero setup, fast embedded database
- **Router Integration**: Custom HTTP Client wrapper for Skyworth GN256VH Router Web Portal
- **Frontend**: Vanilla HTML5, Custom CSS3 Design System (Glassmorphism & Variables), JavaScript ES6+

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org) (v16 or higher)
- [Git](https://git-scm.com) (or download ZIP from GitHub)

---

### 📥 Step-by-Step Installation on a New Laptop

#### Step 1: Install Node.js
1. Download & install **Node.js LTS** from [nodejs.org](https://nodejs.org).
2. Follow installer prompts (keep default options checked).

#### Step 2: Download the Project
**Option A — Using Git (Terminal / PowerShell):**
```bash
git clone https://github.com/Yshxero/Apartment-Wi-Fi-Manager.git
cd Apartment-Wi-Fi-Manager
```

**Option B — Direct ZIP Download:**
1. Visit `https://github.com/Yshxero/Apartment-Wi-Fi-Manager`.
2. Click **Code** → **Download ZIP**.
3. Extract the ZIP folder on your laptop.
4. Open Terminal / PowerShell inside the extracted folder.

#### Step 3: Install Dependencies
In Terminal / PowerShell inside the project folder, run:
```bash
npm install
```

#### Step 4: Run the App
```bash
npm start
```

#### Step 5: Open Dashboard & Configure Settings
1. Open your browser and go to `http://localhost:3000`.
2. Click **⚙️ Settings** in the top right header.
3. Enter your router's **IP Address**, **Admin Username**, and **Password**, then click **Save Settings**.

---

## 💡 How Landlords Connect Their Admin Laptops

When **MAC Whitelisting** mode is active on the router, all unlisted Wi-Fi devices are blocked. As an admin managing the system:
1. **Connect via LAN Cable** *(Recommended)*: Connect your laptop to one of the router's Ethernet LAN ports. LAN connections bypass MAC filtering entirely so you can always manage the app.
2. **Whitelist Your Admin Laptop**: Alternatively, add your laptop's Wi-Fi MAC address as a permanent device entry under your admin room.

---

## 🛡️ Recommended Security: Enable Router AP Isolation

To protect tenant privacy and safeguard your admin computer:
1. Open your Skyworth Router admin settings (`http://192.168.1.1`).
2. Go to **Wireless / WLAN Settings** → **Advanced**.
3. Turn **ON** **AP Isolation** (also called **Client Isolation** or **Station Separation**) for both 2.4GHz and 5GHz bands.
4. **Why this matters**: AP Isolation blocks connected tenants from communicating with each other's devices, scanning open ports, or probing your landlord laptop on the local network.

---

## 📄 License
ISC
