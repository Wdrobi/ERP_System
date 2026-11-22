import { useState } from 'react'
import { BadgeCheck, CircleAlert, PackageCheck, ShoppingBag } from 'lucide-react'
import type { Product, Sale, SaleInput } from '../types/erp'
import { dateInputToIso, formatCurrency, formatDate, todayForInput } from '../utils/format'
import { Button, EmptyState, Field, PageHeading, Panel, SelectField, TableSkeleton } from './ui'

type SaleForm = {
  customerName: string
  productId: string
  quantity: string
  unitPrice: string
  date: string
}

type SaleErrors = Partial<Record<keyof SaleForm, string>>

function initialForm(): SaleForm {
  return { customerName: '', productId: '', quantity: '1', unitPrice: '', date: todayForInput() }
}

type SalesManagerProps = {
  products: Product[]
  sales: Sale[]
  loading: boolean
  submitting: boolean
  onSubmit: (input: SaleInput) => Promise<boolean>
}

export function SalesManager({ products, sales, loading, submitting, onSubmit }: SalesManagerProps) {
  const [form, setForm] = useState<SaleForm>(initialForm)
  const [errors, setErrors] = useState<SaleErrors>({})
  const selectedProduct = products.find((product) => product.id === form.productId)
  const requestedQuantity = Number(form.quantity || 0)
  const total = requestedQuantity * Number(form.unitPrice || 0)
  const exceedsStock = Boolean(selectedProduct && requestedQuantity > selectedProduct.stock)

  const selectProduct = (productId: string) => {
    const product = products.find((item) => item.id === productId)
    setForm({ ...form, productId, unitPrice: product ? String(product.selling_price) : '' })
    setErrors((current) => ({ ...current, productId: undefined, quantity: undefined }))
  }

  const validate = (): SaleInput | null => {
    const nextErrors: SaleErrors = {}
    const quantity = Number(form.quantity)
    const unitPrice = Number(form.unitPrice)
    if (!form.customerName.trim()) nextErrors.customerName = 'Customer name is required.'
    if (!form.productId) nextErrors.productId = 'Select a product.'
    if (!Number.isInteger(quantity) || quantity <= 0) {
      nextErrors.quantity = 'Quantity must be a positive whole number.'
    } else if (selectedProduct && quantity > selectedProduct.stock) {
      nextErrors.quantity = `Only ${selectedProduct.stock} units are available.`
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0)
      nextErrors.unitPrice = 'Enter a valid non-negative price.'
    if (!form.date) nextErrors.date = 'Sale date is required.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return null
    return {
      customer_name: form.customerName,
      product_id: form.productId,
      quantity,
      unit_selling_price: unitPrice,
      sold_at: dateInputToIso(form.date),
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
        eyebrow="Order desk"
        title="Sales"
        description="Create sales with live stock validation. Successful orders reduce stock and post revenue together."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.35fr]">
        <Panel className="h-fit">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold text-slate-900">New sales entry</h2>
            <p className="mt-1 text-sm text-slate-500">Available stock is checked again inside the database.</p>
          </div>
          <form className="space-y-5 p-5" onSubmit={submit}>
            <Field
              label="Customer name"
              placeholder="e.g. Northstar Retail"
              value={form.customerName}
              error={errors.customerName}
              onChange={(event) => setForm({ ...form, customerName: event.target.value })}
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
                <option key={product.id} value={product.id} disabled={product.stock === 0}>
                  {product.name} — {product.stock} in stock
                </option>
              ))}
            </SelectField>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Field
                label="Quantity"
                type="number"
                min="1"
                step="1"
                max={selectedProduct?.stock}
                value={form.quantity}
                error={errors.quantity}
                onChange={(event) => setForm({ ...form, quantity: event.target.value })}
              />
              <Field
                label="Unit selling price"
                type="number"
                min="0"
                step="0.01"
                value={form.unitPrice}
                error={errors.unitPrice}
                onChange={(event) => setForm({ ...form, unitPrice: event.target.value })}
              />
            </div>
            <Field
              label="Sale date"
              type="date"
              value={form.date}
              error={errors.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />

            <div className={`rounded-xl border p-4 ${exceedsStock ? 'border-rose-200 bg-rose-50' : 'border-emerald-100 bg-emerald-50'}`}>
              <div className={`flex items-center gap-2 text-sm font-semibold ${exceedsStock ? 'text-rose-800' : 'text-emerald-800'}`}>
                {exceedsStock ? <CircleAlert className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
                {exceedsStock ? 'Insufficient stock' : 'Stock check'}
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className={`text-sm leading-5 ${exceedsStock ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {selectedProduct
                    ? exceedsStock
                      ? `Requested ${requestedQuantity}; only ${selectedProduct.stock} available.`
                      : `${selectedProduct.stock} units available now.`
                    : 'Select a product to see availability.'}
                </p>
                <p className={`shrink-0 text-lg font-bold ${exceedsStock ? 'text-rose-900' : 'text-emerald-900'}`}>
                  {formatCurrency(total)}
                </p>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              busy={submitting}
              disabled={products.length === 0 || exceedsStock}
            >
              <ShoppingBag className="h-4 w-4" /> Record sale
            </Button>
          </form>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-bold text-slate-900">Sales history</h2>
              <p className="mt-1 text-sm text-slate-500">Most recent customer orders</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {sales.length} entries
            </span>
          </div>
          {loading ? (
            <TableSkeleton />
          ) : sales.length === 0 ? (
            <EmptyState title="No sales yet" description="Your first completed sale will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Customer</th>
                    <th className="px-5 py-3.5 font-semibold">Product</th>
                    <th className="px-5 py-3.5 font-semibold">Qty</th>
                    <th className="px-5 py-3.5 font-semibold">Total</th>
                    <th className="px-5 py-3.5 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.slice(0, 10).map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4 font-semibold text-slate-800">{sale.customer_name}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <PackageCheck className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-700">{sale.product?.name ?? 'Unknown product'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{sale.quantity}</td>
                      <td className="px-5 py-4 font-bold text-emerald-700">
                        {formatCurrency(Number(sale.total_amount))}
                      </td>
                      <td className="px-5 py-4 text-slate-500">{formatDate(sale.sold_at)}</td>
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
