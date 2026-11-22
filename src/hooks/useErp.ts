import { useCallback, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import { erpService } from '../services/erpService'
import type {
  DashboardMetrics,
  Product,
  ProductInput,
  Purchase,
  PurchaseInput,
  Sale,
  SaleInput,
  LedgerTransaction,
} from '../types/erp'

export type Notice = {
  id: number
  tone: 'success' | 'error'
  message: string
}

const emptyMetrics: DashboardMetrics = {
  totalRevenue: 0,
  totalExpenses: 0,
  netBalance: 0,
  inventoryValuation: 0,
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export function useErp() {
  const [products, setProducts] = useState<Product[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const notify = useCallback((tone: Notice['tone'], message: string) => {
    setNotice({ id: Date.now(), tone, message })
  }, [])

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const [nextProducts, nextPurchases, nextSales, nextTransactions] = await Promise.all([
        erpService.getProducts(),
        erpService.getPurchases(),
        erpService.getSales(),
        erpService.getTransactions(),
      ])
      setProducts(nextProducts)
      setPurchases(nextPurchases)
      setSales(nextSales)
      setTransactions(nextTransactions)
    } catch (error) {
      setLoadError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const metrics = useMemo<DashboardMetrics>(() => {
    if (!products.length && !transactions.length) return emptyMetrics
    return erpService.calculateMetrics(products, transactions)
  }, [products, transactions])

  const runAction = useCallback(
    async (action: () => Promise<unknown>, successMessage: string): Promise<boolean> => {
      setSubmitting(true)
      try {
        await action()
        await refresh()
        notify('success', successMessage)
        return true
      } catch (error) {
        notify('error', errorMessage(error))
        return false
      } finally {
        setSubmitting(false)
      }
    },
    [notify, refresh],
  )

  const saveProduct = useCallback(
    (input: ProductInput, id?: string, imageFiles: File[] = []) =>
      runAction(
        () => erpService.saveProduct(input, id, imageFiles),
        id ? 'Product updated successfully.' : 'Product added successfully.',
      ),
    [runAction],
  )

  const createPurchase = useCallback(
    (input: PurchaseInput) =>
      runAction(
        () => erpService.createPurchase(input),
        'Purchase recorded. Stock and expenses are synchronized.',
      ),
    [runAction],
  )

  const createSale = useCallback(
    (input: SaleInput) =>
      runAction(
        () => erpService.createSale(input),
        'Sale recorded. Stock and revenue are synchronized.',
      ),
    [runAction],
  )

  return {
    products,
    purchases,
    sales,
    transactions,
    metrics,
    loading,
    submitting,
    loadError,
    notice,
    dismissNotice: () => setNotice(null),
    refresh,
    saveProduct,
    createPurchase,
    createSale,
  }
}
