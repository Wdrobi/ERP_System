import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Search, SlidersHorizontal, WalletCards } from 'lucide-react'
import type { LedgerTransaction, TransactionType } from '../types/erp'
import { formatCurrency, formatDateTime } from '../utils/format'
import { EmptyState, PageHeading, Panel, SelectField, TableSkeleton } from './ui'

type TypeFilter = TransactionType | 'ALL'

type AccountsLedgerProps = {
  transactions: LedgerTransaction[]
  loading: boolean
}

export function AccountsLedger({ transactions, loading }: AccountsLedgerProps) {
  const [type, setType] = useState<TypeFilter>('ALL')
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const filteredTransactions = useMemo(() => {
    const search = query.trim().toLowerCase()
    return transactions.filter((transaction) => {
      if (type !== 'ALL' && transaction.type !== type) return false
      if (from && new Date(transaction.occurred_at) < new Date(`${from}T00:00:00`)) return false
      if (to && new Date(transaction.occurred_at) > new Date(`${to}T23:59:59`)) return false
      if (
        search &&
        !transaction.party_name.toLowerCase().includes(search) &&
        !transaction.description.toLowerCase().includes(search) &&
        !transaction.reference_id.toLowerCase().includes(search)
      )
        return false
      return true
    })
  }, [from, query, to, transactions, type])

  const filteredIncome = filteredTransactions
    .filter((transaction) => transaction.type === 'INCOME')
    .reduce((total, transaction) => total + Number(transaction.amount), 0)
  const filteredExpense = filteredTransactions
    .filter((transaction) => transaction.type === 'EXPENSE')
    .reduce((total, transaction) => total + Number(transaction.amount), 0)

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Financial records"
        title="Accounts ledger"
        description="Trace every automatic income and expense entry back to its source transaction."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Panel className="p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <ArrowUpRight className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-slate-500">Filtered income</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(filteredIncome)}</p>
            </div>
          </div>
        </Panel>
        <Panel className="p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600">
              <ArrowDownLeft className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-slate-500">Filtered expenses</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(filteredExpense)}</p>
            </div>
          </div>
        </Panel>
        <Panel className="p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <WalletCards className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-slate-500">Filtered net</p>
              <p className={`mt-1 text-lg font-bold ${filteredIncome - filteredExpense < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                {formatCurrency(filteredIncome - filteredExpense)}
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="border-b border-slate-100 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <SlidersHorizontal className="h-4 w-4" /> Filter ledger
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr]">
            <label className="block text-sm font-medium text-slate-700">
              Search
              <span className="relative mt-2 block">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Party, detail, reference"
                  className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-[15px] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </span>
            </label>
            <SelectField
              label="Transaction type"
              value={type}
              onChange={(event) => setType(event.target.value as TypeFilter)}
            >
              <option value="ALL">All transaction types</option>
              <option value="INCOME">Income only</option>
              <option value="EXPENSE">Expenses only</option>
            </SelectField>
            <label className="block text-sm font-medium text-slate-700">
              From date
              <span className="relative mt-2 block">
                <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-[15px] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </span>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              To date
              <span className="relative mt-2 block">
                <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(event) => setTo(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-[15px] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </span>
            </label>
          </div>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            title={transactions.length ? 'No transactions match' : 'No ledger entries yet'}
            description={transactions.length ? 'Adjust the filters to broaden your results.' : 'Purchases and sales create ledger entries automatically.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Type</th>
                  <th className="px-5 py-3.5 font-semibold">Reference detail</th>
                  <th className="px-5 py-3.5 font-semibold">Party</th>
                  <th className="px-5 py-3.5 font-semibold">Timestamp</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((transaction) => {
                  const income = transaction.type === 'INCOME'
                  return (
                    <tr key={transaction.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${income ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' : 'bg-rose-50 text-rose-700 ring-rose-600/10'}`}>
                          {income ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownLeft className="h-3.5 w-3.5" />}
                          {transaction.type}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800">{transaction.description}</p>
                        <p className="mt-1 font-mono text-xs text-slate-400">
                          {transaction.reference_type} · {transaction.reference_id.slice(0, 8)}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{transaction.party_name}</td>
                      <td className="px-5 py-4 text-slate-500">{formatDateTime(transaction.occurred_at)}</td>
                      <td className={`px-5 py-4 text-right font-bold ${income ? 'text-emerald-700' : 'text-slate-900'}`}>
                        {income ? '+' : '−'} {formatCurrency(Number(transaction.amount))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
          Showing {filteredTransactions.length} of {transactions.length} ledger entries
        </div>
      </Panel>
    </div>
  )
}
