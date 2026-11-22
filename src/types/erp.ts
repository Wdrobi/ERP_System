export type TransactionType = 'INCOME' | 'EXPENSE'
export type ReferenceType = 'SALE' | 'PURCHASE'
export type ProductStatus = 'In Stock' | 'Low Stock' | 'Out of Stock'
export type ModuleKey = 'dashboard' | 'inventory' | 'purchases' | 'sales' | 'accounts'

export type Product = {
  id: string
  sku: string
  name: string
  purchase_price: number
  selling_price: number
  stock: number
  created_at: string
  updated_at: string
}

export type ProductInput = {
  sku: string
  name: string
  purchase_price: number
  selling_price: number
  stock: number
}

export type Purchase = {
  id: string
  supplier_name: string
  product_id: string
  quantity: number
  unit_purchase_price: number
  total_amount: number
  purchased_at: string
  created_at: string
  product?: Pick<Product, 'id' | 'sku' | 'name'> | null
}

export type PurchaseInput = {
  supplier_name: string
  product_id: string
  quantity: number
  unit_purchase_price: number
  purchased_at: string
}

export type Sale = {
  id: string
  customer_name: string
  product_id: string
  quantity: number
  unit_selling_price: number
  total_amount: number
  sold_at: string
  created_at: string
  product?: Pick<Product, 'id' | 'sku' | 'name'> | null
}

export type SaleInput = {
  customer_name: string
  product_id: string
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

type ProductInsert = ProductInput & {
  id?: string
  created_at?: string
  updated_at?: string
}

type ProductUpdate = Partial<ProductInput> & { updated_at?: string }

type PurchaseInsert = Omit<Purchase, 'id' | 'total_amount' | 'created_at' | 'product'> & {
  id?: string
  created_at?: string
}

type SaleInsert = Omit<Sale, 'id' | 'total_amount' | 'created_at' | 'product'> & {
  id?: string
  created_at?: string
}

type TransactionInsert = Omit<LedgerTransaction, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}

export type Database = {
  public: {
    Tables: {
      products: {
        Row: Product
        Insert: ProductInsert
        Update: ProductUpdate
        Relationships: []
      }
      purchases: {
        Row: Omit<Purchase, 'product'>
        Insert: PurchaseInsert
        Update: Partial<PurchaseInsert>
        Relationships: [
          {
            foreignKeyName: 'purchases_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      sales: {
        Row: Omit<Sale, 'product'>
        Insert: SaleInsert
        Update: Partial<SaleInsert>
        Relationships: [
          {
            foreignKeyName: 'sales_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      transactions: {
        Row: LedgerTransaction
        Insert: TransactionInsert
        Update: Partial<TransactionInsert>
        Relationships: [
          {
            foreignKeyName: 'transactions_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<never, never>
    Functions: {
      create_purchase_transaction: {
        Args: {
          p_supplier_name: string
          p_product_id: string
          p_quantity: number
          p_unit_purchase_price: number
          p_purchased_at: string
        }
        Returns: Omit<Purchase, 'product'>
      }
      create_sale_transaction: {
        Args: {
          p_customer_name: string
          p_product_id: string
          p_quantity: number
          p_unit_selling_price: number
          p_sold_at: string
        }
        Returns: Omit<Sale, 'product'>
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

export function getProductStatus(stock: number): ProductStatus {
  if (stock === 0) return 'Out of Stock'
  if (stock < 5) return 'Low Stock'
  return 'In Stock'
}
