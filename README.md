# Ledgerly — Simple ERP System

A clean React + TypeScript ERP starter with rich product catalogs, variant-level inventory, product images, purchases, sales, and a synchronized financial ledger powered by PostgreSQL transactions in Supabase.

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

- **Rich product catalog:** products support descriptions, categories, brands, barcodes, reorder levels, up to five images, and independently priced size/color variants.
- **Atomic catalog writes:** `save_product_catalog` creates or updates a product and its active variants in one PostgreSQL transaction. Existing products are automatically backfilled with a default variant.
- **Atomic stock writes:** `create_purchase_transaction_v2` and `create_sale_transaction_v2` lock the selected variant, update its stock, synchronize the parent product total, insert the business record, and post the ledger entry within one transaction.
- **Race-safe sales:** stock is checked after locking the exact size/color variant, preventing concurrent sales from overselling it.
- **Image storage:** files are validated client-side and stored in the public `product-images` Supabase Storage bucket; only the public URL and metadata are kept in PostgreSQL.
- **Service boundary:** components never access Supabase directly. All remote I/O lives in `src/services/erpService.ts`; `useErp` coordinates state and feedback.
- **Public demo RLS:** the included policies intentionally allow anonymous demo reads and product maintenance. Purchases, sales, and ledger writes remain restricted to the validated RPC functions. Replace demo policies with tenant ownership policies before storing real business data.
- **Responsive UI:** desktop sidebar, mobile drawer, accessible forms, loading skeletons, empty states, inline validation, and action toasts.

## Setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste the complete contents of `schema.sql`, and run it. The script is rerunnable and upgrades an existing Ledgerly database without removing current products or transactions.
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
