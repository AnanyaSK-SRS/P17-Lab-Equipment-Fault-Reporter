# Lab Equipment Fault Reporter (P17)

A full-stack college laboratory equipment fault reporting, validation, classification, dispatch routing, and analytics platform built with **React**, **Chart.js**, **Python Flask**, and **SQLite**.

## Key Features

- **Landing Portal & Role-Based Authentication**: PBKDF2-SHA256 password hashing, HMAC-SHA256 session tokens, and separate dashboards for **Student/Faculty (Reporter)**, **Maintenance Handler**, and **Administrator**.
- **Dual DFA + Regex Validation Engine (`backend/dfa.py`, `backend/regex_validator.py`)**:
  - Equipment ID format: `LAB[DEPT][3-digit]-ITEM[3-digit]` (Departments: `ECE`, `MECH`, `CSE`, `CENTRAL`; e.g., `LABECE123-ITEM456`)
  - Fault Code format: `FLT[2-digit]` (e.g., `FLT12`)
  - Interactive DFA state-transition trace visualizer and mathematical equivalence verification.
- **Automatic Classification (`backend/classification.py`)**: Categorizes reports into `Safety`, `Hardware`, `Calibration`, `Software`, or `Consumable` with deterministic priority conflict resolution (`Safety > Hardware > Calibration > Software > Consumable`).
- **Routing, Dispatch & Priority Scheduling (`backend/routing.py`, `backend/dispatch.py`)**:
  - Department-to-Team routing table (`ECE → Electronics Lab`, `MECH → Mechanical Lab`, `CSE → IT Lab`, `CENTRAL → Central Stores`).
  - Unknown routing zones route to the Central Stores fallback/correction queue.
  - Capacity-aware handler assignment, backup handler failover, overflow queueing, duplicate assignment prevention, Emergency priority override, and immediate Lab Safety Officer alerts for Safety reports.
- **Analytics & Testing**: Real SQLite-backed Chart.js visualizations and a 20-case `unittest` verification suite runnable both via CLI and the in-app Validation & Test Results page.

## Demo Login Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Student (Reporter)** | `student@college.edu` | `Student@123` |
| **Faculty (Reporter)** | `faculty@college.edu` | `Faculty@123` |
| **Maintenance Handler (ECE)** | `handler.ece@college.edu` | `Handler@123` |
| **Maintenance Handler (MECH)** | `handler.mech@college.edu` | `Handler@123` |
| **Maintenance Handler (CSE)** | `handler.cse@college.edu` | `Handler@123` |
| **Administrator** | `admin@college.edu` | `Admin@123` |

## Running Locally

### Option 1: Unified Dev Server (Recommended)
```bash
npm install
npm run dev
```
This starts the Express/Vite frontend on `http://localhost:3000` and automatically boots and proxies `/api/*` to the Python backend (`backend/app.py`).

### Option 2: Standalone Python Flask Backend
```bash
cd backend
pip install -r requirements.txt
python init_db.py
python app.py
```

### Running the 20-Case Python Test Suite
```bash
python3 backend/tests/test_suite.py
```
