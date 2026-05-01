# TaskFlow — Team Task Manager

A full-stack team task management application with role-based access control, built with Node.js + Express + PostgreSQL (backend) and React + Vite (frontend).

---

## Features

- **Authentication** — JWT-based signup/login with secure bcrypt password hashing
- **Projects** — Create, manage, and archive projects with deadlines and status tracking
- **Team Management** — Invite members, assign roles (Admin/Member) per project
- **Task Board** — Kanban board with To Do / In Progress / In Review / Done columns
- **Task Management** — Create, assign, prioritize, and set due dates on tasks
- **Role-Based Access** — Admins manage everything; Members can update task status only
- **Dashboard** — Aggregated stats, my tasks, status breakdown, recent activity
- **Overdue Detection** — Automatic overdue flagging with visual alerts

---

## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Backend   | Node.js, Express.js               |
| Database  | PostgreSQL                        |
| Auth      | JWT + bcryptjs                    |
| Validation| express-validator                 |
| Frontend  | React 18, React Router v6         |
| Build     | Vite                              |
| Deploy    | Railway                           |

---

## Project Structure

```
taskflow/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js         # PostgreSQL pool
│   │   │   └── migrate.js          # DB migrations
│   │   ├── controllers/
│   │   │   ├── authController.js   # Signup, login, profile
│   │   │   ├── projectController.js# Project CRUD + members
│   │   │   ├── taskController.js   # Task CRUD + comments
│   │   │   └── dashboardController.js
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT auth + role guards
│   │   ├── routes/
│   │   │   └── index.js            # All API routes
│   │   └── index.js                # Express app entry
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── context/                # React context (Auth, Toast)
│   │   ├── components/layout/      # Sidebar, AppLayout
│   │   ├── pages/                  # Dashboard, Projects, ProjectDetail, Profile
│   │   ├── utils/api.js            # Axios instance
│   │   ├── App.jsx                 # Router + providers
│   │   └── index.css               # Global design system
│   ├── .env.example
│   └── package.json
├── railway.toml
└── README.md
```

---

## Database Schema

```
users               projects            project_members
─────────           ────────            ───────────────
id (PK)             id (PK)             id (PK)
name                name                project_id (FK)
email (unique)      description         user_id (FK)
password_hash       status              role (admin|member)
avatar_color        owner_id (FK)       joined_at
created_at          deadline
updated_at          created_at

tasks               task_comments       activity_log
─────               ─────────────       ────────────
id (PK)             id (PK)             id (PK)
title               task_id (FK)        user_id (FK)
description         user_id (FK)        project_id (FK)
status              content             task_id (FK)
priority            created_at          action
project_id (FK)                         metadata
assignee_id (FK)                        created_at
created_by (FK)
due_date
tags
created_at
```

---

## API Endpoints

### Auth
```
POST   /api/auth/signup      — Register new user
POST   /api/auth/login       — Login, get JWT token
GET    /api/auth/me          — Get current user (auth required)
PATCH  /api/auth/me          — Update profile
GET    /api/users/search?q=  — Search users (auth required)
```

### Dashboard
```
GET    /api/dashboard        — Aggregated stats + my tasks
```

### Projects
```
GET    /api/projects                    — List my projects
POST   /api/projects                    — Create project
GET    /api/projects/:id                — Get project detail + members
PATCH  /api/projects/:id                — Update project (admin only)
DELETE /api/projects/:id                — Delete project (owner only)
POST   /api/projects/:id/members        — Add member (admin only)
PATCH  /api/projects/:id/members/:uid   — Change member role (admin only)
DELETE /api/projects/:id/members/:uid   — Remove member (admin only)
```

### Tasks
```
GET    /api/projects/:id/tasks                     — List tasks (filterable)
POST   /api/projects/:id/tasks                     — Create task (member+)
GET    /api/projects/:id/tasks/:tid                — Get task + comments
PATCH  /api/projects/:id/tasks/:tid                — Update task
DELETE /api/projects/:id/tasks/:tid                — Delete task
POST   /api/projects/:id/tasks/:tid/comments       — Add comment
```

---

## Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Setup

```bash
# 1. Clone and install dependencies
git clone <your-repo>
cd taskflow
npm run install:all

# 2. Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with your PostgreSQL credentials

# 3. Frontend environment
cp frontend/.env.example frontend/.env
# VITE_API_URL=http://localhost:5000/api (default)

# 4. Run migrations
cd backend && npm run db:migrate

# 5. Start both servers
cd .. && npm run dev
```

Frontend: http://localhost:5173  
Backend API: http://localhost:5000

---

## 🚀 Railway Deployment (Step-by-Step)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo>
git push -u origin main
```

### 2. Create Railway Project
1. Go to [railway.app](https://railway.app) and sign in
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository

### 3. Add PostgreSQL
1. In your Railway project, click **New** → **Database** → **PostgreSQL**
2. Railway auto-creates `DATABASE_URL` variable

### 4. Deploy Backend Service
1. Add a new Service from your repo root
2. Set **Root Directory**: `backend`
3. Set **Start Command**: `npm run db:migrate && npm start`
4. Add Environment Variables:
   ```
   DATABASE_URL = ${{Postgres.DATABASE_URL}}   (link to Postgres service)
   JWT_SECRET   = your-secure-random-string-here
   NODE_ENV     = production
   FRONTEND_URL = https://your-frontend-url.railway.app
   PORT         = 5000
   ```

### 5. Deploy Frontend Service
1. Add another Service from your repo
2. Set **Root Directory**: `frontend`
3. Add Environment Variables:
   ```
   VITE_API_URL = https://your-backend-url.railway.app/api
   ```
4. Railway auto-detects Vite and runs `npm run build`

### 6. Configure Domains
- In each service → Settings → Networking → Generate Domain
- Copy the backend domain and set it as `VITE_API_URL` in frontend
- Copy the frontend domain and set it as `FRONTEND_URL` in backend
- **Redeploy both services** after updating env vars

### 7. Verify
- Visit your frontend domain
- Sign up and create a project — you're live! 🎉

---

## Role-Based Access Control

| Action                  | Admin | Member |
|-------------------------|-------|--------|
| Create/Edit tasks       | ✅    | ❌     |
| Update task status      | ✅    | ✅     |
| Delete tasks            | ✅    | Own only |
| Manage project members  | ✅    | ❌     |
| Change member roles     | ✅    | ❌     |
| Edit project settings   | ✅    | ❌     |
| Delete project          | Owner | ❌     |
| View tasks & board      | ✅    | ✅     |
| Add comments            | ✅    | ✅     |
