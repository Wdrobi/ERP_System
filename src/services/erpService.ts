import { assertSupabaseConfigured, supabase } from '../lib/supabase'
import type {
  DashboardMetrics,
  LedgerFilter,
  LedgerTransaction,
  Product,
  ProductInput,
  Purchase,
  PurchaseInput,
  Sale,
  SaleInput,
} from '../types/erp'

export class ErpServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErpServiceError'
  }
}

function fail(message: string): never {
  throw new ErpServiceError(message)
}

export const erpService = {
  async getProducts(): Promise<Product[]> {
    assertSupabaseConfigured()
    const { data, error } = await supabase.from('products').select('*').order('name')
    if (error) fail(error.message)
    return data ?? []
  },

  async createProduct(input: ProductInput): Promise<Product> {
    assertSupabaseConfigured()
    const payload: ProductInput = {
      ...input,
      sku: input.sku.trim().toUpperCase(),
      name: input.name.trim(),
    }
    const { data, error } = await supabase.from('products').insert(payload).select().single()
    if (error) fail(error.message)
    if (!data) return fail('Product creation returned no data.')
    return data
  },

  async updateProduct(id: string, input: ProductInput): Promise<Product> {
    assertSupabaseConfigured()
    const payload: ProductInput = {
      ...input,
      sku: input.sku.trim().toUpperCase(),
      name: input.name.trim(),
    }
    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) fail(error.message)
    if (!data) return fail('Product update returned no data.')
    return data
  },

  async getPurchases(): Promise<Purchase[]> {
    assertSupabaseConfigured()
    const { data, error } = await supabase
      .from('purchases')
      .select('*, product:products(id, sku, name)')
      .order('purchased_at', { ascending: false })
    if (error) fail(error.message)
    return (data ?? []) as Purchase[]
  },

  async createPurchase(input: PurchaseInput): Promise<Purchase> {
    assertSupabaseConfigured()
    const { data, error } = await supabase.rpc('create_purchase_transaction', {
      p_supplier_name: input.supplier_name.trim(),
      p_product_id: input.product_id,
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
      .select('*, product:products(id, sku, name)')
      .order('sold_at', { ascending: false })
    if (error) fail(error.message)
    return (data ?? []) as Sale[]
  },

  async createSale(input: SaleInput): Promise<Sale> {
    assertSupabaseConfigured()
    const { data, error } = await supabase.rpc('create_sale_transaction', {
      p_customer_name: input.customer_name.trim(),
      p_product_id: input.product_id,
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
    const [products, transactions] = await Promise.all([
      this.getProducts(),
      this.getTransactions(),
    ])

    const totalRevenue = transactions
      .filter((transaction) => transaction.type === 'INCOME')
      .reduce((total, transaction) => total + Number(transaction.amount), 0)
    const totalExpenses = transactions
      .filter((transaction) => transaction.type === 'EXPENSE')
      .reduce((total, transaction) => total + Number(transaction.amount), 0)
    const inventoryValuation = products.reduce(
      (total, product) => total + Number(product.purchase_price) * product.stock,
      0,
    )

    return {
      totalRevenue,
      totalExpenses,
      netBalance: totalRevenue - totalExpenses,
      inventoryValuation,
    }
  },

  calculateMetrics(
    products: Product[],
    transactions: LedgerTransaction[],
  ): DashboardMetrics {
    const totalRevenue = transactions
      .filter((transaction) => transaction.type === 'INCOME')
      .reduce((total, transaction) => total + Number(transaction.amount), 0)
    const totalExpenses = transactions
      .filter((transaction) => transaction.type === 'EXPENSE')
      .reduce((total, transaction) => total + Number(transaction.amount), 0)
    const inventoryValuation = products.reduce(
      (total, product) => total + Number(product.purchase_price) * product.stock,
      0,
    )

    return {
      totalRevenue,
      totalExpenses,
      netBalance: totalRevenue - totalExpenses,
      inventoryValuation,
    }
  },
}
