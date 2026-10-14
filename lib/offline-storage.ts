/**
 * Comprehensive Offline Storage System using IndexedDB
 * Provides complete offline functionality for invoices, customers, and app data
 */

export interface OfflineInvoice {
  id: string
  invoiceNumber: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  customerAddress?: string
  items: Array<{
    description: string
    quantity: number
    rate: number
    amount: number
  }>
  subtotal: number
  discount: number
  total: number
  tax: number
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  createdAt: Date
  updatedAt: Date
  dueDate?: Date
  notes?: string
  syncStatus: 'synced' | 'pending' | 'offline_only'
  lastModified: Date
}

export interface OfflineCustomer {
  id: string
  name: string
  email?: string
  phone?: string
  address?: string
  createdAt: Date
  updatedAt: Date
  invoiceCount: number
  totalAmount: number
  syncStatus: 'synced' | 'pending' | 'offline_only'
}

export interface OfflineAppSettings {
  id: string
  key: string
  value: any
  updatedAt: Date
  syncStatus: 'synced' | 'pending' | 'offline_only'
}

export interface OfflineSyncQueue {
  id: string
  action: 'create' | 'update' | 'delete'
  entityType: 'invoice' | 'customer' | 'settings'
  entityId: string
  data: any
  createdAt: Date
  retryCount: number
  lastRetry?: Date
  error?: string
}

class OfflineStorageManager {
  private db: IDBDatabase | null = null
  private readonly DB_NAME = 'BiocureHealthcareDB'
  private readonly DB_VERSION = 2

  constructor() {
    // Don't initialize DB in constructor to avoid SSR issues
    // DB will be initialized lazily when first accessed
  }

  private async initDB(): Promise<void> {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB not available (SSR environment)')
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION)

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('IndexedDB opened successfully')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create invoices store
        if (!db.objectStoreNames.contains('invoices')) {
          const invoiceStore = db.createObjectStore('invoices', { keyPath: 'id' })
          invoiceStore.createIndex('invoiceNumber', 'invoiceNumber', { unique: true })
          invoiceStore.createIndex('customerName', 'customerName', { unique: false })
          invoiceStore.createIndex('status', 'status', { unique: false })
          invoiceStore.createIndex('syncStatus', 'syncStatus', { unique: false })
          invoiceStore.createIndex('createdAt', 'createdAt', { unique: false })
        }

        // Create customers store
        if (!db.objectStoreNames.contains('customers')) {
          const customerStore = db.createObjectStore('customers', { keyPath: 'id' })
          customerStore.createIndex('name', 'name', { unique: false })
          customerStore.createIndex('email', 'email', { unique: false })
          customerStore.createIndex('syncStatus', 'syncStatus', { unique: false })
        }

