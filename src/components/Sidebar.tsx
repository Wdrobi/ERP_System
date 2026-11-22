import type { LucideIcon } from 'lucide-react'
import {
  Boxes,
  ChartNoAxesCombined,
  LayoutDashboard,
  PackageSearch,
  ReceiptText,
  ShoppingCart,
  WalletCards,
  X,
} from 'lucide-react'
import type { ModuleKey } from '../types/erp'

type NavigationItem = {
  key: ModuleKey
  label: string
  description: string
  icon: LucideIcon
}

const navigation: NavigationItem[] = [
  { key: 'dashboard', label: 'Overview', description: 'Business pulse', icon: LayoutDashboard },
  { key: 'inventory', label: 'Inventory', description: 'Products & stock', icon: PackageSearch },
  { key: 'purchases', label: 'Purchases', description: 'Stock incoming', icon: ShoppingCart },
  { key: 'sales', label: 'Sales', description: 'Orders & revenue', icon: ReceiptText },
  { key: 'accounts', label: 'Accounts', description: 'Financial ledger', icon: WalletCards },
]

type SidebarProps = {
  active: ModuleKey
  isMobileOpen: boolean
  onNavigate: (module: ModuleKey) => void
  onClose: () => void
}

export function Sidebar({ active, isMobileOpen, onNavigate, onClose }: SidebarProps) {
  const content = (
    <aside className="flex h-full w-[280px] flex-col bg-slate-950 text-white">
      <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-950/20">
            <Boxes className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-base font-bold tracking-tight">Ledgerly</p>
            <p className="text-xs text-slate-400">Simple ERP</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1.5 px-3 py-6" aria-label="Primary navigation">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Workspace
        </p>
        {navigation.map((item) => {
          const Icon = item.icon
          const selected = active === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                selected
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
              aria-current={selected ? 'page' : undefined}
            >
              <Icon className={`h-5 w-5 ${selected ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className={`block text-xs ${selected ? 'text-slate-500' : 'text-slate-500'}`}>
                  {item.description}
                </span>
              </span>
            </button>
          )
        })}
      </nav>

      <div className="m-3 rounded-xl border border-white/10 bg-white/[0.06] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <ChartNoAxesCombined className="h-4 w-4 text-blue-400" />
          Live synchronization
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          Purchases, sales, stock, and accounts stay aligned through atomic database transactions.
        </p>
      </div>
    </aside>
  )

  return (
    <>
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">{content}</div>
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close navigation overlay"
          />
          <div className="relative h-full w-[280px] shadow-2xl">{content}</div>
        </div>
      )}
    </>
  )
}
