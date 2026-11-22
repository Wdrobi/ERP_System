import { assertSupabaseConfigured, supabase } from '../lib/supabase'
import type {
  DashboardMetrics,
  LedgerFilter,
  LedgerTransaction,
  Product,
  ProductImage,
  ProductInput,
  ProductVariant,
  Purchase,
  PurchaseInput,
  Sale,
  SaleInput,
} from '../types/erp'

const PRODUCT_IMAGE_BUCKET = 'product-images'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export class ErpServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErpServiceError'
  }
}

function fail(message: string): never {
  throw new ErpServiceError(message)
}

function cleanNullable(value: string | null): string | null {
  const cleaned = value?.trim() ?? ''
  return cleaned || null
}

function groupByProduct<T extends { product_id: string }>(items: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>()
  for (const item of items) {
    const current = grouped.get(item.product_id) ?? []
    current.push(item)
    grouped.set(item.product_id, current)
  }
  return grouped
}

function imageExtension(file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
  return extension || 'jpg'
}

async function uploadProductImages(productId: string, files: File[], productName: string): Promise<void> {
  for (const file of files) {
    if (!file.type.startsWith('image/')) fail(`${file.name} is not a supported image.`)
    if (file.size > MAX_IMAGE_BYTES) fail(`${file.name} is larger than 5 MB.`)

    const storagePath = `${productId}/${crypto.randomUUID()}.${imageExtension(file)}`
    const { error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(storagePath, file, { cacheControl: '3600', upsert: false })
    if (uploadError) fail(uploadError.message)

    const { data: publicUrlData } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(storagePath)
    const { error: recordError } = await supabase.from('product_images').insert({
      product_id: productId,
      storage_path: storagePath,
      public_url: publicUrlData.publicUrl,
      alt_text: productName,
      sort_order: 0,
    })

    if (recordError) {
      await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([storagePath])
      fail(recordError.message)
    }
  }
}

export const erpService = {
  async getProducts(): Promise<Product[]> {
    assertSupabaseConfigured()
    const [productsResult, variantsResult, imagesResult] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('product_variants').select('*').eq('is_active', true).order('created_at'),
      supabase.from('product_images').select('*').order('sort_order'),
    ])

    if (productsResult.error) fail(productsResult.error.message)
    if (variantsResult.error) fail(variantsResult.error.message)
    if (imagesResult.error) fail(imagesResult.error.message)

    const variantsByProduct = groupByProduct((variantsResult.data ?? []) as ProductVariant[])
    const imagesByProduct = groupByProduct((imagesResult.data ?? []) as ProductImage[])

    return (productsResult.data ?? []).map((product) => ({
      ...product,
      variants: variantsByProduct.get(product.id) ?? [],
      images: imagesByProduct.get(product.id) ?? [],
    }))
  },

  async saveProduct(input: ProductInput, id?: string, imageFiles: File[] = []): Promise<string> {
    assertSupabaseConfigured()
    const variants = input.variants.map((variant, index) => ({
      ...variant,
      sku: variant.sku.trim().toUpperCase(),
      size: cleanNullable(variant.size),
      color: cleanNullable(variant.color),
      is_default: index === 0,
    }))

    const { data, error } = await supabase.rpc('save_product_catalog', {
      p_product_id: id ?? null,
      p_sku: input.sku.trim().toUpperCase(),
      p_name: input.name.trim(),
      p_description: input.description.trim(),
      p_category: cleanNullable(input.category),
      p_brand: cleanNullable(input.brand),
      p_barcode: cleanNullable(input.barcode),
      p_reorder_level: input.reorder_level,
      p_variants: variants,
    })
    if (error) fail(error.message)
    if (!data) return fail('Product save returned no identifier.')

    if (imageFiles.length > 0) await uploadProductImages(data, imageFiles, input.name.trim())
    return data
  },

  async getPurchases(): Promise<Purchase[]> {
    assertSupabaseConfigured()
    const { data, error } = await supabase
      .from('purchases')
      .select('*, product:products(id, sku, name), variant:product_variants(id, sku, size, color)')
      .order('purchased_at', { ascending: false })
    if (error) fail(error.message)
    return (data ?? []) as unknown as Purchase[]
  },

  async createPurchase(input: PurchaseInput): Promise<Purchase> {
    assertSupabaseConfigured()
    const { data, error } = await supabase.rpc('create_purchase_transaction_v2', {
      p_supplier_name: input.supplier_name.trim(),
      p_product_id: input.product_id,
      p_variant_id: input.variant_id,
      p_quantity: input.quantity,
      p_unit_purchase_price: input.unit_purchase_price,
      p_purchased_at: input.purchased_at,
    })
    if (error) fail(error.message)
    if (!data) return fail('Purchase creation returned no data.')
    return data
  },

  async getSales(): Promise<Sale[]> {
    assertSupabaseConfigured()
    const { data, error } = await supabase
      .from('sales')
      .select('*, product:products(id, sku, name), variant:product_variants(id, sku, size, color)')
      .order('sold_at', { ascending: false })
    if (error) fail(error.message)
    return (data ?? []) as unknown as Sale[]
  },

  async createSale(input: SaleInput): Promise<Sale> {
    assertSupabaseConfigured()
    const { data, error } = await supabase.rpc('create_sale_transaction_v2', {
      p_customer_name: input.customer_name.trim(),
      p_product_id: input.product_id,
      p_variant_id: input.variant_id,
      p_quantity: input.quantity,
      p_unit_selling_price: input.unit_selling_price,
      p_sold_at: input.sold_at,
    })
    if (error) fail(error.message)
    if (!data) return fail('Sale creation returned no data.')
    return data
  },

  async getTransactions(filter: LedgerFilter = {}): Promise<LedgerTransaction[]> {
    assertSupabaseConfigured()
    let query = supabase.from('transactions').select('*')
    if (filter.type && filter.type !== 'ALL') query = query.eq('type', filter.type)
    if (filter.from) query = query.gte('occurred_at', filter.from)
    if (filter.to) query = query.lte('occurred_at', filter.to)
    const { data, error } = await query.order('occurred_at', { ascending: false })
    if (error) fail(error.message)
    return data ?? []
  },

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const [products, transactions] = await Promise.all([this.getProducts(), this.getTransactions()])
    return this.calculateMetrics(products, transactions)
  },

  calculateMetrics(products: Product[], transactions: LedgerTransaction[]): DashboardMetrics {
    let totalRevenue = 0
    let totalExpenses = 0
    for (const transaction of transactions) {
      if (transaction.type === 'INCOME') totalRevenue += Number(transaction.amount)
      else totalExpenses += Number(transaction.amount)
    }

    let inventoryValuation = 0
    for (const product of products) {
      for (const variant of product.variants) {
        inventoryValuation += Number(variant.purchase_price) * variant.stock
      }
    }

    return {
      totalRevenue,
      totalExpenses,
      netBalance: totalRevenue - totalExpenses,
      inventoryValuation,
    }
  },
}
