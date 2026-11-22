import { useEffect, useMemo, useState } from 'react'
import { Edit3, ImagePlus, PackagePlus, Plus, Search, Trash2 } from 'lucide-react'
import type { Product, ProductInput, ProductVariantInput } from '../types/erp'
import { getProductStatus, getVariantLabel } from '../types/erp'
import { formatCurrency } from '../utils/format'
import { Button, EmptyState, Field, Modal, PageHeading, Panel, TableSkeleton } from './ui'

type VariantForm = {
  id?: string
  sku: string
  size: string
  color: string
  purchasePrice: string
  sellingPrice: string
  stock: string
}

type ProductFormState = {
  sku: string
  name: string
  description: string
  category: string
  brand: string
  barcode: string
  reorderLevel: string
  variants: VariantForm[]
}

type FormErrors = Partial<Record<Exclude<keyof ProductFormState, 'variants'> | 'images', string>>

function LocalImagePreview({ file }: { file: File }) {
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    const nextUrl = URL.createObjectURL(file)
    setPreviewUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [file])

  return previewUrl ? (
    <img
      src={previewUrl}
      alt={file.name}
      className="aspect-square w-full rounded-lg border border-blue-200 object-cover"
    />
  ) : (
    <div className="aspect-square w-full animate-pulse rounded-lg bg-slate-100" />
  )
}

function blankVariant(sku = ''): VariantForm {
  return { sku, size: '', color: '', purchasePrice: '', sellingPrice: '', stock: '0' }
}

function emptyForm(): ProductFormState {
  return {
    sku: '',
    name: '',
    description: '',
    category: '',
    brand: '',
    barcode: '',
    reorderLevel: '5',
    variants: [blankVariant()],
  }
}

function statusStyles(stock: number, reorderLevel: number): string {
  if (stock === 0) return 'bg-rose-50 text-rose-700 ring-rose-600/10'
  if (stock < reorderLevel) return 'bg-amber-50 text-amber-700 ring-amber-600/10'
  return 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
}

function priceRange(product: Product, key: 'purchase_price' | 'selling_price'): string {
  const prices = product.variants.map((variant) => Number(variant[key]))
  if (prices.length === 0) return formatCurrency(Number(product[key]))
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? formatCurrency(min) : `${formatCurrency(min)} – ${formatCurrency(max)}`
}

type InventoryManagerProps = {
  products: Product[]
  loading: boolean
  submitting: boolean
  onSave: (input: ProductInput, id?: string, imageFiles?: File[]) => Promise<boolean>
}

