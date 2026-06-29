# Sprintaiso Kundportal

A customer portal for forest/timber deals with customer authentication, deal management, document handling, and payment tracking.

## Prerequisites

- Node.js 18+
- Docker & Docker Compose (for PostgreSQL)
- pnpm (package manager)

## Setup

### 1. Configure Environment

`.env.example` files exist in `root/`, `backend/`, and `frontend/`. Copy or rename each to `.env`. The defaults are configured for local development:
- Database: PostgreSQL on `localhost:5432`
- Backend: `localhost:3000`
- Frontend: `localhost:5173`

### 2. Start the Database

```bash
docker-compose up -d
```

Starts PostgreSQL. Verify it's running:
```bash
docker-compose ps
```

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Initialize the Database

From the root directory:

```bash
cd backend
npx prisma generate          # Generate Prisma client from schema
npx prisma migrate deploy    # Create tables and indexes
npx prisma db seed           # Populate with test data
cd ..
```

## Running Locally

Start both servers from their respective directories:

**Backend** (API server, `localhost:3000`):
```bash
cd backend
npm run dev
```

**Frontend** (React portal, `localhost:5173`):
```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173` to access the portal.

## Test Credentials

Use these to test the application:

**Admin Account**
- Email: `admin@skogsbo.se`
- Password: `Admin123!`

**Customer Account**
- Email: `klas@example.se`
- Password: `Skog123!`

## Project Structure

- **backend/** — Node.js/Express API with Prisma ORM
  - `src/routes/` — API endpoints (auth, deals, documents, payments, messages)
  - `src/lib/` — Utilities (crypto for PII, JWT auth, validation schemas)
  - `prisma/` — Database schema and migrations

- **frontend/** — React/Vite customer portal
  - `src/pages/` — Page components
  - `src/components/` — Reusable UI components
  - `src/api/` — API client

- **shared/** — Shared types and utilities
