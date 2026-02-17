# Application Architecture Overview

## 🏗️ High-Level Architecture

Your application follows a **monorepo full-stack architecture** with:
- **Frontend**: React + TypeScript (client-side app)
- **Backend**: Express.js + TypeScript (API server)
- **Database**: PostgreSQL (Neon serverless)
- **Build Tool**: Vite (for frontend bundling)

```
┌─────────────────────────────────────────────────┐
│              Browser (User)                      │
└──────────────────┬──────────────────────────────┘
                    │
                    │ HTTP Requests
                    │
        ┌───────────▼────────────┐
        │   Express Server       │
        │   (Port 5000)          │
        │                        │
        │  ┌──────────────────┐ │
        │  │  API Routes      │ │ ← Handles /api/* requests
        │  │  /api/user       │ │
        │  │  /api/pricing    │ │
        │  │  /api/templates  │ │
        │  └──────────────────┘ │
        │                        │
        │  ┌──────────────────┐ │
        │  │  Frontend        │ │ ← Serves React app
        │  │  Vite (dev)      │ │
        │  │  Static (prod)   │ │
        │  └──────────────────┘ │
        └───────────┬────────────┘
                    │
                    │ SQL Queries
                    │
        ┌───────────▼────────────┐
        │   PostgreSQL Database  │
        │   (Neon Serverless)    │
        │                        │
        │  - Users               │
        │  - Subscriptions       │
        │  - Websites            │
        │  - Templates           │
        │  - etc.                │
        └────────────────────────┘
```

---

## 📁 Project Structure

```
hayc_v2.1/
├── client/                 # Frontend React Application
│   ├── index.html          # Entry HTML file
│   ├── public/             # Static assets (images, etc.)
│   └── src/                # React source code
│       ├── main.tsx        # React entry point
│       ├── App.tsx         # Main React component
│       ├── pages/          # Page components
│       ├── components/     # Reusable components
│       └── lib/            # Utilities, API client
│
├── server/                 # Backend Express Server
│   ├── index.ts           # Server entry point
│   ├── routes.ts          # API route handlers
│   ├── db.ts              # Database connection
│   ├── auth.ts            # Authentication logic
│   ├── storage.ts         # Database operations
│   └── vite.ts            # Vite integration
│
├── shared/                 # Shared code (frontend + backend)
│   ├── schema.ts          # Database schema (Drizzle ORM)
│   └── utils.ts           # Shared utilities
│
└── migrations/             # Database migration scripts
```

---

## 🎯 Frontend (React Client)

### **What is it?**
- **Technology**: React 18 + TypeScript
- **Location**: `client/` directory
- **Entry Point**: `client/src/main.tsx` → `client/src/App.tsx`
- **Styling**: Tailwind CSS + Radix UI components

### **How it's served:**

#### **Development Mode** (`npm run dev`):
```
Express Server → Vite Dev Server (middleware mode)
                ↓
            Transforms React code on-the-fly
            Hot Module Replacement (HMR)
            Live reload in browser
```

- Vite runs as **middleware** inside Express
- No build step - code is transformed on-demand
- Instant hot reload when you change files
- React code is served directly from `client/src/`

#### **Production Mode** (`npm run build` + `npm start`):
```
Express Server → Static Files (from dist/public/)
                ↓
            Pre-built React bundle
            Optimized & minified
```

- React is built into static files by Vite
- Files go to `dist/public/`
- Express serves these pre-built files
- Much faster, but requires rebuild for changes

### **Frontend Responsibilities:**
- ✅ User interface and interactions
- ✅ Form handling and validation
- ✅ API calls to backend (`/api/*`)
- ✅ Routing (React Router)
- ✅ State management (React Query)
- ✅ Authentication UI

---

## 🔧 Backend (Express Server)

### **What is it?**
- **Technology**: Express.js + TypeScript
- **Location**: `server/` directory
- **Entry Point**: `server/index.ts`
- **Port**: 5000

### **Server Responsibilities:**

#### **1. API Routes** (`server/routes.ts`)
Handles all `/api/*` requests:
- `/api/user` - User authentication & profile
- `/api/pricing` - Subscription pricing
- `/api/templates` - Website templates
- `/api/subscriptions` - Subscription management
- `/api/newsletter` - Email campaigns
- `/api/webhooks/stripe` - Payment webhooks
- And many more...

#### **2. Serving Frontend**
- **Development**: Uses Vite middleware to serve React app
- **Production**: Serves static files from `dist/public/`

#### **3. Request Flow:**
```
Browser Request
    ↓
Express Middleware (logging, CORS, parsing)
    ↓
Route Handler (/api/* or /*)
    ↓
Business Logic (storage, auth, etc.)
    ↓
Database Query (via Drizzle ORM)
    ↓
Response (JSON or HTML)
```

### **Backend Responsibilities:**
- ✅ API endpoints (`/api/*`)
- ✅ Authentication & sessions
- ✅ Database operations
- ✅ Business logic
- ✅ Integration with Stripe, AWS SES, etc.
- ✅ Serving frontend files

