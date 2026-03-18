# LifePlanner

A full-stack personal life planner with notes, calendar, and todos. Built with React, TypeScript, Node.js, Prisma, and PostgreSQL.

## Features

- **Notes** — Create, edit, and color-code your notes
- **Calendar** — Monthly calendar with event management
- **Todos** — Task lists with priorities, lists, and a gamified score system
- **Auth** — JWT-based authentication with refresh tokens
- **PWA** — Installable on Android, Windows, and Linux from the browser

## Quick Start (Docker)

```bash
# 1. Clone and enter directory
cd life-planner

# 2. Set up environment
cp .env.example .env
# Edit .env with your secrets

# 3. Start everything
docker-compose up -d

# 4. Open in browser
open http://localhost:5173
```

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- npm or pnpm

### Backend

```bash
cd backend
npm install

# Set up .env (copy from root .env.example)
cp ../.env.example .env
# Edit DATABASE_URL, JWT_SECRET etc.

# Push schema to database
npm run db:push

# Start dev server
npm run dev
```

### Frontend

```bash
cd frontend
npm install

# Start dev server (proxies /api to localhost:3001)
npm run dev
```

### Environment Variables

See `.env.example` for all required variables.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `FRONTEND_URL` | Frontend URL for CORS |
| `VITE_API_URL` | API base URL for the frontend |

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL
- **Auth**: JWT (access + refresh tokens), bcrypt
- **PWA**: vite-plugin-pwa (Workbox)
- **Icons**: lucide-react

## Color Scheme

Warm & friendly terracotta palette:

- Background: `#FFF8F0` (warm cream)
- Primary: `#E8825A` (coral/terracotta)
- Secondary: `#F5A623` (amber)
- Accent: `#9B7FA6` (soft purple)
- Success: `#6BAF7A` (green)