export function InventoryManager({ products, loading, submitting, onSave }: InventoryManagerProps) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState<ProductFormState>(emptyForm)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [variantErrors, setVariantErrors] = useState<string[]>([])

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return products
    return products.filter((product) =>
      [product.name, product.sku, product.brand, product.category, product.description]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalized)),
    )
  }, [products, query])

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm())
    setImageFiles([])
    setErrors({})
    setVariantErrors([])
    setIsFormOpen(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description,
      category: product.category ?? '',
      brand: product.brand ?? '',
      barcode: product.barcode ?? '',
      reorderLevel: String(product.reorder_level),
      variants: product.variants.length
        ? product.variants.map((variant) => ({
            id: variant.id,
            sku: variant.sku,
            size: variant.size ?? '',
            color: variant.color ?? '',
            purchasePrice: String(variant.purchase_price),
            sellingPrice: String(variant.selling_price),
            stock: String(variant.stock),
          }))
        : [
            {
              sku: `${product.sku}-DEFAULT`,
              size: '',
              color: '',
              purchasePrice: String(product.purchase_price),
              sellingPrice: String(product.selling_price),
              stock: String(product.stock),
            },
          ],
    })
    setImageFiles([])
    setErrors({})
    setVariantErrors([])
    setIsFormOpen(true)
  }

  const updateVariant = (index: number, patch: Partial<VariantForm>) => {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...patch } : variant,
      ),
    }))
  }

  const validate = (): ProductInput | null => {
    const nextErrors: FormErrors = {}
    const nextVariantErrors: string[] = []
    const reorderLevel = Number(form.reorderLevel)

    if (!form.sku.trim()) nextErrors.sku = 'Base SKU is required.'
    if (!form.name.trim()) nextErrors.name = 'Product name is required.'
    if (!form.description.trim()) nextErrors.description = 'Add a short product description.'
    if (!Number.isInteger(reorderLevel) || reorderLevel < 1)
      nextErrors.reorderLevel = 'Reorder level must be a positive whole number.'
    if (imageFiles.length + (editing?.images.length ?? 0) > 5)
      nextErrors.images = 'A product can have up to 5 images.'

    const variants: ProductVariantInput[] = form.variants.map((variant, index) => {
      const purchasePrice = Number(variant.purchasePrice)
      const sellingPrice = Number(variant.sellingPrice)
      const stock = Number(variant.stock)
      const issues: string[] = []
      if (!variant.sku.trim()) issues.push('SKU is required')
      if (!Number.isFinite(purchasePrice) || purchasePrice < 0) issues.push('invalid purchase price')
      if (!Number.isFinite(sellingPrice) || sellingPrice < 0) issues.push('invalid selling price')
      if (!Number.isInteger(stock) || stock < 0) issues.push('invalid stock')
      nextVariantErrors[index] = issues.join(', ')
      return {
        id: variant.id,
        sku: variant.sku,
        size: variant.size || null,
        color: variant.color || null,
        purchase_price: purchasePrice,
        selling_price: sellingPrice,
        stock,
        is_default: index === 0,
      }
    })

    setErrors(nextErrors)
    setVariantErrors(nextVariantErrors)
    if (Object.keys(nextErrors).length > 0 || nextVariantErrors.some(Boolean)) return null
    return {
      sku: form.sku,
      name: form.name,
      description: form.description,
      category: form.category || null,
      brand: form.brand || null,
      barcode: form.barcode || null,
      reorder_level: reorderLevel,
      variants,
    }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = validate()
    if (!input) return
    const saved = await onSave(input, editing?.id, imageFiles)
    if (saved) setIsFormOpen(false)
  }

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Stock control"
        title="Inventory"
        description="Manage rich product details, images, and stock separately for every size and color."
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
              placeholder="Search product, brand, category or SKU"
              className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-[15px] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              aria-label="Search products"
            />
          </div>
          <p className="text-sm font-medium text-slate-500">{filteredProducts.length} of {products.length} products</p>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            title={query ? 'No matching products' : 'Your inventory is empty'}
            description={query ? 'Try a different search term.' : 'Add your first product and its variants.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Product</th>
                  <th className="px-5 py-3.5 font-semibold">Variants</th>
                  <th className="px-5 py-3.5 font-semibold">Purchase price</th>
                  <th className="px-5 py-3.5 font-semibold">Selling price</th>
                  <th className="px-5 py-3.5 font-semibold">Stock</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {product.images[0] ? (
                          <img src={product.images[0].public_url} alt="" className="h-12 w-12 rounded-lg border border-slate-200 object-cover" />
                        ) : (
                          <div className="grid h-12 w-12 place-items-center rounded-lg bg-slate-100 text-slate-400"><ImagePlus className="h-5 w-5" /></div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{product.name}</p>
                          <p className="mt-1 font-mono text-xs text-slate-500">{product.sku}</p>
                          <p className="mt-1 max-w-xs truncate text-xs text-slate-500">{[product.brand, product.category].filter(Boolean).join(' · ') || product.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex max-w-xs flex-wrap gap-1.5">
                        {product.variants.slice(0, 3).map((variant) => (
                          <span key={variant.id} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{getVariantLabel(variant)}</span>
                        ))}
                        {product.variants.length > 3 ? <span className="text-xs text-slate-500">+{product.variants.length - 3}</span> : null}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-700">{priceRange(product, 'purchase_price')}</td>
                    <td className="px-5 py-4 font-medium text-slate-700">{priceRange(product, 'selling_price')}</td>
                    <td className="px-5 py-4"><span className="font-bold text-slate-900">{product.stock}</span><span className="ml-1 text-slate-500">units</span></td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles(product.stock, product.reorder_level)}`}>
                        {getProductStatus(product.stock, product.reorder_level)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button type="button" onClick={() => openEdit(product)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
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

      {isFormOpen ? (
        <Modal
          title={editing ? 'Edit product catalog' : 'Add a product'}
          description="Add catalog details, images, and one or more stock-tracked variants."
          onClose={() => setIsFormOpen(false)}
        >
          <form onSubmit={submit} className="space-y-7 p-5 sm:p-6">
            <section>
              <h3 className="font-semibold text-slate-900">Product details</h3>
              <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Base SKU" placeholder="e.g. TSH-100" value={form.sku} error={errors.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
                <Field label="Product name" placeholder="e.g. Classic T-Shirt" value={form.name} error={errors.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                <Field label="Brand" placeholder="e.g. Northstar" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
                <Field label="Category" placeholder="e.g. Apparel" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
                <Field label="Barcode" placeholder="Optional UPC/EAN" value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} />
                <Field label="Reorder level" type="number" min="1" step="1" value={form.reorderLevel} error={errors.reorderLevel} onChange={(event) => setForm({ ...form, reorderLevel: event.target.value })} />
              </div>
              <label className="mt-5 block text-sm font-medium text-slate-700">
                Description
                <textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  rows={3}
                  placeholder="Materials, features, care instructions, or other useful details"
                  className={`mt-2 block w-full rounded-lg border bg-white px-3.5 py-3 text-[15px] text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${errors.description ? 'border-rose-300' : 'border-slate-200'}`}
                />
                {errors.description ? <span className="mt-1.5 block text-sm text-rose-600">{errors.description}</span> : null}
              </label>
            </section>

            <section className="border-t border-slate-100 pt-6">
              <div className="flex items-center justify-between gap-3">
                <div><h3 className="font-semibold text-slate-900">Size and color variants</h3><p className="mt-1 text-sm text-slate-500">The first variant is used as the default.</p></div>
                <Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, variants: [...current.variants, blankVariant(current.sku ? `${current.sku}-${current.variants.length + 1}` : '')] }))}>
                  <Plus className="h-4 w-4" /> Add variant
                </Button>
              </div>
              <div className="mt-4 space-y-4">
                {form.variants.map((variant, index) => (
                  <div key={variant.id ?? `new-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-slate-700">Variant {index + 1}{index === 0 ? ' · Default' : ''}</p>{form.variants.length > 1 ? <button type="button" onClick={() => setForm((current) => ({ ...current, variants: current.variants.filter((_, variantIndex) => variantIndex !== index) }))} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove variant ${index + 1}`}><Trash2 className="h-4 w-4" /></button> : null}</div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Variant SKU" placeholder="TSH-100-BLK-M" value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} />
                      <Field label="Size" placeholder="e.g. M" value={variant.size} onChange={(event) => updateVariant(index, { size: event.target.value })} />
                      <Field label="Color" placeholder="e.g. Black" value={variant.color} onChange={(event) => updateVariant(index, { color: event.target.value })} />
                      <Field label="Purchase price" type="number" min="0" step="0.01" value={variant.purchasePrice} onChange={(event) => updateVariant(index, { purchasePrice: event.target.value })} />
                      <Field label="Selling price" type="number" min="0" step="0.01" value={variant.sellingPrice} onChange={(event) => updateVariant(index, { sellingPrice: event.target.value })} />
                      <Field label="Opening stock" type="number" min="0" step="1" value={variant.stock} onChange={(event) => updateVariant(index, { stock: event.target.value })} />
                    </div>
                    {variantErrors[index] ? <p className="mt-3 text-sm text-rose-600">Variant {index + 1}: {variantErrors[index]}.</p> : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-slate-100 pt-6">
              <h3 className="font-semibold text-slate-900">Product images</h3>
              <p className="mt-1 text-sm text-slate-500">Upload up to 5 JPG, PNG, WebP, or GIF images, maximum 5 MB each.</p>
              <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-600 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700">
                <ImagePlus className="h-5 w-5" /> Choose images
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => setImageFiles(Array.from(event.target.files ?? []).slice(0, 5))} />
              </label>
              {errors.images ? <p className="mt-2 text-sm text-rose-600">{errors.images}</p> : null}
              {(editing?.images.length || imageFiles.length) ? (
                <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {editing?.images.map((image) => <img key={image.id} src={image.public_url} alt={image.alt_text ?? editing.name} className="aspect-square w-full rounded-lg border border-slate-200 object-cover" />)}
                  {imageFiles.map((file) => <LocalImagePreview key={`${file.name}-${file.lastModified}`} file={file} />)}
                </div>
              ) : null}
            </section>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button type="submit" busy={submitting}>{editing ? 'Save changes' : 'Add product'}</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