---

## 🗄️ Database (PostgreSQL)

### **What is it?**
- **Technology**: PostgreSQL (via Neon serverless)
- **ORM**: Drizzle ORM
- **Schema Definition**: `shared/schema.ts`
- **Connection**: `server/db.ts`

### **Database Responsibilities:**
- ✅ Store all application data:
  - Users, subscriptions, payments
  - Website progress and stages
  - Email templates and campaigns
  - Analytics data
  - Templates and tips
  - And more...

### **Connection:**
```typescript
// server/db.ts
DATABASE_URL → Neon PostgreSQL
                ↓
            Connection Pool
                ↓
            Drizzle ORM
                ↓
            Type-safe queries
```

### **Schema Management:**
- Schema defined in `shared/schema.ts` using Drizzle ORM
- Run `npm run db:push` to sync schema to database
- Migrations in `migrations/` folder (legacy/manual scripts)

---

## 🔄 Request Flow Example

### **Example: User visits homepage**

1. **Browser** → `GET http://localhost:5000/`
   ```
   Express receives request
   ```

2. **Express checks route:**
   ```
   Is it /api/*? → No
   Is it a static file? → No
   → Serve React app (index.html)
   ```

3. **React app loads:**
   ```
   Browser receives HTML + React bundle
   React initializes
   React Router determines page (home page)
   ```

4. **React makes API call:**
   ```
   Browser → GET /api/pricing
   ```

5. **Express handles API:**
   ```
   Routes to /api/pricing handler
   → Query database via Drizzle
   → Return JSON response
   ```

6. **React updates UI:**
   ```
   Receives pricing data
   Renders pricing cards
   ```

---

## 🛠️ Development vs Production

### **Development** (`npm run dev`):
```
┌─────────────────────────────────────────┐
│  Express (Port 5000)                    │
│  ├── API Routes                         │
│  └── Vite Middleware                    │
│      └── Serves React from client/src/  │
│          └── Hot reload enabled         │
└─────────────────────────────────────────┘
```

**Characteristics:**
- ✅ Fast development
- ✅ Hot reload
- ✅ Source maps for debugging
- ✅ No build step needed

### **Production** (`npm run build` + `npm start`):
```
┌─────────────────────────────────────────┐
│  Express (Port 5000)                    │
│  ├── API Routes                         │
│  └── Static Files                       │
│      └── Serves pre-built files         │
│          └── from dist/public/         │
└─────────────────────────────────────────┘
```

**Characteristics:**
- ✅ Optimized & minified
- ✅ Faster loading
- ✅ Requires build step
- ✅ No hot reload

---

## 📦 Key Technologies

### **Frontend:**
- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **React Router** - Routing
- **React Query** - Data fetching
- **Tailwind CSS** - Styling
- **Radix UI** - Component library

### **Backend:**
- **Express.js** - Web server framework
- **TypeScript** - Type safety
- **Drizzle ORM** - Database ORM
- **Passport.js** - Authentication
- **Stripe** - Payments
- **AWS SES** - Email sending
- **Nodemailer** - Email transport

### **Database:**
- **PostgreSQL** - Relational database
- **Neon** - Serverless PostgreSQL hosting
- **Drizzle ORM** - Type-safe database queries

---

## 🔐 Authentication Flow

```
1. User submits login form (frontend)
   ↓
2. POST /api/auth/login (Express)
   ↓
3. Validate credentials (server/auth.ts)
   ↓
4. Query database for user
   ↓
5. Compare passwords (bcrypt/scrypt)
   ↓
6. Create session (Express Session)
   ↓
7. Return success (Express)
   ↓
8. Store session cookie (Browser)
   ↓
9. Redirect to dashboard (React Router)
```

---

## 💳 Payment Flow (Stripe)

```
1. User selects subscription (frontend)
   ↓
2. POST /api/subscriptions/create (Express)
   ↓
3. Create Stripe checkout session
   ↓
4. Redirect to Stripe checkout
   ↓
5. User pays on Stripe
   ↓
6. Stripe webhook → POST /api/webhooks/stripe
   ↓
7. Update subscription in database
   ↓
8. Activate user's subscription
```

---

## 🎨 Shared Code

The `shared/` directory contains code used by **both** frontend and backend:

- **`shared/schema.ts`**: Database schema definitions
  - Used by backend for database queries
  - Used by frontend for TypeScript types

- **`shared/utils.ts`**: Shared utility functions

This keeps the frontend and backend in sync!

---

## 📝 Summary

| Component | Technology | Purpose | Port |
|-----------|-----------|---------|------|
| **Frontend** | React + Vite | User interface | N/A (served by Express) |
| **Backend** | Express.js | API & serving frontend | 5000 |
| **Database** | PostgreSQL (Neon) | Data storage | Remote |

**Key Point**: Everything runs through **one Express server** on port 5000:
- `/api/*` → API endpoints
- `/*` → React frontend app

This is a **monolithic architecture** - frontend and backend are tightly integrated and deployed together.


