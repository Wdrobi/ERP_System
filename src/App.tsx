import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Menu, RefreshCw, X } from 'lucide-react'
import { AccountsLedger } from './components/AccountsLedger'
import { DashboardOverview } from './components/DashboardOverview'
import { InventoryManager } from './components/InventoryManager'
import { PurchaseManager } from './components/PurchaseManager'
import { SalesManager } from './components/SalesManager'
import { Sidebar } from './components/Sidebar'
import { Button } from './components/ui'
import { useErp } from './hooks/useErp'
import { isSupabaseConfigured } from './lib/supabase'
import type { ModuleKey } from './types/erp'

const moduleTitles: Record<ModuleKey, string> = {
  dashboard: 'Overview',
  inventory: 'Inventory',
  purchases: 'Purchases',
  sales: 'Sales',
  accounts: 'Accounts',
}

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard')
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const erp = useErp()

  const navigate = (module: ModuleKey) => {
    setActiveModule(module)
    setIsMobileOpen(false)
  }

  const content = (() => {
    switch (activeModule) {
      case 'inventory':
        return (
          <InventoryManager
            products={erp.products}
            loading={erp.loading}
            submitting={erp.submitting}
            onSave={erp.saveProduct}
          />
        )
      case 'purchases':
        return (
          <PurchaseManager
            products={erp.products}
            purchases={erp.purchases}
            loading={erp.loading}
            submitting={erp.submitting}
            onSubmit={erp.createPurchase}
          />
        )
      case 'sales':
        return (
          <SalesManager
            products={erp.products}
            sales={erp.sales}
            loading={erp.loading}
            submitting={erp.submitting}
            onSubmit={erp.createSale}
          />
        )
      case 'accounts':
        return <AccountsLedger transactions={erp.transactions} loading={erp.loading} />
      case 'dashboard':
      default:
        return (
          <DashboardOverview
            metrics={erp.metrics}
            products={erp.products}
            transactions={erp.transactions}
            loading={erp.loading}
          />
        )
    }
  })()

  return (
    <div className="min-h-screen bg-canvas text-slate-900">
      <Sidebar
        active={activeModule}
        isMobileOpen={isMobileOpen}
        onNavigate={navigate}
        onClose={() => setIsMobileOpen(false)}
      />

      <div className="min-h-screen lg:pl-[280px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="font-semibold text-slate-800">{moduleTitles[activeModule]}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void erp.refresh()}
              disabled={erp.loading || !isSupabaseConfigured}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
              aria-label="Refresh ERP data"
              title="Refresh data"
            >
              <RefreshCw className={`h-4 w-4 ${erp.loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 sm:flex">
              <span className={`h-2 w-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {isSupabaseConfigured ? 'Supabase connected' : 'Setup required'}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {!isSupabaseConfigured && (
            <div className="mb-6 flex flex-col gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold">Connect your Supabase project</p>
                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    Copy <code>.env.example</code> to <code>.env</code>, add your project URL and anon key, then restart the dev server.
                  </p>
                </div>
              </div>
            </div>
          )}

          {erp.loadError && (
            <div className="mb-6 flex flex-col gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                <div>
                  <p className="font-semibold text-rose-950">We couldn't load your ERP data</p>
                  <p className="mt-1 text-sm text-rose-700">{erp.loadError}</p>
                </div>
              </div>
              <Button variant="secondary" onClick={() => void erp.refresh()}>
                Try again
              </Button>
            </div>
          )}

          {content}
        </main>
      </div>

      {erp.notice && (
        <div
          className={`fixed bottom-4 right-4 z-[60] flex max-w-md items-start gap-3 rounded-xl border bg-white p-4 shadow-2xl ${
            erp.notice.tone === 'success' ? 'border-emerald-200' : 'border-rose-200'
          }`}
          role="status"
        >
          {erp.notice.tone === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          )}
          <p className="text-sm font-medium leading-6 text-slate-700">{erp.notice.message}</p>
          <button
            type="button"
            onClick={erp.dismissNotice}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