        // Create products store
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id' })
          productStore.createIndex('name', 'name', { unique: false })
          productStore.createIndex('sku', 'sku', { unique: false })
          productStore.createIndex('category', 'category', { unique: false })
        }

        // Create app settings store
        if (!db.objectStoreNames.contains('settings')) {
          const settingsStore = db.createObjectStore('settings', { keyPath: 'id' })
          settingsStore.createIndex('key', 'key', { unique: true })
          settingsStore.createIndex('syncStatus', 'syncStatus', { unique: false })
        }

        // Create sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' })
          syncStore.createIndex('entityType', 'entityType', { unique: false })
          syncStore.createIndex('action', 'action', { unique: false })
          syncStore.createIndex('createdAt', 'createdAt', { unique: false })
        }

        console.log('IndexedDB schema created/updated')
      }
    })
  }

  private async ensureDB(): Promise<IDBDatabase> {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || !window.indexedDB) {
      throw new Error('IndexedDB not available (not in browser environment)')
    }

    if (!this.db) {
      await this.initDB()
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB')
    }
    return this.db
  }

  // ===== INVOICE OPERATIONS =====

  async saveInvoice(invoice: OfflineInvoice): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction(['invoices'], 'readwrite')
    const store = transaction.objectStore('invoices')

    invoice.lastModified = new Date()
    invoice.syncStatus = (typeof window !== 'undefined' && navigator.onLine) ? 'pending' : 'offline_only'

    return new Promise((resolve, reject) => {
      const request = store.put(invoice)
      request.onsuccess = () => {
        console.log('Invoice saved offline:', invoice.id)
        
        // Add to sync queue if online
        if (typeof window !== 'undefined' && navigator.onLine) {
          this.addToSyncQueue('invoice', 'update', invoice.id, invoice)
        }
        
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getInvoice(id: string): Promise<OfflineInvoice | null> {
    const db = await this.ensureDB()
    const transaction = db.transaction(['invoices'], 'readonly')
    const store = transaction.objectStore('invoices')

    return new Promise((resolve, reject) => {
      const request = store.get(id)
      request.onsuccess = () => {
        resolve(request.result || null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getAllInvoices(): Promise<OfflineInvoice[]> {
    const db = await this.ensureDB()
    const transaction = db.transaction(['invoices'], 'readonly')
    const store = transaction.objectStore('invoices')

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        const invoices = request.result || []
        console.log(`Retrieved ${invoices.length} invoices from offline storage`)
        resolve(invoices)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async deleteInvoice(id: string): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction(['invoices'], 'readwrite')
    const store = transaction.objectStore('invoices')

    return new Promise((resolve, reject) => {
      const request = store.delete(id)
      request.onsuccess = () => {
        console.log('Invoice deleted offline:', id)
        
        // Add to sync queue if online
        if (typeof window !== 'undefined' && navigator.onLine) {
          this.addToSyncQueue('invoice', 'delete', id, null)
        }
        
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  // ===== CUSTOMER OPERATIONS =====

  async saveCustomer(customer: OfflineCustomer): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction(['customers'], 'readwrite')
    const store = transaction.objectStore('customers')

    customer.updatedAt = new Date()
    customer.syncStatus = (typeof window !== 'undefined' && navigator.onLine) ? 'pending' : 'offline_only'

    return new Promise((resolve, reject) => {
      const request = store.put(customer)
      request.onsuccess = () => {
        console.log('Customer saved offline:', customer.id)
        
        if (typeof window !== 'undefined' && navigator.onLine) {
          this.addToSyncQueue('customer', 'update', customer.id, customer)
        }
        
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getAllCustomers(): Promise<OfflineCustomer[]> {
    const db = await this.ensureDB()
    const transaction = db.transaction(['customers'], 'readonly')
    const store = transaction.objectStore('customers')

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        const customers = request.result || []
        console.log(`Retrieved ${customers.length} customers from offline storage`)
        resolve(customers)
      }
      request.onerror = () => reject(request.error)
    })
  }

  // ===== SYNC QUEUE OPERATIONS =====

  private async addToSyncQueue(entityType: 'invoice' | 'customer' | 'settings', action: 'create' | 'update' | 'delete', entityId: string, data: any): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction(['syncQueue'], 'readwrite')
    const store = transaction.objectStore('syncQueue')

    const syncItem: OfflineSyncQueue = {
      id: `${entityType}-${action}-${entityId}-${Date.now()}`,
      action,
      entityType,
      entityId,
      data,
      createdAt: new Date(),
      retryCount: 0
    }

    return new Promise((resolve, reject) => {
      const request = store.put(syncItem)
      request.onsuccess = () => {
        console.log('Added to sync queue:', syncItem.id)
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getSyncQueue(): Promise<OfflineSyncQueue[]> {
    const db = await this.ensureDB()
    const transaction = db.transaction(['syncQueue'], 'readonly')
    const store = transaction.objectStore('syncQueue')

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        resolve(request.result || [])
      }
      request.onerror = () => reject(request.error)
    })
  }

  async clearSyncQueue(): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction(['syncQueue'], 'readwrite')
    const store = transaction.objectStore('syncQueue')

    return new Promise((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => {
        console.log('Sync queue cleared')
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  // ===== UTILITY METHODS =====

  async getOfflineStats(): Promise<{
    invoiceCount: number
    customerCount: number
    pendingSyncItems: number
    lastSyncDate?: Date
    storageSize: number
  }> {
    const invoices = await this.getAllInvoices()
    const customers = await this.getAllCustomers()
    const syncQueue = await this.getSyncQueue()

    // Estimate storage size (rough calculation)
    const dataSize = JSON.stringify({ invoices, customers }).length
    const storageSize = Math.round(dataSize / 1024) // KB

    return {
      invoiceCount: invoices.length,
      customerCount: customers.length,
      pendingSyncItems: syncQueue.length,
      storageSize
    }
  }

  async clearAllData(): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction(['invoices', 'customers', 'settings', 'syncQueue'], 'readwrite')

    const promises = [
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('invoices').clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('customers').clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('settings').clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('syncQueue').clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    ]

    await Promise.all(promises)
    console.log('All offline data cleared')
  }

  async clearStore(storeName: string): Promise<void> {
    const db = await this.ensureDB()
    if (!db.objectStoreNames.contains(storeName)) return
    const transaction = db.transaction([storeName], 'readwrite')
    return new Promise((resolve, reject) => {
      const request = transaction.objectStore(storeName).clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async bulkAdd(storeName: string, items: any[]): Promise<number> {
    if (!items || !Array.isArray(items) || items.length === 0) return 0
    const db = await this.ensureDB()
    if (!db.objectStoreNames.contains(storeName)) {
      console.warn(`Store "${storeName}" does not exist in IndexedDB`)
      return 0
    }

    const transaction = db.transaction([storeName], 'readwrite')
    const store = transaction.objectStore(storeName)

    return new Promise((resolve, reject) => {
      let count = 0
      transaction.oncomplete = () => resolve(count)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error || new Error(`Transaction aborted for ${storeName}`))

      for (const item of items) {
        if (item && typeof item === 'object') {
          const record = { ...item }
          if (record.createdAt && typeof record.createdAt === 'string') {
            record.createdAt = new Date(record.createdAt)
          }
          if (record.updatedAt && typeof record.updatedAt === 'string') {
            record.updatedAt = new Date(record.updatedAt)
          }
          if (record.lastModified && typeof record.lastModified === 'string') {
            record.lastModified = new Date(record.lastModified)
          }
          store.put(record)
          count++
        }
      }
    })
  }

  getTable(tableName: string) {
    return {
      clear: () => this.clearStore(tableName),
      bulkAdd: (items: any[]) => this.bulkAdd(tableName, items),
    }
  }

  // ===== SYNC OPERATIONS =====

  async syncWithCloud(): Promise<{ success: boolean; message: string; syncedItems: number }> {
    if (typeof window === 'undefined' || !navigator.onLine) {
      return {
        success: false,
        message: 'Cannot sync while offline',
        syncedItems: 0
      }
    }

    try {
      const syncQueue = await this.getSyncQueue()
      let syncedItems = 0

      for (const item of syncQueue) {
        try {
          // Here you would implement actual cloud sync logic
          // For now, we'll just mark items as synced
          console.log('Syncing item:', item)
          
          // Update the original entity's sync status
          if (item.entityType === 'invoice' && item.data) {
            const invoice = await this.getInvoice(item.entityId)
            if (invoice) {
              invoice.syncStatus = 'synced'
              await this.saveInvoice(invoice)
            }
          }

          syncedItems++
        } catch (error) {
          console.error('Failed to sync item:', item.id, error)
        }
      }

      // Clear the sync queue after successful sync
      await this.clearSyncQueue()

      return {
        success: true,
        message: `Successfully synced ${syncedItems} items`,
        syncedItems
      }
    } catch (error) {
      console.error('Sync failed:', error)
      return {
        success: false,
        message: 'Sync failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        syncedItems: 0
      }
    }
  }

  async getAllStoresData(): Promise<Record<string, any[]>> {
    const db = await this.ensureDB()
    const storeNames = Array.from(db.objectStoreNames)
    const results: Record<string, any[]> = {}

    if (storeNames.length === 0) {
      return results
    }

    const transaction = db.transaction(storeNames, 'readonly')

    await Promise.all(
      storeNames.map((storeName) => {
        return new Promise<void>((resolve, reject) => {
          const store = transaction.objectStore(storeName)
          const request = store.getAll()
          request.onsuccess = () => {
            results[storeName] = request.result || []
            resolve()
          }
          request.onerror = () => reject(request.error)
        })
      })
    )

    return results
  }
}

// Export singleton instance
export const offlineStorage = new OfflineStorageManager()

// Utility function to check if app is running offline
export const isOfflineMode = (): boolean => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || !window.navigator) {
    return true // Assume offline during SSR
  }
  return !navigator.onLine
}

// Utility function to generate offline invoice
export const createOfflineInvoice = (data: Partial<OfflineInvoice>): OfflineInvoice => {
  const now = new Date()
  const invoiceNumber = data.invoiceNumber || `INV-${Date.now()}`
  
  return {
    id: data.id || `offline-${Date.now()}`,
    invoiceNumber,
    customerName: data.customerName || '',
    customerEmail: data.customerEmail,
    customerPhone: data.customerPhone,
    customerAddress: data.customerAddress,
    items: data.items || [],
    subtotal: data.subtotal || 0,
    discount: data.discount || 0,
    total: data.total || 0,
    tax: data.tax || 0,
    status: data.status || 'draft',
    createdAt: data.createdAt || now,
    updatedAt: now,
    dueDate: data.dueDate,
    notes: data.notes,
    syncStatus: 'offline_only',
    lastModified: now
  }
}

/**
 * Asynchronously query and retrieve all records from every store in local IndexedDB
 * and bundle them into a comprehensive master JSON object for backup/export.
 */
export async function exportFullDatabaseState(): Promise<{
  invoices: any[]
  customers: any[]
  clients: any[]
  products: any[]
  settings: any
  syncQueue: any[]
  metadata: {
    appName: string
    exportedAt: string
    dbName: string
    dbVersion: number
    stores: string[]
    counts: {
      invoices: number
      customers: number
      products: number
      settings: number
    }
  }
  [key: string]: any
}> {
  if (typeof window === 'undefined') {
    return {
      invoices: [],
      customers: [],
      clients: [],
      products: [],
      settings: {},
      syncQueue: [],
      metadata: {
        appName: 'Biocure Health Care',
        exportedAt: new Date().toISOString(),
        dbName: 'BiocureHealthcareDB',
        dbVersion: 1,
        stores: [],
        counts: { invoices: 0, customers: 0, products: 0, settings: 0 },
      },
    }
  }

  // 1. Fetch all records from every IndexedDB store
  let idbData: Record<string, any[]> = {}
  try {
    idbData = await offlineStorage.getAllStoresData()
  } catch (err) {
    console.warn('Could not read IndexedDB stores, falling back to local stores:', err)
  }

  // 2. Fetch persistent storage data (saved invoices, products, settings)
  let localInvoices: any[] = []
  let localProducts: any[] = []
  let localSettings: Record<string, any> = {}

  try {
    const rawInvoices = localStorage.getItem('saved-invoices')
    if (rawInvoices) {
      localInvoices = JSON.parse(rawInvoices)
    }
  } catch (e) {
    console.warn('Could not parse localStorage saved-invoices', e)
  }

  try {
    const rawProducts = localStorage.getItem('wholesale_products_v1')
    if (rawProducts) {
      localProducts = JSON.parse(rawProducts)
    }
  } catch (e) {
    console.warn('Could not parse localStorage wholesale_products_v1', e)
  }

  try {
    localSettings = {
      companyInfo: localStorage.getItem('company-info') ? JSON.parse(localStorage.getItem('company-info')!) : null,
      tableColumns: localStorage.getItem('table-columns') ? JSON.parse(localStorage.getItem('table-columns')!) : null,
      preferences: localStorage.getItem('user-preferences') ? JSON.parse(localStorage.getItem('user-preferences')!) : null,
      appSettings: localStorage.getItem('app-settings') ? JSON.parse(localStorage.getItem('app-settings')!) : null,
      expenses: localStorage.getItem('expenses') ? JSON.parse(localStorage.getItem('expenses')!) : null,
    }
  } catch (e) {
    console.warn('Could not parse localStorage settings', e)
  }

  // 3. Deduplicate and merge invoices from both IndexedDB and localStorage
  const idbInvoices = idbData['invoices'] || []
  const invoiceMap = new Map<string, any>()

  localInvoices.forEach((inv) => {
    const key = inv.id || inv.invoiceNumber
    if (key) invoiceMap.set(key, inv)
  })
  idbInvoices.forEach((inv) => {
    const key = inv.id || inv.invoiceNumber
    if (key) invoiceMap.set(key, inv)
  })

  const mergedInvoices = invoiceMap.size > 0 ? Array.from(invoiceMap.values()) : idbInvoices
  const customers = idbData['customers'] || []
  const syncQueue = idbData['syncQueue'] || []
  const idbSettings = idbData['settings'] || []

  const combinedSettings = {
    ...localSettings,
    indexedDbSettings: idbSettings,
  }

  return {
    invoices: mergedInvoices,
    customers,
    clients: customers, // compatibility alias
    products: localProducts,
    settings: combinedSettings,
    syncQueue,
    ...idbData,
    metadata: {
      appName: 'Biocure Health Care POS & Inventory',
      exportedAt: new Date().toISOString(),
      dbName: 'BiocureHealthcareDB',
      dbVersion: 2,
      stores: Object.keys(idbData),
      counts: {
        invoices: mergedInvoices.length,
        customers: customers.length,
        products: localProducts.length,
        settings: Object.keys(combinedSettings).length,
      },
    },
  }
}

/**
 * Asynchronously restore and import database state from a master backup JSON payload.
 * Securely clears existing stores and batch-inserts the restored records.
 *
 * @param jsonData - Backup JSON string or pre-parsed object
 * @returns Promise<boolean> - Returns true on successful restoration
 * @throws Error - If JSON is malformed or database restoration fails
 */
export async function importFullDatabaseState(jsonData: any): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    // 1. Validate and parse JSON payload
    let payload = jsonData
    if (typeof jsonData === 'string') {
      try {
        payload = JSON.parse(jsonData)
      } catch (parseError: any) {
        throw new Error(`Malformed JSON: Unable to parse backup payload (${parseError?.message || 'SyntaxError'})`)
      }
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error('Malformed JSON: Backup payload must be a valid JSON object.')
    }

    // 2. Extract and validate required data arrays
    const invoices: any[] = Array.isArray(payload.invoices)
      ? payload.invoices
      : Array.isArray(payload.Invoices)
      ? payload.Invoices
      : []

    const customers: any[] = Array.isArray(payload.customers)
      ? payload.customers
      : Array.isArray(payload.clients)
      ? payload.clients
      : Array.isArray(payload.Customers)
      ? payload.Customers
      : Array.isArray(payload.Clients)
      ? payload.Clients
      : []

    const products: any[] = Array.isArray(payload.products)
      ? payload.products
      : Array.isArray(payload.Products)
      ? payload.Products
      : []

    const settings = payload.settings || payload.Settings || null

    // Require at least one valid data section or valid metadata
    const hasValidData =
      invoices.length > 0 ||
      customers.length > 0 ||
      products.length > 0 ||
      Boolean(settings) ||
      Boolean(payload.metadata)

    if (!hasValidData) {
      throw new Error('Malformed JSON: Backup payload does not contain valid database stores (invoices, customers, or products).')
    }

    // 3. Securely clear existing data stores (IndexedDB/Dexie tables) to prevent duplicate primary key crashes
    const invoicesTable = offlineStorage.getTable('invoices')
    const customersTable = offlineStorage.getTable('customers')
    const productsTable = offlineStorage.getTable('products')
    const settingsTable = offlineStorage.getTable('settings')

    await invoicesTable.clear()
    await customersTable.clear()
    await productsTable.clear()
    if (settings) {
      await settingsTable.clear()
    }

    // 4. Batch insert into respective tables using .bulkAdd()
    if (invoices.length > 0) {
      await invoicesTable.bulkAdd(invoices)
    }

    if (customers.length > 0) {
      await customersTable.bulkAdd(customers)
    }

    if (products.length > 0) {
      await productsTable.bulkAdd(products)
    }

    // 5. Sync restored records to persistent browser storage (localStorage)
    try {
      if (invoices.length > 0) {
        localStorage.setItem('saved-invoices', JSON.stringify(invoices))
      }
      if (products.length > 0) {
        localStorage.setItem('biocure_wholesale_products', JSON.stringify(products))
        localStorage.setItem('wholesale_products_v1', JSON.stringify(products))
      }
      if (settings && typeof settings === 'object') {
        if (settings.companyInfo) localStorage.setItem('company-info', JSON.stringify(settings.companyInfo))
        if (settings.tableColumns) localStorage.setItem('table-columns', JSON.stringify(settings.tableColumns))
        if (settings.preferences) localStorage.setItem('user-preferences', JSON.stringify(settings.preferences))
        if (settings.appSettings) localStorage.setItem('app-settings', JSON.stringify(settings.appSettings))
        if (settings.expenses) localStorage.setItem('expenses', JSON.stringify(settings.expenses))
      }

      // Notify other components/tabs that storage has been restored
      window.dispatchEvent(new Event('storage'))
    } catch (storageError) {
      console.warn('Could not sync restored state to localStorage:', storageError)
    }

    console.log('[Database Restoration] Full database state imported successfully:', {
      invoicesRestored: invoices.length,
      customersRestored: customers.length,
      productsRestored: products.length,
      hasSettings: Boolean(settings),
    })

    return true
  } catch (error: any) {
    console.error('[Database Restoration] Error importing database state:', error)
    throw error
  }
}


