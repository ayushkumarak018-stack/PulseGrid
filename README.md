# PulseGrid ⚡ — Real-Time IoT Streaming Analytics Platform

<div align="center">

[![MLH Global Hack Week](https://img.shields.io/badge/MLH-Global%20Hack%20Week%20%E2%7C%20Challenge%204-blueviolet?style=for-the-badge)](https://globalhackweek.mlh.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![TimescaleDB](https://img.shields.io/badge/TimescaleDB-PostgreSQL-orange?style=for-the-badge&logo=postgresql)](https://www.timescale.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

**PulseGrid** is a production-grade, real-time IoT streaming analytics platform built for **MLH Global Hack Week – Challenge 4: Build a Real-Time Streaming Analytics App**. It ingests high-frequency telemetry from distributed industrial sensors, processes time-series aggregations via TimescaleDB, streams live updates over Server-Sent Events (SSE), and renders sub-second visualizations on a cutting-edge React 19 dashboard.

</div>

---

## 🌟 Key Features

1. **🚀 Real-Time Sensor Event Generator**: Built-in background simulation engine generating continuous telemetry across 6 device nodes (`sensor-alpha-01` through `sensor-zeta-06`) with randomized anomaly spikes.
2. **🔄 Server-Sent Events (SSE) Streaming Pipeline**: Lightweight, low-latency live telemetry push from backend to client without WebSocket complexity.
3. **⏱️ TimescaleDB & Dual-Mode Fallback Architecture**: High-performance time-series hypertable storage with automatic tumbling/sliding aggregations, backed by a resilient in-memory event cache with pre-seeded demo data for instant zero-config evaluation.
4. **📊 Modern React 19 & Recharts Dashboard**: Dark-mode telemetry command center featuring live time-series charts, anomaly alert feeds, device health matrices, and system status indicators.
5. **🛡️ RESTful API & Zod Validation**: Fully typed Express API endpoints (`/api/status`, `/api/events`, `/api/analytics`, `/api/timeseries`, `/api/devices`, `/api/ingest`).

---

## 🛠️ Architecture & Tech Stack

- **Backend**: Node.js, Express, TypeScript, Server-Sent Events (SSE), Zod, node-postgres (`pg`).
- **Database**: PostgreSQL with **TimescaleDB** hypertables (`iot_sensor_events`) and sliding-window aggregations.
- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Recharts.
- **Resilience**: Dual-mode database manager with seamless in-memory fallback when PostgreSQL is unreachable.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### 1. Installation & Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/pulsegrid.git
cd pulsegrid

# Install root & server dependencies
npm install

# Install client dependencies
npm install --prefix client
```

### 2. Environment Configuration
Create a `.env` file in the root directory (optional; defaults are provided):
```env
PORT=5000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/pulsegrid
INGEST_API_KEY=pulsegrid_secret_key_123
DEMO_MODE=false
```

### 3. Run Development Servers

**Start both Backend API / Simulator & Frontend Vite Dev Server:**
```bash
npm run dev
```
- **Backend API & SSE Stream**: `http://localhost:5000`
- **Frontend Dashboard**: `http://localhost:3000`

---

## 🔌 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/status` | `GET` | System health, database connection mode, and active device count. |
| `/api/events` | `GET` | Paginated and filtered telemetry event history (`limit`, `deviceId`, `severity`). |
| `/api/analytics` | `GET` | Aggregate summary statistics (total events, anomaly rate, avg temperature/pressure). |
| `/api/timeseries` | `GET` | Time-bucketed aggregates for charts (`bucket`, `deviceId`). |
| `/api/devices` | `GET` | Status, last seen timestamp, and health metrics for all active nodes. |
| `/api/ingest` | `POST` | Ingest new sensor telemetry (requires `x-api-key` header). |
| `/api/stream` | `GET` | Real-time Server-Sent Events (SSE) telemetry stream. |

---

## 🏆 MLH Global Hack Week — Challenge 4 Submission

PulseGrid demonstrates end-to-end engineering excellence in real-time streaming analytics, combining robust time-series database design with a stunning, lightning-fast React dashboard.

<div align="center">
  <p>Built with ⚡ by the PulseGrid Team for MLH Global Hack Week.</p>
</div>
