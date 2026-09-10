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
- Node.js (v16 or higher)
- Skyworth Wi-Fi Router connected to your network

### 1. Installation
Clone or download the project and install dependencies:
```bash
npm install
```

### 2. Router Configuration (`.env`)
Create a `.env` file in the root folder with your router details:
```env
PORT=3000
ROUTER_IP=192.168.1.1
ROUTER_USERNAME=admin
ROUTER_PASSWORD=admin
```

### 3. Running the Application
Start the server:
```bash
npm start
```
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 💡 How Landlords Connect Their Admin Laptops

When **MAC Whitelisting** mode is active on the router, all unlisted Wi-Fi devices are blocked. As an admin managing the system:
1. **Connect via LAN Cable** *(Recommended)*: Connect your laptop to one of the router's Ethernet LAN ports. LAN connections bypass MAC filtering entirely so you can always manage the app.
2. **Whitelist Your Admin Laptop**: Alternatively, add your laptop's Wi-Fi MAC address as a permanent device entry under your admin room.

---

## 📄 License
ISC
