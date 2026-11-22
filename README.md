# Ledgerly — Simple ERP System

A clean React + TypeScript ERP starter that keeps inventory, purchases, sales, and the financial ledger synchronized through PostgreSQL transactions in Supabase.

## Folder structure

```text
.
├── schema.sql                    # Tables, RLS, atomic RPCs, indexes, and seed data
├── src/
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── DashboardOverview.tsx
│   │   ├── InventoryManager.tsx
│   │   ├── PurchaseManager.tsx
│   │   ├── SalesManager.tsx
│   │   ├── AccountsLedger.tsx
│   │   └── ui.tsx               # Shared presentational primitives
│   ├── hooks/useErp.ts           # UI state and data orchestration
│   ├── lib/supabase.ts           # Environment-based Supabase client
│   ├── services/erpService.ts    # All database queries and RPC calls
│   ├── types/erp.ts              # Strict domain and database types
│   ├── utils/format.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── .env.example
└── package.json
```

## Architecture

- **Atomic writes:** `create_purchase_transaction` and `create_sale_transaction` lock the selected product row, validate input, update stock, insert the business record, and post the ledger entry within one database transaction.
- **Race-safe sales:** stock is checked after `SELECT ... FOR UPDATE`, preventing concurrent sales from overselling the same stock.
- **Service boundary:** components never access Supabase directly. All remote I/O lives in `src/services/erpService.ts`; `useErp` coordinates state and feedback.
- **Public demo RLS:** the included policies intentionally allow anonymous demo reads and product maintenance. Purchases, sales, and ledger writes remain restricted to the validated RPC functions. Replace demo policies with tenant ownership policies before storing real business data.
- **Responsive UI:** desktop sidebar, mobile drawer, accessible forms, loading skeletons, empty states, inline validation, and action toasts.

## Setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste the complete contents of `schema.sql`, and run it once.
3. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

4. Add the project values from **Supabase → Project Settings → API**:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
   ```

5. Install and run:

   ```bash
   npm install
   npm run dev
   ```

6. Production check:

   ```bash
   npm run build
   ```

## Vercel deployment

Import the repository into Vercel, keep the framework preset as **Vite**, and add `VITE_SUPABASE_URL` plus `VITE_SUPABASE_ANON_KEY` under Project Settings → Environment Variables. Vercel will use `npm run build` and publish `dist/`.

## Important production note

The supplied RLS model is deliberately open for a public demo, as requested. For a multi-user production ERP, add Supabase Auth, an `organization_id` to every business table, and ownership checks using `auth.uid()` in every policy. Never expose a Supabase service-role key in a Vite environment variable.
