# ⚡ APEX DASH: Cybernetic Telemetry System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/github/actions/workflow/status/veer0p/supabase-manager-v3/deploy.yml?branch=master)](https://github.com/veer0p/supabase-manager-v3/actions)
[![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node%20%7C%20Supabase-blue)](https://github.com/veer0p/supabase-manager-v3)

**APEX DASH** is a high-performance, real-time telemetry dashboard designed for monitoring VPS nodes and Supabase instances with a premium, physics-driven UI.

---

## 🚀 Features

*   **🏎️ Disc Brake Loader**: A custom, physics-based ignition sequence using Framer Motion for a stunning first impression.
*   **📊 Real-time Metrics**: Live tracking of CPU (RPM style), RAM (Fuel Gauge), and Disk (Odometer) usage.
*   **🔌 Node Management**: Seamlessly manage multiple VPS nodes and track their health status.
*   **📦 Supabase Integration**: Monitor Supabase instances and their operational state.
*   **🛠️ Zero-Downtime Deployment**: Integrated GitHub Actions workflow for automated deployment to VPS using PM2.
*   **🔐 Security First**: Environment-variable driven configuration with no hardcoded credentials.

---

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Framer Motion, Lucide React, Recharts, TailwindCSS.
- **Backend**: Node.js, Express, PostgreSQL (Supabase), node-ssh.
- **CI/CD**: GitHub Actions, PM2.

---

## 📦 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/veer0p/supabase-manager-v3.git
cd supabase-manager-v3
```

### 2. Install Dependencies
```bash
# Root dependencies (deployment tools)
npm install

# Frontend dependencies
cd frontend
npm install

# Backend dependencies
cd ../backend
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
VPS_IP=your_vps_ip
VPS_PASSWORD=your_vps_password
DATABASE_URL=your_postgresql_url
```

### 4. Run Locally
```bash
# From the root directory
npm run dev
```

---

## 🚢 Deployment

The project is configured for automatic deployment via GitHub Actions.

### Required GitHub Secrets:
*   `VPS_IP`: Your VPS host address.
*   `VPS_PASSWORD`: Your VPS SSH password.
*   `DATABASE_URL`: Your PostgreSQL connection string.

Pushing to the `master` branch will trigger the `Deploy to VPS` workflow.

---

## 🛡️ Architecture

APEX DASH follows a decoupled architecture:
1.  **Frontend**: A modern React SPA that handles all data visualization.
2.  **Backend**: A lightweight Node.js service providing the API and telemetry data.
3.  **Migrations**: Standalone SQL migration system for database schema management.

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ⚡ by <a href="https://github.com/veer0p">veer0p</a>
</p>
