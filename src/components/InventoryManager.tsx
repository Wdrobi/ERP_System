import { useMemo, useState } from 'react'
import { Edit3, PackagePlus, Search } from 'lucide-react'
import type { Product, ProductInput } from '../types/erp'
import { getProductStatus } from '../types/erp'
import { formatCurrency } from '../utils/format'
import { Button, EmptyState, Field, Modal, PageHeading, Panel, TableSkeleton } from './ui'

type ProductFormState = {
  sku: string
  name: string
  purchasePrice: string
  sellingPrice: string
  stock: string
}

const emptyForm: ProductFormState = {
  sku: '',
  name: '',
  purchasePrice: '',
  sellingPrice: '',
  stock: '0',
}

type FormErrors = Partial<Record<keyof ProductFormState, string>>

function statusStyles(stock: number): string {
  if (stock === 0) return 'bg-rose-50 text-rose-700 ring-rose-600/10'
  if (stock < 5) return 'bg-amber-50 text-amber-700 ring-amber-600/10'
  return 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
}

type InventoryManagerProps = {
  products: Product[]
  loading: boolean
  submitting: boolean
  onSave: (input: ProductInput, id?: string) => Promise<boolean>
}

export function InventoryManager({ products, loading, submitting, onSave }: InventoryManagerProps) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState<ProductFormState>(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return products
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(normalized) || product.sku.toLowerCase().includes(normalized),
    )
  }, [products, query])

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm)
    setErrors({})
    setIsFormOpen(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    setForm({
      sku: product.sku,
      name: product.name,
      purchasePrice: String(product.purchase_price),
      sellingPrice: String(product.selling_price),
      stock: String(product.stock),
    })
    setErrors({})
    setIsFormOpen(true)
  }

  const validate = (): ProductInput | null => {
    const nextErrors: FormErrors = {}
    const purchasePrice = Number(form.purchasePrice)
    const sellingPrice = Number(form.sellingPrice)
    const stock = Number(form.stock)

    if (!form.sku.trim()) nextErrors.sku = 'SKU is required.'
    if (!form.name.trim()) nextErrors.name = 'Product name is required.'
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0)
      nextErrors.purchasePrice = 'Enter a valid non-negative price.'
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0)
      nextErrors.sellingPrice = 'Enter a valid non-negative price.'
    if (!Number.isInteger(stock) || stock < 0)
      nextErrors.stock = 'Stock must be a non-negative whole number.'

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return null
    return {
      sku: form.sku,
      name: form.name,
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      stock,
    }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = validate()
    if (!input) return
    const saved = await onSave(input, editing?.id)
    if (saved) setIsFormOpen(false)
  }

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Stock control"
        title="Inventory"
        description="Manage product pricing and see real-time stock availability across your catalog."
        action={
          <Button onClick={openNew} className="sm:self-auto">
            <PackagePlus className="h-4 w-4" /> Add product
          </Button>
        }
      />

      <Panel>
        <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by product or SKU"
              className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-[15px] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              aria-label="Search products"
            />
          </div>
          <p className="text-sm font-medium text-slate-500">
            {filteredProducts.length} of {products.length} products
          </p>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            title={query ? 'No matching products' : 'Your inventory is empty'}
            description={query ? 'Try a different product name or SKU.' : 'Add your first product to begin tracking stock.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Product</th>
                  <th className="px-5 py-3.5 font-semibold">Purchase price</th>
                  <th className="px-5 py-3.5 font-semibold">Selling price</th>
                  <th className="px-5 py-3.5 font-semibold">Current stock</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{product.name}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{product.sku}</p>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-700">
                      {formatCurrency(Number(product.purchase_price))}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-700">
                      {formatCurrency(Number(product.selling_price))}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-slate-900">{product.stock}</span>
                      <span className="ml-1 text-slate-500">units</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles(product.stock)}`}>
                        {getProductStatus(product.stock)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(product)}
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        <Edit3 className="h-4 w-4" /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {isFormOpen && (
        <Modal
          title={editing ? 'Edit product' : 'Add a product'}
          description="Keep SKU, pricing, and available units accurate."
          onClose={() => setIsFormOpen(false)}
        >
          <form onSubmit={submit} className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="SKU"
                placeholder="e.g. KBD-010"
                value={form.sku}
                error={errors.sku}
                onChange={(event) => setForm({ ...form, sku: event.target.value })}
              />
              <Field
                label="Product name"
                placeholder="e.g. Mechanical Keyboard"
                value={form.name}
                error={errors.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
              <Field
                label="Purchase price"
                type="number"
                min="0"
                step="0.01"
                value={form.purchasePrice}
                error={errors.purchasePrice}
                onChange={(event) => setForm({ ...form, purchasePrice: event.target.value })}
              />
              <Field
                label="Selling price"
                type="number"
                min="0"
                step="0.01"
                value={form.sellingPrice}
                error={errors.sellingPrice}
                onChange={(event) => setForm({ ...form, sellingPrice: event.target.value })}
              />
              <Field
                label="Opening stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                error={errors.stock}
                hint="Use purchase and sales entries for routine stock movement."
                onChange={(event) => setForm({ ...form, stock: event.target.value })}
              />
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" busy={submitting}>
                {editing ? 'Save changes' : 'Add product'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
