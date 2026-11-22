import { useState } from 'react'
import { Boxes, PackagePlus, Sparkles } from 'lucide-react'
import type { Product, Purchase, PurchaseInput } from '../types/erp'
import { dateInputToIso, formatCurrency, formatDate, todayForInput } from '../utils/format'
import { Button, EmptyState, Field, PageHeading, Panel, SelectField, TableSkeleton } from './ui'

type PurchaseForm = {
  supplierName: string
  productId: string
  quantity: string
  unitPrice: string
  date: string
}

type PurchaseErrors = Partial<Record<keyof PurchaseForm, string>>

function initialForm(): PurchaseForm {
  return { supplierName: '', productId: '', quantity: '1', unitPrice: '', date: todayForInput() }
}

type PurchaseManagerProps = {
  products: Product[]
  purchases: Purchase[]
  loading: boolean
  submitting: boolean
  onSubmit: (input: PurchaseInput) => Promise<boolean>
}

export function PurchaseManager({
  products,
  purchases,
  loading,
  submitting,
  onSubmit,
}: PurchaseManagerProps) {
  const [form, setForm] = useState<PurchaseForm>(initialForm)
  const [errors, setErrors] = useState<PurchaseErrors>({})
  const selectedProduct = products.find((product) => product.id === form.productId)
  const total = Number(form.quantity || 0) * Number(form.unitPrice || 0)

  const selectProduct = (productId: string) => {
    const product = products.find((item) => item.id === productId)
    setForm({ ...form, productId, unitPrice: product ? String(product.purchase_price) : '' })
  }

  const validate = (): PurchaseInput | null => {
    const nextErrors: PurchaseErrors = {}
    const quantity = Number(form.quantity)
    const unitPrice = Number(form.unitPrice)
    if (!form.supplierName.trim()) nextErrors.supplierName = 'Supplier name is required.'
    if (!form.productId) nextErrors.productId = 'Select a product.'
    if (!Number.isInteger(quantity) || quantity <= 0)
      nextErrors.quantity = 'Quantity must be a positive whole number.'
    if (!Number.isFinite(unitPrice) || unitPrice < 0)
      nextErrors.unitPrice = 'Enter a valid non-negative price.'
    if (!form.date) nextErrors.date = 'Purchase date is required.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return null
    return {
      supplier_name: form.supplierName,
      product_id: form.productId,
      quantity,
      unit_purchase_price: unitPrice,
      purchased_at: dateInputToIso(form.date),
    }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = validate()
    if (!input) return
    if (await onSubmit(input)) {
      setForm(initialForm())
      setErrors({})
    }
  }

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Procurement"
        title="Purchases"
        description="Record incoming goods once. Inventory and the expense ledger update together automatically."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.35fr]">
        <Panel className="h-fit">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold text-slate-900">New purchase entry</h2>
            <p className="mt-1 text-sm text-slate-500">Adds stock and records an expense atomically.</p>
          </div>
          <form className="space-y-5 p-5" onSubmit={submit}>
            <Field
              label="Supplier name"
              placeholder="e.g. Metro Tech Supply"
              value={form.supplierName}
              error={errors.supplierName}
              onChange={(event) => setForm({ ...form, supplierName: event.target.value })}
            />
            <SelectField
              label="Product"
              value={form.productId}
              error={errors.productId}
              onChange={(event) => selectProduct(event.target.value)}
              disabled={products.length === 0}
            >
              <option value="">{products.length ? 'Select a product' : 'Add a product first'}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku})
                </option>
              ))}
            </SelectField>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Field
                label="Quantity"
                type="number"
                min="1"
                step="1"
                value={form.quantity}
                error={errors.quantity}
                onChange={(event) => setForm({ ...form, quantity: event.target.value })}
              />
              <Field
                label="Unit purchase price"
                type="number"
                min="0"
                step="0.01"
                value={form.unitPrice}
                error={errors.unitPrice}
                onChange={(event) => setForm({ ...form, unitPrice: event.target.value })}
              />
            </div>
            <Field
              label="Purchase date"
              type="date"
              value={form.date}
              error={errors.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                <Sparkles className="h-4 w-4" /> Synchronized result
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-sm leading-5 text-blue-700">
                  {selectedProduct ? `Stock will increase from ${selectedProduct.stock}.` : 'Select a product to calculate stock.'}
                </p>
                <p className="shrink-0 text-lg font-bold text-blue-900">{formatCurrency(total)}</p>
              </div>
            </div>
            <Button type="submit" className="w-full" busy={submitting} disabled={products.length === 0}>
              <PackagePlus className="h-4 w-4" /> Record purchase
            </Button>
          </form>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-bold text-slate-900">Purchase history</h2>
              <p className="mt-1 text-sm text-slate-500">Most recent stock receipts</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {purchases.length} entries
            </span>
          </div>
          {loading ? (
            <TableSkeleton />
          ) : purchases.length === 0 ? (
            <EmptyState title="No purchases yet" description="Your first purchase entry will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Supplier</th>
                    <th className="px-5 py-3.5 font-semibold">Product</th>
                    <th className="px-5 py-3.5 font-semibold">Qty</th>
                    <th className="px-5 py-3.5 font-semibold">Total</th>
                    <th className="px-5 py-3.5 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchases.slice(0, 10).map((purchase) => (
                    <tr key={purchase.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4 font-semibold text-slate-800">{purchase.supplier_name}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Boxes className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-700">{purchase.product?.name ?? 'Unknown product'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{purchase.quantity}</td>
                      <td className="px-5 py-4 font-bold text-slate-900">
                        {formatCurrency(Number(purchase.total_amount))}
                      </td>
                      <td className="px-5 py-4 text-slate-500">{formatDate(purchase.purchased_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
