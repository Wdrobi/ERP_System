export type TransactionType = 'INCOME' | 'EXPENSE'
export type ReferenceType = 'SALE' | 'PURCHASE'
export type ProductStatus = 'In Stock' | 'Low Stock' | 'Out of Stock'
export type ModuleKey = 'dashboard' | 'inventory' | 'purchases' | 'sales' | 'accounts'

export type ProductVariant = {
  id: string
  product_id: string
  sku: string
  size: string | null
  color: string | null
  purchase_price: number
  selling_price: number
  stock: number
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ProductImage = {
  id: string
  product_id: string
  storage_path: string
  public_url: string
  alt_text: string | null
  sort_order: number
  created_at: string
}

export type Product = {
  id: string
  sku: string
  name: string
  description: string
  category: string | null
  brand: string | null
  barcode: string | null
  reorder_level: number
  purchase_price: number
  selling_price: number
  stock: number
  created_at: string
  updated_at: string
  variants: ProductVariant[]
  images: ProductImage[]
}

export type ProductVariantInput = {
  id?: string
  sku: string
  size: string | null
  color: string | null
  purchase_price: number
  selling_price: number
  stock: number
  is_default: boolean
}

export type ProductInput = {
  sku: string
  name: string
  description: string
  category: string | null
  brand: string | null
  barcode: string | null
  reorder_level: number
  variants: ProductVariantInput[]
}

export type Purchase = {
  id: string
  supplier_name: string
  product_id: string
  variant_id: string | null
  quantity: number
  unit_purchase_price: number
  total_amount: number
  purchased_at: string
  created_at: string
  product?: Pick<Product, 'id' | 'sku' | 'name'> | null
  variant?: Pick<ProductVariant, 'id' | 'sku' | 'size' | 'color'> | null
}

export type PurchaseInput = {
  supplier_name: string
  product_id: string
  variant_id: string
  quantity: number
  unit_purchase_price: number
  purchased_at: string
}

export type Sale = {
  id: string
  customer_name: string
  product_id: string
  variant_id: string | null
  quantity: number
  unit_selling_price: number
  total_amount: number
  sold_at: string
  created_at: string
  product?: Pick<Product, 'id' | 'sku' | 'name'> | null
  variant?: Pick<ProductVariant, 'id' | 'sku' | 'size' | 'color'> | null
}

export type SaleInput = {
  customer_name: string
  product_id: string
  variant_id: string
  quantity: number
  unit_selling_price: number
  sold_at: string
}

export type LedgerTransaction = {
  id: string
  type: TransactionType
  reference_type: ReferenceType
  reference_id: string
  product_id: string | null
  variant_id: string | null
  party_name: string
  description: string
  amount: number
  occurred_at: string
  created_at: string
}

export type DashboardMetrics = {
  totalRevenue: number
  totalExpenses: number
  netBalance: number
  inventoryValuation: number
}

export type LedgerFilter = {
  type?: TransactionType | 'ALL'
  from?: string
  to?: string
}

type ProductRow = Omit<Product, 'variants' | 'images'>
type ProductInsert = Omit<ProductRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}
type ProductVariantInsert = Omit<ProductVariant, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}
type ProductImageInsert = Omit<ProductImage, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}
type PurchaseRow = Omit<Purchase, 'product' | 'variant'>
type SaleRow = Omit<Sale, 'product' | 'variant'>
type TransactionInsert = Omit<LedgerTransaction, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}

export type Database = {
  public: {
    Tables: {
      products: {
        Row: ProductRow
        Insert: ProductInsert
        Update: Partial<ProductInsert>
        Relationships: []
      }
      product_variants: {
        Row: ProductVariant
        Insert: ProductVariantInsert
        Update: Partial<ProductVariantInsert>
        Relationships: []
      }
      product_images: {
        Row: ProductImage
        Insert: ProductImageInsert
        Update: Partial<ProductImageInsert>
        Relationships: []
      }
      purchases: {
        Row: PurchaseRow
        Insert: Omit<PurchaseRow, 'id' | 'total_amount' | 'created_at'>
        Update: Partial<Omit<PurchaseRow, 'id' | 'total_amount' | 'created_at'>>
        Relationships: []
      }
      sales: {
        Row: SaleRow
        Insert: Omit<SaleRow, 'id' | 'total_amount' | 'created_at'>
        Update: Partial<Omit<SaleRow, 'id' | 'total_amount' | 'created_at'>>
        Relationships: []
      }
      transactions: {
        Row: LedgerTransaction
        Insert: TransactionInsert
        Update: Partial<TransactionInsert>
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      save_product_catalog: {
        Args: {
          p_product_id: string | null
          p_sku: string
          p_name: string
          p_description: string
          p_category: string | null
          p_brand: string | null
          p_barcode: string | null
          p_reorder_level: number
          p_variants: ProductVariantInput[]
        }
        Returns: string
      }
      create_purchase_transaction_v2: {
        Args: {
          p_supplier_name: string
          p_product_id: string
          p_variant_id: string
          p_quantity: number
          p_unit_purchase_price: number
          p_purchased_at: string
        }
        Returns: PurchaseRow
      }
      create_sale_transaction_v2: {
        Args: {
          p_customer_name: string
          p_product_id: string
          p_variant_id: string
          p_quantity: number
          p_unit_selling_price: number
          p_sold_at: string
        }
        Returns: SaleRow
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

export function getProductStatus(stock: number, reorderLevel = 5): ProductStatus {
  if (stock === 0) return 'Out of Stock'
  if (stock < reorderLevel) return 'Low Stock'
  return 'In Stock'
}

export function getVariantLabel(variant: Pick<ProductVariant, 'size' | 'color'>): string {
  return [variant.color, variant.size].filter(Boolean).join(' / ') || 'Default'
}
