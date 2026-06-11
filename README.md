# Atria ERP

Atria ERP is a finance-first, mobile-first internal Enterprise Resource Planning (ERP) web application specifically engineered for interior design & build companies. The application is designed to prevent budget leaks, streamline project cash flow tracking, and automate bookkeeping in real-time, straight from the field.

---

## 🚀 Core Philosophy

### 1. Finance-First
Unlike traditional ERPs that start with HR or inventory, Atria ERP centers entirely on the **general ledger, project budgeting, and real-time cash flow**. Every operational activity (materials purchase, subcontractor payment, client invoicing) is recorded as a financial transaction. The company's true financial health is updated instantly.

### 2. Mobile-First (iOS 26 Solid UI/UX)
Construction and interior design projects happen on-site, not at desks. Atria ERP is optimized for mobile WebViews and mobile browsers, utilizing a bottom navigation bar, card-based layouts, and touch-optimized interfaces. Project Managers (PMs) can request funds, upload receipts, and log expenses directly from their mobile phones while on-site.

---

## 🛠 Tech Stack

The application is built using a modern, fast, and type-safe JavaScript/TypeScript ecosystem:

*   **Runtime & Package Manager:** [Bun](https://bun.sh/) (for ultra-fast package install, script running, and testing)
*   **Frontend & Framework:** [Next.js 15+ App Router](https://nextjs.org/) (React Server Components, Server Actions)
*   **Language:** [TypeScript](https://www.typescriptlang.org/) (Strict type-safety across database, business logic, and UI)
*   **Database:** [Neon PostgreSQL](https://neon.tech/) (Serverless Postgres with instant branching and scaling)
*   **ORM:** [Drizzle ORM](https://orm.drizzle.team/) (Type-safe SQL query builder and migration generator)
*   **Authentication:** [Better Auth](https://www.better-auth.com/) (Secure, modern, and extensible authentication framework)
*   **UI Components:** [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/) (Modular, customizable components styled for iOS 26 Solid design)
*   **AI Engine:** [Gemini AI](https://deepmind.google/technologies/gemini/) (For parsing receipts, auto-categorizing transactions, and drafting budget reports)

---

## 📂 Documentation Map

Below is the directory structure for project documentation. These files serve as the single source of truth (SSOT) for developers and AI agents working on Atria ERP:

```text
📁 atria-erp/
├── 📄 README.md                    # Project overview & developer setup instructions
├── 📄 AGENTS.md                    # Rules, guardrails, and instructions for AI coding agents
└── 📁 docs/
    ├── 📁 01-product/
    │   └── 📄 PRD.md               # Product Requirements (Bahasa Indonesia)
    ├── 📁 02-product/
    │   └── 📄 MVP_BLUEPRINT.md     # Module scoping, roles, and daily workflows (Bahasa Indonesia)
    ├── 📁 03-flows/
    │   └── 📄 FLOWS.md             # Financial workflows & cash flow logic (Mermaid)
    ├── 📁 04-data/
    │   ├── 📄 DATABASE_SCHEMA.md   # Complete database schemas & relations
    │   ├── 📄 STATUS_ENUMS.md      # State machine definitions for projects & transactions
    │   └── 📄 SEED_DATA.md         # Production-like mock data for local testing
    ├── 📁 05-ui-ux/
    │   ├── 📄 MOBILE_FIRST_UI_UX.md # Mobile interaction specs & wireframe blueprints
    │   └── 📄 IOS26_SOLID_DESIGN_SYSTEM.md # CSS variables, color scheme, spacing rules
    ├── 📁 06-technical/
    │   ├── 📄 STACK_DECISION.md    # In-depth architectural trade-offs
    │   ├── 📄 ARCHITECTURE.md      # Project folder structure & Server Actions logic
    │   ├── 📄 AUTH_AND_PERMISSION.md # Role-Based Access Control (RBAC) definition
    │   ├── 📄 API_ACTIONS.md       # API endpoint / Server Action schemas & Zod validations
    │   └── 📄 AI_AGENT_ARCHITECTURE.md # Receipt OCR parsing & Gemini LLM safety layers
    └── 📁 07-development/
        ├── 📄 ROADMAP.md           # Multi-phase release plan
        ├── 📄 TASK_BREAKDOWN.md    # Phased coding checklist for AI implementation
        └── 📄 IMPLEMENTATION_ORDER.md # Dependency tree & step-by-step developer guidelines
```

---

## ⚙️ Local Development Setup

Follow these steps to run Atria ERP locally. Ensure you have [Bun](https://bun.sh) installed.

### 1. Clone the Repository
```bash
git clone <repository_url>
cd atria-erp
```

### 2. Install Dependencies
```bash
bun install
```

### 3. Setup Environment Variables
Copy the template environment file and fill in the values:
```bash
cp .env.example .env
```

### 4. Setup the Database
Generate Drizzle migrations and push the schema directly to your Neon database instance:
```bash
bun run db:generate
bun run db:push
```

### 5. Seed Mock Data
Seed the database with pre-configured users, sample projects, and transactions:
```bash
bun run db:seed
```

### 6. Run the Development Server
```bash
bun run dev
```
Open [http://localhost:3000](http://localhost:3000) in your mobile browser emulator to see the app.

---

## 🔑 Environment Variables Template

Add the following variables to your `.env` file for local development:

```env
# Database Configuration
DATABASE_URL="postgres://username:password@ep-host-name.region.neon.tech/dbname?sslmode=require"

# Better Auth Configuration
BETTER_AUTH_SECRET="super-secret-random-key-at-least-32-characters"
BETTER_AUTH_URL="http://localhost:3000"

# Application URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# AI Integration
GEMINI_API_KEY="AIzaSyYourGeminiApiKeyHere"

# Node Environment
NODE_ENV="development"
```

---

## 📏 Development & Architecture Rules

1.  **Strict Type Safety:** All API requests and database queries must be strongly typed. Absolutely no `any` is allowed.
2.  **Server Actions for Mutations:** All data mutations must run via Next.js Server Actions with strict Zod validation on inputs and Role-Based authorization checks on execution.
3.  **Tailwind CSS + CSS Variables:** Styling must strictly inherit tokens defined in CSS variables (`app/globals.css`). Do not hardcode hex codes or arbitrary sizes.
4.  **No Raw SQL in App Code:** Use Drizzle ORM queries (`db.query` or `db.select`) to guarantee type-safety and syntax validation. Raw SQL is only permitted inside migrations.
5.  **Audit Logs:** Every balance-changing transaction must write to an immutable audit ledger (`cash_transaction` and `audit_log` tables).

---

## 📈 Project Status

*   **Current Phase:** Phase 1 (Product & Technical Alignment Documentation)
*   **Completed:** Git repository initialization, environment setup blueprints, and foundational architecture documentation.
*   **Next Milestone:** Phase 2 (Database Schema modeling, Drizzle Setup, and Seeder scripts).
