import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight, Boxes, CircleDollarSign, PackageCheck, Scale } from 'lucide-react'
import type { DashboardMetrics, LedgerTransaction, Product } from '../types/erp'
import { formatCompactCurrency, formatCurrency, formatDateTime } from '../utils/format'
import { EmptyState, PageHeading, Panel, TableSkeleton } from './ui'

type MetricCardProps = {
  label: string
  value: number
  supportingText: string
  icon: LucideIcon
  tone: 'blue' | 'emerald' | 'amber' | 'violet'
}

const toneStyles = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
}

function MetricCard({ label, value, supportingText, icon: Icon, tone }: MetricCardProps) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950" title={formatCurrency(value)}>
            {formatCompactCurrency(value)}
          </p>
        </div>
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${toneStyles[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-sm text-slate-500">{supportingText}</p>
    </Panel>
  )
}

type DashboardOverviewProps = {
  metrics: DashboardMetrics
  products: Product[]
  transactions: LedgerTransaction[]
  loading: boolean
}

export function DashboardOverview({
  metrics,
  products,
  transactions,
  loading,
}: DashboardOverviewProps) {
  const lowStock = products.filter((product) => product.stock > 0 && product.stock < 5)
  const outOfStock = products.filter((product) => product.stock === 0)
  const recentTransactions = transactions.slice(0, 5)

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Business overview"
        title="Good morning, here's your business pulse."
        description="A single view of cash movement, inventory value, and the stock items that need attention."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total revenue"
          value={metrics.totalRevenue}
          supportingText="All recorded sales income"
          icon={CircleDollarSign}
          tone="emerald"
        />
        <MetricCard
          label="Total expenses"
          value={metrics.totalExpenses}
          supportingText="All recorded purchase costs"
          icon={ArrowDownRight}
          tone="amber"
        />
        <MetricCard
          label="Net balance"
          value={metrics.netBalance}
          supportingText="Revenue minus expenses"
          icon={Scale}
          tone="blue"
        />
        <MetricCard
          label="Inventory value"
          value={metrics.inventoryValuation}
          supportingText="Stock at latest purchase cost"
          icon={Boxes}
          tone="violet"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Panel>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-bold text-slate-900">Recent activity</h2>
              <p className="mt-1 text-sm text-slate-500">Latest ledger movements</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {transactions.length} entries
            </span>
          </div>
          {loading ? (
            <TableSkeleton rows={4} />
          ) : recentTransactions.length === 0 ? (
            <EmptyState title="No activity yet" description="Purchases and sales will appear here." />
          ) : (
            <div className="divide-y divide-slate-100">
              {recentTransactions.map((transaction) => {
                const income = transaction.type === 'INCOME'
                return (
                  <div key={transaction.id} className="flex items-center gap-4 px-5 py-4">
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${income ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}
                    >
                      {income ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {transaction.description}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {transaction.party_name} · {formatDateTime(transaction.occurred_at)}
                      </p>
                    </div>
                    <p className={`text-sm font-bold ${income ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {income ? '+' : '−'} {formatCurrency(Number(transaction.amount))}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        <Panel>
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold text-slate-900">Stock health</h2>
            <p className="mt-1 text-sm text-slate-500">Items needing replenishment</p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-5">
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-2xl font-bold text-amber-700">{lowStock.length}</p>
              <p className="mt-1 text-sm font-medium text-amber-800">Low stock</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-4">
              <p className="text-2xl font-bold text-rose-700">{outOfStock.length}</p>
              <p className="mt-1 text-sm font-medium text-rose-800">Out of stock</p>
            </div>
          </div>
          <div className="space-y-2 px-5 pb-5">
            {[...outOfStock, ...lowStock].slice(0, 4).map((product) => (
              <div key={product.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <PackageCheck className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">{product.name}</p>
                    <p className="text-xs text-slate-500">{product.sku}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-800">{product.stock} left</span>
              </div>
            ))}
            {!loading && products.length > 0 && lowStock.length + outOfStock.length === 0 && (
              <div className="rounded-xl bg-emerald-50 px-4 py-5 text-center">
                <p className="text-sm font-semibold text-emerald-700">All products are well stocked.</p>
              </div>
            )}
            {!loading && products.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">Add products to monitor stock health.</p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
