"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Printer, Plus, Trash2, Calculator, Menu, X, LogOut, FileText, Settings, HelpCircle, Box, BarChart3, Sun, Moon } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { printInvoice, generateInvoicePDFForSharing } from "@/lib/pdf-utils"
import { generateInvoiceWord } from "@/lib/word-utils"
import { useRouter } from "next/navigation"
import EnhancedCalculator from "./enhanced-calculator"
import TableColumnManager, { type TableColumn } from "./table-column-manager"
import { type SavedInvoice } from "./invoice-manager"
import InvoiceActions from "./invoice-actions"
import MobileActionMenu from "./mobile-action-menu"
import Link from "next/link"
import CloudStorageManager from "./cloud-storage-manager"
import OfflineStatus from './offline-status'
import PWAInstallButton from './pwa-install-button'
import { offlineStorage, createOfflineInvoice, isOfflineMode, type OfflineInvoice } from "@/lib/offline-storage"
import { ProductStorage, type WholesaleProduct } from "@/lib/product-storage"
import { useFeatureFlags } from "@/lib/feature-flags"
import { useI18n } from "@/components/i18n-provider"

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  discount: number
  [key: string]: any // For custom columns
}

interface CompanyInfo {
  name: string
  owner: string
  address: string
  phone1: string
  phone2: string
  email: string
}

interface ClientInfo {
  name: string
  address: string
  city: string
  phone: string
  email: string
}

export default function ProfessionalInvoice() {
  const router = useRouter()
  const { t } = useI18n()
  const { theme, toggleTheme } = useTheme()
  const { flags, isEnabled } = useFeatureFlags()
  const printRef = useRef<HTMLDivElement>(null)
  const [showCalculator, setShowCalculator] = useState(false)
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string>("")
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Update time every 30 seconds instead of every second to reduce re-renders
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 30000)

    // Monitor online/offline status
    const handleOnline = () => setOfflineMode(false)
    const handleOffline = () => setOfflineMode(true)
    
    setOfflineMode(!navigator.onLine)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      clearInterval(timer)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleThermalPrintRef = useRef<() => void>()

  // Keyboard shortcut listener for F9 POS Thermal Print
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault()
        if (handleThermalPrintRef.current) {
          handleThermalPrintRef.current()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const [invoiceNumber, setInvoiceNumber] = useState("INV-2025-001")
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState("")

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    name: "Biocure Health Care",
    owner: "Mushtaq Ahmad",
    address: "Sheikh Maltoon",
    phone1: "0345-5167742",
    phone2: "",
    email: "biocurehealthcare1979@gmail.com",
  })

  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    name: "",
    address: "",
    city: "",
    phone: "",
    email: "",
  })

  const [tableColumns, setTableColumns] = useState<TableColumn[]>([
    { id: "1", name: "Item", key: "index", type: "text", width: "6%", required: true, visible: true },
    { id: "2", name: "Description", key: "description", type: "text", width: "35%", required: true, visible: true },
    { id: "3", name: "Qty", key: "quantity", type: "number", width: "8%", required: true, visible: true },
    { id: "4", name: "Unit Price", key: "unitPrice", type: "number", width: "13%", required: true, visible: true },
    { id: "5", name: "Tax %", key: "taxRate", type: "percentage", width: "9%", required: false, visible: true },
    {
      id: "6",
      name: "Discount %",
      key: "discount",
      type: "percentage",
      width: "11%",
      required: false,
      visible: true,
    },
    { id: "7", name: "Total", key: "total", type: "number", width: "11%", required: true, visible: true },
  ])

  const [items, setItems] = useState<InvoiceItem[]>([
    { id: "1", description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 },
    { id: "2", description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 },
    { id: "3", description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 },
    { id: "4", description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 },
    { id: "5", description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 },
    { id: "6", description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 },
  ])

  const [activeDropdownRowId, setActiveDropdownRowId] = useState<string | null>(null)
  const [cloudAccounts, setCloudAccounts] = useState<any[]>([])
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)
  const [appSettings, setAppSettings] = useState<{ showEmailInPrint: boolean; showPhoneInPrint: boolean }>({
    showEmailInPrint: false,
    showPhoneInPrint: false,
  })


  useEffect(() => {
    // Skip auto-save on initial mount to prevent unnecessary operations
    if (!currentInvoiceId) return
    
    // Delay setting unsaved changes to prevent immediate re-render
    const unsavedTimer = setTimeout(() => setHasUnsavedChanges(true), 100)
    
    const autoSave = async () => {
      if (currentInvoiceId) {
        // Save to localStorage (existing behavior)
        const invoice: SavedInvoice = {
          id: currentInvoiceId,
          invoiceNumber,
          clientName: clientInfo.name,
          date: invoiceDate,
          dueDate,
          total: calculateGrandTotal(),
          status: "draft",
          items,
          clientInfo,
          companyInfo,
          tableColumns,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        const saved = localStorage.getItem("saved-invoices")
        const invoices = saved ? JSON.parse(saved) : []
        const existingIndex = invoices.findIndex((inv: SavedInvoice) => inv.id === currentInvoiceId)

        if (existingIndex >= 0) {
          invoices[existingIndex] = { ...invoice, createdAt: invoices[existingIndex].createdAt }
        } else {
          invoices.unshift(invoice)
        }

        localStorage.setItem("saved-invoices", JSON.stringify(invoices))

        // Also save to offline storage (IndexedDB) - only if online or in offline mode
        try {
          const offlineInvoice: OfflineInvoice = {
            id: currentInvoiceId,
            invoiceNumber,
            customerName: clientInfo.name,
            customerEmail: clientInfo.email,
            customerPhone: clientInfo.phone,
            customerAddress: clientInfo.address + ', ' + clientInfo.city,
            items: items.map(item => ({
              description: item.description,
              quantity: item.quantity,
              rate: item.unitPrice,
              amount: calculateItemTotal(item)
            })),
            subtotal: calculateSubtotal(),
            discount: calculateTotalDiscount(),
            total: calculateGrandTotal(),
            tax: calculateTotalTax(),
            status: invoice.status as 'draft' | 'sent' | 'paid' | 'overdue',
            createdAt: invoice.createdAt,
            updatedAt: new Date(),
            dueDate: dueDate ? new Date(dueDate) : undefined,
            syncStatus: navigator.onLine ? 'pending' : 'offline_only',
            lastModified: new Date()
          }
          
          await offlineStorage.saveInvoice(offlineInvoice)
        } catch (error) {
          console.error('Failed to save to offline storage:', error)
        }

        // Save to Supabase (online database)
        ;(async () => {
          try {
            const { isSupabaseConfigured } = await import("@/lib/supabase")
            if (!isSupabaseConfigured) {
              console.log('Supabase not configured - skipping cloud save')
              return
            }
            const { supabaseService } = await import("@/lib/supabase-service")
            await supabaseService.saveInvoice(invoice)
            console.log('Invoice saved to Supabase successfully:', invoice.invoiceNumber)
          } catch (error) {
            console.warn('Failed to save invoice to Supabase:', error)
            // Could show toast notification here
          }
        })()

        setHasUnsavedChanges(false)
      }
    }

    // Increased debounce time to 5 seconds to reduce operations
    const timeoutId = setTimeout(autoSave, 5000)
    return () => {
      clearTimeout(timeoutId)
      clearTimeout(unsavedTimer)
    }
  }, [invoiceNumber, invoiceDate, dueDate, items, clientInfo, companyInfo, tableColumns, currentInvoiceId])

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const loadInvoiceId = urlParams.get("load")

    if (loadInvoiceId) {
      const saved = localStorage.getItem("saved-invoices")
      if (saved) {
        const invoices = JSON.parse(saved)
        const invoiceToLoad = invoices.find((inv: SavedInvoice) => inv.id === loadInvoiceId)
        if (invoiceToLoad) {
          handleLoadInvoice(invoiceToLoad)
        }
      }
    }
  }, [])

  // Load app settings for print visibility flags
  useEffect(() => {
    const loadSettings = () => {
      try {
        const savedSettings = localStorage.getItem("app-settings")
        if (savedSettings) {
          const settings = JSON.parse(savedSettings)
          setAppSettings({
            showEmailInPrint: settings.invoice?.showEmailInPrint ?? true,
            showPhoneInPrint: settings.invoice?.showPhoneInPrint ?? true,
          })
        } else {
          setAppSettings({
            showEmailInPrint: true,
            showPhoneInPrint: true,
          })
        }
      } catch (error) {
        console.error('Failed to load app settings:', error)
      }
    }
    
    loadSettings()
    
    // Listen for storage changes from other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'app-settings') {
        loadSettings()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: "",
      quantity: 1,
      unitPrice: 0,
      taxRate: 0,
      discount: 0,
    }

    tableColumns.forEach((col) => {
      if (!["index", "total"].includes(col.key) && !newItem.hasOwnProperty(col.key)) {
        newItem[col.key] = col.type === "number" || col.type === "percentage" ? 0 : ""
      }
    })

    setItems([...items, newItem])
  }

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id))
  }

  const updateItem = (
    id: string,
    fieldOrUpdates: string | Record<string, any>,
    value?: string | number
  ) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === id) {
          if (typeof fieldOrUpdates === "object" && fieldOrUpdates !== null) {
            return { ...item, ...fieldOrUpdates }
          }
          return { ...item, [fieldOrUpdates]: value }
        }
        return item
      })
    )
  }

  const calculateItemTotal = (item: InvoiceItem) => {
    const subtotal = item.quantity * item.unitPrice
    const discountAmount = (subtotal * item.discount) / 100
    const afterDiscount = subtotal - discountAmount
    const taxAmount = (afterDiscount * item.taxRate) / 100
    return afterDiscount + taxAmount
  }

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  }

  const calculateTotalDiscount = () => {
    return items.reduce((sum, item) => {
      const subtotal = item.quantity * item.unitPrice
      return sum + (subtotal * item.discount) / 100
    }, 0)
  }

  const calculateTotalTax = () => {
    return items.reduce((sum, item) => {
      const subtotal = item.quantity * item.unitPrice
      const afterDiscount = subtotal - (subtotal * item.discount) / 100
      return sum + (afterDiscount * item.taxRate) / 100
    }, 0)
  }

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => sum + calculateItemTotal(item), 0)
  }


  const handleThermalPrint = async () => {
    try {
      persistCurrentInvoice()
    } catch (e) {
      console.warn("Could not save invoice before thermal printing:", e)
    }
    document.documentElement.classList.add("thermal-mode")
    document.body.classList.add("thermal-mode")

    const cleanup = () => {
      document.documentElement.classList.remove("thermal-mode")
      document.body.classList.remove("thermal-mode")
      window.removeEventListener("afterprint", cleanup)
    }
    window.addEventListener("afterprint", cleanup)

    setTimeout(() => {
      window.print()
      setTimeout(cleanup, 1000)
    }, 100)
  }
  handleThermalPrintRef.current = handleThermalPrint

  const handlePrint = async () => {
    // Save invoice before printing
    try {
      persistCurrentInvoice()
    } catch (e) {
      console.warn('Could not save invoice before printing:', e)
    }

    if (!printRef?.current) {
      window.print()
      return
    }
    
    try {
      await printInvoice(printRef.current)
    } catch (error) {
      console.error('Error printing invoice:', error)
      window.print()
    }
  }

  const persistCurrentInvoice = async () => {
    const now = new Date()
    // Ensure we have an ID for this invoice
    const id = currentInvoiceId && currentInvoiceId.length > 0 ? currentInvoiceId : Date.now().toString()
    if (!currentInvoiceId || currentInvoiceId.length === 0) {
      setCurrentInvoiceId(id)
    }

    const invoice: SavedInvoice = {
      id,
      invoiceNumber,
      clientName: clientInfo.name,
      date: invoiceDate,
      dueDate,
      total: calculateGrandTotal(),
      status: "draft",
      items,
      clientInfo,
      companyInfo,
      tableColumns,
      createdAt: now,
      updatedAt: now,
    }

    const saved = localStorage.getItem("saved-invoices")
    const invoices = saved ? JSON.parse(saved) : []
    const existingIndex = invoices.findIndex((inv: SavedInvoice) => inv.id === id)

    if (existingIndex >= 0) {
      // Preserve original createdAt if present
      invoices[existingIndex] = { ...invoice, createdAt: invoices[existingIndex].createdAt }
    } else {
      invoices.unshift(invoice)
    }

    localStorage.setItem("saved-invoices", JSON.stringify(invoices))

    // Also save to offline storage
    try {
      const offlineInvoice: OfflineInvoice = {
        id,
        invoiceNumber,
        customerName: clientInfo.name,
        customerEmail: clientInfo.email,
        customerPhone: clientInfo.phone,
        customerAddress: clientInfo.address + ', ' + clientInfo.city,
        items: items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.unitPrice,
          amount: calculateItemTotal(item)
        })),
        subtotal: calculateSubtotal(),
        discount: calculateTotalDiscount(),
        total: calculateGrandTotal(),
        tax: calculateTotalTax(),
        status: invoice.status as 'draft' | 'sent' | 'paid' | 'overdue',
        createdAt: invoice.createdAt,
        updatedAt: now,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        syncStatus: navigator.onLine ? 'pending' : 'offline_only',
        lastModified: now
      }
      
      await offlineStorage.saveInvoice(offlineInvoice)
    } catch (error) {
      console.error('Failed to save to offline storage:', error)
    }

    // Automated POS Wholesale Stock Deduction Engine
    try {
      ProductStorage.deductStockForInvoice(items)
    } catch (error) {
      console.error('Failed to auto-deduct POS inventory stock:', error)
    }

    setHasUnsavedChanges(false)
  }



  const handleLoadInvoice = (invoice: SavedInvoice) => {
    setCurrentInvoiceId(invoice.id)
    setInvoiceNumber(invoice.invoiceNumber)
    setInvoiceDate(invoice.date)
    setDueDate(invoice.dueDate)
    setItems(invoice.items)
    setClientInfo(invoice.clientInfo)
    setCompanyInfo(invoice.companyInfo)
    setTableColumns(invoice.tableColumns)
    setHasUnsavedChanges(false)
  }

  const handleSaveInvoice = (invoice: SavedInvoice) => {
    setCurrentInvoiceId(invoice.id)
    setHasUnsavedChanges(false)
  }

  const createNewInvoice = () => {
    setCurrentInvoiceId(Date.now().toString())
    setInvoiceNumber(`INV-2025-${String(Date.now()).slice(-3)}`)
    setInvoiceDate(new Date().toISOString().split("T")[0])
    setDueDate("")
    setItems([
      { id: "1", description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 },
      { id: "2", description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 },
      { id: "3", description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 },
      { id: "4", description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 },
      { id: "5", description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 },
    ])
    setClientInfo({
      name: "Client Name",
      address: "Client Address",
      city: "City, State 12345",
      phone: "+1 (555) 987-6543",
      email: "client@email.com",
    })
    setHasUnsavedChanges(false)
  }

  const handleDuplicateInvoice = () => {
    const newId = Date.now().toString()
    setCurrentInvoiceId(newId)
    setInvoiceNumber(`${invoiceNumber}-COPY`)
    setHasUnsavedChanges(true)
  }

  const handleDeleteInvoice = () => {
    if (confirm("Are you sure you want to delete this invoice? This action cannot be undone.")) {
      if (currentInvoiceId) {
        const saved = localStorage.getItem("saved-invoices")
        if (saved) {
          const invoices = JSON.parse(saved).filter((inv: SavedInvoice) => inv.id !== currentInvoiceId)
          localStorage.setItem("saved-invoices", JSON.stringify(invoices))
        }
        
        // Delete from Supabase
        ;(async () => {
          try {
            const { isSupabaseConfigured } = await import("@/lib/supabase")
            if (!isSupabaseConfigured) {
              console.log('Supabase not configured - skipping cloud delete')
              return
            }
            const { supabaseService } = await import("@/lib/supabase-service")
            await supabaseService.deleteInvoice(currentInvoiceId)
            console.log('Invoice deleted from Supabase successfully:', currentInvoiceId)
          } catch (error) {
            console.warn('Failed to delete invoice from Supabase:', error)
          }
        })()
      }
      createNewInvoice()
    }
  }

  const handleUpdateInvoice = () => {
    if (currentInvoiceId) {
      const invoice: SavedInvoice = {
        id: currentInvoiceId,
        invoiceNumber,
        clientName: clientInfo.name,
        date: invoiceDate,
        dueDate,
        total: calculateGrandTotal(),
        status: "draft",
        items,
        clientInfo,
        companyInfo,
        tableColumns,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const saved = localStorage.getItem("saved-invoices")
      const invoices = saved ? JSON.parse(saved) : []
      const existingIndex = invoices.findIndex((inv: SavedInvoice) => inv.id === currentInvoiceId)

      if (existingIndex >= 0) {
        invoices[existingIndex] = { ...invoice, createdAt: invoices[existingIndex].createdAt }
        localStorage.setItem("saved-invoices", JSON.stringify(invoices))
        setHasUnsavedChanges(false)
        
        // Save to Supabase
        ;(async () => {
          try {
            const { isSupabaseConfigured } = await import("@/lib/supabase")
            if (!isSupabaseConfigured) {
              console.log('Supabase not configured - skipping cloud save')
              return
            }
            const { supabaseService } = await import("@/lib/supabase-service")
            await supabaseService.saveInvoice(invoice)
            console.log('Invoice updated to Supabase successfully:', invoice.invoiceNumber)
            alert("Invoice updated successfully and saved to cloud!")
          } catch (error) {
            console.warn('Failed to update invoice to Supabase:', error)
            alert("Invoice updated locally but failed to sync to cloud")
          }
        })()
      }
    }
  }

  const renderTableCell = (item: InvoiceItem, column: TableColumn, index: number) => {
    if (column.key === "index") {
      return <span className="font-medium text-center block w-full">{index + 1}</span>
    }

    if (column.key === "total") {
      return <span className="font-semibold text-center block w-full whitespace-nowrap">Rs {Math.round(calculateItemTotal(item))}</span>
    }

    const value = item[column.key] || (column.type === "number" || column.type === "percentage" ? 0 : "")

    if (column.type === "number") {
      return (
        <>
          <Input
            type="number"
            step="1"
            value={value}
            onChange={(e) => updateItem(item.id, column.key, Number.parseFloat(e.target.value) || 0)}
            className="border-0 bg-transparent p-0 text-center focus:ring-0 print:hidden text-xs sm:text-sm w-full min-w-0 h-7"
          />
          <span className="hidden print:inline">
            {column.key === "unitPrice" ? `Rs ${Math.round(Number(value))}` : value}
          </span>
        </>
      )
    }

    if (column.type === "percentage") {
      return (
        <>
          <Input
            type="number"
            step="1"
            value={value}
            onChange={(e) => updateItem(item.id, column.key, Number.parseFloat(e.target.value) || 0)}
            className="border-0 bg-transparent p-0 text-center focus:ring-0 print:hidden text-xs sm:text-sm w-full min-w-0 h-7"
          />
          <span className="hidden print:inline">{value}%</span>
        </>
      )
    }

    if (column.key === "description") {
      const wholesaleProducts = ProductStorage.getProducts()
      const searchStr = (item.description || value || "").toString().toLowerCase().trim()
      const matchedProd = wholesaleProducts.find(
        (p) => p.name.toLowerCase() === searchStr || p.sku.toLowerCase() === searchStr
      )
      const filteredOptions = searchStr
        ? wholesaleProducts.filter(
            (p) =>
              p.name.toLowerCase().includes(searchStr) ||
              p.sku.toLowerCase().includes(searchStr)
          )
        : wholesaleProducts

      const isDropdownOpen = activeDropdownRowId === item.id && filteredOptions.length > 0

      return (
        <div className="relative group w-full min-w-0">
          <Input
            value={item.description || value || ""}
            autoComplete="off"
            spellCheck={false}
            autoCorrect="off"
            data-lpignore="true"
            onFocus={() => setActiveDropdownRowId(item.id)}
            onBlur={() => {
              setTimeout(() => {
                setActiveDropdownRowId((current) => (current === item.id ? null : current))
              }, 200)
            }}
            onChange={(e) => {
              const val = e.target.value
              updateItem(item.id, "description", val)
              const selected = wholesaleProducts.find(
                (p) => p.name.toLowerCase() === val.toLowerCase() || p.sku.toLowerCase() === val.toLowerCase()
              )
              if (selected) {
                updateItem(item.id, {
                  description: selected.name,
                  unitPrice: selected.unitPrice,
                  sku: selected.sku,
                })
              }
            }}
            className="border-0 bg-transparent p-0 focus:ring-0 print:hidden text-xs sm:text-sm w-full min-w-0 h-7"
            placeholder="Search/Enter product or SKU..."
          />

          {/* Premium Dark Dropdown */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 w-full min-w-[280px] sm:min-w-[320px] bg-slate-900 dark:bg-zinc-950 border border-slate-700 dark:border-zinc-800 text-white rounded-lg shadow-2xl z-50 max-h-56 overflow-y-auto mt-1 print:hidden divide-y divide-slate-800 dark:divide-zinc-800/60">
              {filteredOptions.slice(0, 10).map((p) => (
                <div
                  key={p.id}
                  onMouseDown={(e) => {
                    e.preventDefault()
                  }}
                  onClick={() => {
                    updateItem(item.id, {
                      description: p.name,
                      unitPrice: p.unitPrice,
                      sku: p.sku,
                    })
                    setActiveDropdownRowId(null)
                  }}
                  className="px-3 py-2 text-xs hover:bg-slate-800 dark:hover:bg-zinc-800/80 cursor-pointer flex justify-between items-center transition-colors"
                >
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-white">{p.name}</span>
                    <span className="text-[10px] text-slate-400">SKU: {p.sku}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-400">Rs {p.unitPrice}</span>
                    <div className="text-[10px] text-slate-400">{p.stockQuantity} in stock</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {matchedProd && (
            <div className="text-[10px] text-muted-foreground print:hidden flex items-center gap-1 mt-0.5 font-sans truncate">
              <span className={`font-semibold ${matchedProd.stockQuantity === 0 ? 'text-red-500' : matchedProd.stockQuantity <= matchedProd.minStockAlert ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                Stock: {matchedProd.stockQuantity} {matchedProd.unit}s
              </span>
              <span>• SKU: {matchedProd.sku}</span>
            </div>
          )}
          <span className="hidden print:inline">{value}</span>
        </div>
      )
    }

    return (
      <>
        <Input
          value={value}
          onChange={(e) => updateItem(item.id, column.key, e.target.value)}
          className="border-0 bg-transparent p-0 focus:ring-0 print:hidden text-xs sm:text-sm w-full min-w-0 h-7"
          placeholder={`Enter ${column.name.toLowerCase()}`}
        />
        <span className="hidden print:inline">{value}</span>
      </>
    )
  }

  const currentInvoiceData = {
    id: currentInvoiceId,
    invoiceNumber,
    invoiceDate,
    dueDate,
    items,
    clientInfo,
    companyInfo,
    tableColumns,
    grandTotal: calculateGrandTotal(),
  }

  const handleWordDownload = async () => {
    try {
      await generateInvoiceWord(currentInvoiceData)
    } catch (error) {
      console.error('Error generating Word document:', error)
      alert('Failed to generate Word document. Please try again.')
    }
  }

  const handleWhatsAppShare = async () => {
    if (!printRef?.current) {
      // Fallback to text message if PDF generation fails
      const message = encodeURIComponent(
        `📄 *Invoice ${invoiceNumber}*\n\n` +
          `👤 Client: ${clientInfo.name}\n` +
          `📅 Date: ${new Date(invoiceDate).toLocaleDateString()}\n` +
          `💰 Total: Rs ${calculateGrandTotal().toFixed(2)}\\n\\n` +
          `Thank you for your business! 🙏\n\n` +
          `*BioCure Health Care*\n` +
          `📞 0345-5167742`,
      )
      window.open(`https://wa.me/?text=${message}`, "_blank")
      return
    }

    try {
      // Generate PDF blob for sharing
      const pdfBlob = await generateInvoicePDFForSharing(
        printRef.current,
        {
          filename: `invoice-${invoiceNumber}.pdf`,
          format: 'a4',
          orientation: 'portrait'
        }
      )

      // Create a temporary URL for the PDF
      const pdfUrl = URL.createObjectURL(pdfBlob)
      
      // Check if Web Share API is supported and can share files
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([pdfBlob], `invoice-${invoiceNumber}.pdf`, { type: 'application/pdf' })] })) {
        const pdfFile = new File([pdfBlob], `invoice-${invoiceNumber}.pdf`, { type: 'application/pdf' })
        await navigator.share({
          title: `Invoice ${invoiceNumber}`,
          text: `Invoice for ${clientInfo.name} - Total: Rs ${calculateGrandTotal().toFixed(2)}`,
          files: [pdfFile]
        })
      } else {
        // Fallback: Create download link and WhatsApp text message
        const downloadLink = document.createElement('a')
        downloadLink.href = pdfUrl
        downloadLink.download = `invoice-${invoiceNumber}.pdf`
        document.body.appendChild(downloadLink)
        downloadLink.click()
        document.body.removeChild(downloadLink)

        // Open WhatsApp with text message
        const message = encodeURIComponent(
          `📄 *Invoice ${invoiceNumber}* (PDF downloaded)\n\n` +
            `👤 Client: ${clientInfo.name}\n` +
            `📅 Date: ${new Date(invoiceDate).toLocaleDateString()}\n` +
            `💰 Total: Rs ${calculateGrandTotal().toFixed(2)}\\n\\n` +
            `Please find the invoice PDF in your downloads. Thank you for your business! 🙏\n\n` +
            `*Biocure Health Care*\n` +
            `📞 0345-5167742`,
        )
        window.open(`https://wa.me/?text=${message}`, "_blank")
      }

      // Clean up the temporary URL
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000)
    } catch (error) {
      console.error('Error sharing PDF via WhatsApp:', error)
      // Fallback to text message
      const message = encodeURIComponent(
        `📄 *Invoice ${invoiceNumber}*\n\n` +
          `👤 Client: ${clientInfo.name}\n` +
          `📅 Date: ${new Date(invoiceDate).toLocaleDateString()}\n` +
          `💰 Total: Rs ${calculateGrandTotal().toFixed(2)}\\n\\n` +
          `Thank you for your business! 🙏\n\n` +
          `*Biocure Health Care*\n` +
          `📞 0345-5167742`,
      )
      window.open(`https://wa.me/?text=${message}`, "_blank")
    }
  }

  const handlePhoneClick = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "")
    const message = encodeURIComponent("Hello! I'm contacting you regarding your invoice.")
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank")
  }

  const handleEmailClick = (email: string) => {
    window.open(`mailto:${email}`, "_blank")
  }

  const toggleCalculator = () => {
    setShowCalculator(!showCalculator)
  }


  const formatDateTime = (date: Date) => {
    return {
      time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }),
      date: date.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    }
  }

  const { time, date } = formatDateTime(currentTime)

  const handleLogout = () => {
    router.push("/logout")
  }

  const handleCloudAccountConnect = (account: any) => {
    console.log("[uzair] Cloud account connected:", account)
    const updatedAccounts = [...cloudAccounts, account]
    setCloudAccounts(updatedAccounts)

    // Enable auto-sync if this is the first connected account
    if (updatedAccounts.length === 1) {
      setAutoSyncEnabled(true)
    }
  }

  const handleCloudAccountDisconnect = (accountId: string) => {
    console.log("[uzair] Cloud account disconnected:", accountId)
    const updatedAccounts = cloudAccounts.filter((acc) => acc.id !== accountId)
    setCloudAccounts(updatedAccounts)

    // Disable auto-sync if no accounts left
    if (updatedAccounts.length === 0) {
      setAutoSyncEnabled(false)
    }
  }

  const handleAutoSyncToggle = (accountId: string, enabled: boolean) => {
    console.log("[uzair] Auto-sync toggled:", accountId, enabled)
    setAutoSyncEnabled(enabled)
  }

  useEffect(() => {
    if (autoSyncEnabled && cloudAccounts.length > 0 && currentInvoiceId) {
      const saveToCloud = async () => {
        console.log("[uzair] Auto-syncing invoice to cloud storage...")
        // Simulate cloud save
        const invoiceData = {
          id: currentInvoiceId,
          invoiceNumber,
          clientName: clientInfo.name,
          date: invoiceDate,
          total: calculateGrandTotal(),
          data: {
            items,
            clientInfo,
            companyInfo,
            tableColumns,
          },
        }

        // In a real implementation, this would upload to the connected cloud services
        console.log("[uzair] Invoice synced to cloud:", invoiceData)
      }

      const timeoutId = setTimeout(saveToCloud, 5000) // Auto-sync after 5 seconds
      return () => clearTimeout(timeoutId)
    }
  }, [invoiceNumber, invoiceDate, items, clientInfo, autoSyncEnabled, cloudAccounts.length, currentInvoiceId])

  return (
    <div className="w-full max-w-none mx-auto bg-background relative px-2 sm:px-4 lg:px-6">
      {/* Control Panel */}
      <div className="control-panel p-2 sm:p-4 bg-muted border-b print:hidden">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2 sm:gap-4">
            {hasUnsavedChanges && (
              <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-medium">
                Unsaved Changes
              </span>
            )}
            {mounted && offlineMode && (
              <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                📱 Offline Mode
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="lg:hidden">
              <Button variant="outline" size="sm" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </Button>
            </div>

            <div className="control-buttons flex items-center gap-2">
              <Button onClick={handleThermalPrint} size="sm" className="bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-2 mr-2"><Printer className="w-4 h-4" /> POS Thermal (F9)</Button>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="w-8 h-8 rounded-full border-gray-300 dark:border-slate-700 bg-background hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0 shadow-sm"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400 fill-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700 fill-slate-700" />
                )}
              </Button>
              <InvoiceActions
                invoice={currentInvoiceData}
                onDuplicate={handleDuplicateInvoice}
                onDelete={handleDeleteInvoice}
                onUpdate={handleUpdateInvoice}
                onWhatsAppShare={handleWhatsAppShare}
                onSave={persistCurrentInvoice}
                printRef={printRef}
              />
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="bg-transparent text-red-600 hover:text-red-700"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="lg:hidden mb-4 p-4 bg-card rounded-lg border space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <PWAInstallButton 
                variant="default" 
                size="sm" 
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              >
                Install App
              </PWAInstallButton>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <InvoiceActions
                invoice={currentInvoiceData}
                onDuplicate={handleDuplicateInvoice}
                onDelete={handleDeleteInvoice}
                onUpdate={handleUpdateInvoice}
                onWhatsAppShare={handleWhatsAppShare}
                onSave={persistCurrentInvoice}
                printRef={printRef}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={handleThermalPrint}
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                POS
              </Button>
              <Button
                onClick={handlePrint}
                size="sm"
                className="flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center justify-center gap-1.5 bg-transparent text-green-600 hover:text-green-700"
              >
                <FileText className="w-4 h-4" />
                Word
              </Button>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="w-full text-red-600 hover:text-red-700 bg-transparent"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t('auth.logout')}
            </Button>
          </div>
        )}

        <div className="control-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1 text-foreground">{t('fields.invoiceNumber')}</label>
            <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="text-sm h-8" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-foreground">{t('fields.invoiceDate')}</label>
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="text-sm h-8"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-xs font-medium mb-1 text-foreground">{t('fields.dueDate')}</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="text-sm h-8" />
          </div>
        </div>
      </div>

      {/* Floating Action Buttons - Bottom Right Corner - Fixed relative to main content area */}
      <div className="floating-actions fixed bottom-4 right-4 z-20 print:hidden flex flex-col gap-3 transition-all duration-300 ease-in-out">
        {/* Calculator FAB */}
        <Button
          onClick={toggleCalculator}
          className="rounded-full w-14 h-14 bg-blue-600/60 hover:bg-blue-700/70 shadow-lg hover:shadow-xl transition-all duration-200 backdrop-blur-sm border border-white/20"
          title={t('actions.openCalculator')}
        >
          <Calculator className="w-6 h-6 text-white/80" />
        </Button>
      </div>



      <MobileActionMenu onPrint={handlePrint} onWhatsAppShare={handleWhatsAppShare} onWordDownload={handleWordDownload} />

      <EnhancedCalculator isOpen={showCalculator} onClose={() => setShowCalculator(false)} />

      <div ref={printRef} className="invoice-document bg-card w-full max-w-[210mm] mx-auto origin-top">
        {/* Header Section - Logo/Company Info on Left, Invoice Details on Right */}
        <div className="invoice-header bg-gradient-to-r from-blue-900 to-blue-800 text-white p-3 sm:p-4 md:p-6 relative">
          {/* Invoice details box - Responsive top-right corner */}
          <div className="details-card absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4 bg-white/15 backdrop-blur-sm p-2 sm:p-3 rounded-lg sm:rounded-xl border border-white/20 shadow-lg min-w-[140px] sm:min-w-[180px] md:min-w-[220px] z-10">
            <div className="text-center mb-1.5 sm:mb-2">
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-white">{t('invoice.header.title')}</h2>
            </div>
            <div className="space-y-1 sm:space-y-1.5 text-center">
              <div className="border-b border-white/20 pb-1 sm:pb-1.5">
                <p className="text-[9px] sm:text-[10px] font-medium text-blue-100 uppercase tracking-wider">{t('invoice.header.no')}</p>
                <p className="text-[10px] sm:text-xs md:text-sm font-bold text-white break-all">{invoiceNumber}</p>
              </div>
              <div className="border-b border-white/20 pb-1 sm:pb-1.5">
                <p className="text-[9px] sm:text-[10px] font-medium text-blue-100 uppercase tracking-wider">{t('invoice.header.date')}</p>
                <p className="text-[10px] sm:text-xs md:text-sm font-semibold text-white">{new Date(invoiceDate).toLocaleDateString()}</p>
              </div>
              {dueDate && (
                <div>
                  <p className="text-[9px] sm:text-[10px] font-medium text-blue-100 uppercase tracking-wider">{t('invoice.header.dueDate')}</p>
                  <p className="text-[10px] sm:text-xs md:text-sm font-semibold text-yellow-200">{new Date(dueDate).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </div>

          {/* Company logo and details - Responsive padding to avoid overlap */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 pr-[150px] sm:pr-[190px] md:pr-[240px]">
            <Link
              href="/"
              className="bg-white p-1.5 sm:p-2 rounded-lg shadow-lg flex-shrink-0 hover:shadow-xl transition-shadow cursor-pointer"
            >
              <img src="/images/biocure-health-care-logo.jpg" alt="Biocure Health Care Logo" className="company-logo h-8 sm:h-12 md:h-16 w-auto" />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">{companyInfo.name}</h1>
              <div className="text-blue-100 space-y-0.5 sm:space-y-1 text-[10px] sm:text-xs md:text-sm">
                <p>
                  <strong>Owner:</strong> {companyInfo.owner}
                </p>
                <p className="break-words">
                  <strong>Address:</strong> {companyInfo.address}
                </p>
                <p>
                  <strong>N.T.N:</strong> 6309621-3
                </p>
                <p>
                  <strong>Phone:</strong>
                  <span
                    onClick={() => handlePhoneClick(companyInfo.phone1)}
                    className="hover:text-blue-200 transition-colors cursor-pointer ml-1 print:cursor-default"
                  >
                    {companyInfo.phone1}
                  </span>
                  {companyInfo.phone2 && (
                    <>
                      {" | "}
                      <span
                        onClick={() => handlePhoneClick(companyInfo.phone2)}
                        className="hover:text-blue-200 transition-colors cursor-pointer print:cursor-default"
                      >
                        {companyInfo.phone2}
                      </span>
                    </>
                  )}
                </p>
                <p className="break-all">
                  <strong>Email:</strong>
                  <span
                    onClick={() => handleEmailClick(companyInfo.email)}
                    className="hover:text-blue-200 transition-colors cursor-pointer ml-1 print:cursor-default"
                  >
                    {companyInfo.email}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Client Information */}
        <div className="p-4 sm:p-6">
          <div className="bg-muted p-4 rounded-lg mb-6">
            <h3 className="text-lg font-bold text-foreground mb-3">{t('invoice.billTo')}</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="print:hidden">
                {/* Stack each field: label on its own line, value on next line */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-foreground">{t('fields.name')}</label>
                    <Input
                      placeholder="Muhammad Uzair"
                      value={clientInfo.name}
                      onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
                      className="text-sm h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-foreground">{t('fields.address')}</label>
                    <Input
                      placeholder="Takht-Bhai District Mardan KPK"
                      value={clientInfo.address}
                      onChange={(e) => setClientInfo({ ...clientInfo, address: e.target.value })}
                      className="text-sm h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-foreground">{t('fields.city')}</label>
                    <Input
                      placeholder="Mardan 23200 KPK"
                      value={clientInfo.city}
                      onChange={(e) => setClientInfo({ ...clientInfo, city: e.target.value })}
                      className="text-sm h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-foreground">{t('fields.phone')}</label>
                    <Input
                      placeholder="+923433885835"
                      value={clientInfo.phone}
                      onChange={(e) => setClientInfo({ ...clientInfo, phone: e.target.value })}
                      className="text-sm h-9"
                    />
                  </div>
                                  </div>
              </div>

              <div className="hidden print:block">
                {/* Print view: each label and value on separate lines */}
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Name</p>
                    <p className="font-bold text-base break-words">{clientInfo.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Address</p>
                    <p className="text-sm break-words">{clientInfo.address}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">City</p>
                    <p className="text-sm break-words">{clientInfo.city}</p>
                  </div>
                  {appSettings.showPhoneInPrint && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Phone</p>
                      <p className="text-sm break-words">{clientInfo.phone}</p>
                    </div>
                  )}
                                  </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3 print:hidden">
              <h3 className="text-lg font-semibold text-foreground">Invoice Items</h3>
              <TableColumnManager columns={tableColumns} onColumnsChange={setTableColumns} />
            </div>

            <div className="table-container w-full overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-blue-900 text-white">
                    {tableColumns
                      .filter((col) => col.visible)
                      .map((column) => (
                        <th
                          key={column.id}
                          className={`border border-blue-800 p-1 font-semibold text-center ${
                            column.key === "index"
                              ? "w-[5%]"
                              : column.key === "description"
                                ? "w-[35%] text-left px-2"
                                : column.key === "quantity"
                                  ? "w-[8%]"
                                  : column.key === "unitPrice"
                                    ? "w-[14%]"
                                    : column.key === "taxRate"
                                      ? "w-[9%]"
                                      : column.key === "discount"
                                        ? "w-[11%]"
                                        : column.key === "total"
                                          ? "w-[11%]"
                                          : "w-[10%]"
                          }`}
                        >
                          {column.name}
                        </th>
                      ))}
                    <th className="w-[7%] border border-blue-800 p-1 text-center font-semibold print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 0 ? "bg-muted/50" : "bg-card"}>
                      {tableColumns
                        .filter((col) => col.visible)
                        .map((column) => (
                          <td
                            key={column.id}
                            className={`border border-border p-1 text-center ${
                              column.key === "index"
                                ? "w-[5%]"
                                : column.key === "description"
                                  ? "w-[35%] text-left px-2"
                                  : column.key === "quantity"
                                    ? "w-[8%]"
                                    : column.key === "unitPrice"
                                      ? "w-[14%]"
                                      : column.key === "taxRate"
                                        ? "w-[9%]"
                                        : column.key === "discount"
                                          ? "w-[11%]"
                                          : column.key === "total"
                                            ? "w-[11%]"
                                            : "w-[10%]"
                            }`}
                          >
                            {renderTableCell(item, column, index)}
                          </td>
                        ))}
                      <td className="w-[7%] border border-border p-1 text-center print:hidden">
                        <div className="flex justify-center items-center h-full w-full">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                            className="text-red-600 hover:text-red-800 p-1 h-7 w-7"
                            title="Delete Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 print:hidden">
              <Button onClick={addItem} variant="outline" className="flex items-center gap-2 bg-transparent text-sm">
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
            </div>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end mb-6">
            <div className="w-full sm:w-auto sm:max-w-sm">
              <div className="bg-muted p-4 rounded-lg">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-semibold text-foreground">Rs {calculateSubtotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Discount:</span>
                    <span className="font-semibold text-red-600">-Rs {calculateTotalDiscount().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Tax:</span>
                    <span className="font-semibold text-foreground">Rs {calculateTotalTax().toFixed(2)}</span>
                  </div>
                  <div className="border-t border-border pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-base sm:text-lg font-bold text-blue-900">
                        Grand Total:
                      </span>
                      <span className="text-lg sm:text-xl font-bold text-blue-900">
                        Rs {calculateGrandTotal().toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* Signature and Stamp */}
          <div className="signature-stamp p-4 sm:p-6 pt-0">
            <div className="grid grid-cols-3 gap-4 sm:gap-6 md:gap-8 items-end text-center">
              {/* Customer Signature */}
              <div className="flex flex-col items-center">
                <div className="min-h-[60px] sm:min-h-[80px] flex items-end justify-center w-full" />
                <div className="sig-line mt-1 w-32 sm:w-44 md:w-56" />
                <p className="mt-1 sm:mt-2 text-[8px] xs:text-[9px] sm:text-xs text-muted-foreground whitespace-nowrap">Customer Signature</p>
              </div>
              {/* Company Stamp - MOVED TO MIDDLE */}
              <div className="flex flex-col items-center">
                <div className="min-h-[60px] sm:min-h-[80px] flex items-end justify-center w-full">
                  <img
                    src="/images/biocurestamp.png"
                    alt="Company Stamp"
                    className="stamp w-auto opacity-80 max-h-[50px] sm:max-h-[70px]"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
                <div className="sig-line mt-1 w-32 sm:w-44 md:w-56" />
                <p className="mt-1 sm:mt-2 text-[8px] xs:text-[9px] sm:text-xs text-muted-foreground whitespace-nowrap">Company Stamp</p>
              </div>
              {/* Authorized Signature - MOVED TO RIGHT */}
              <div className="flex flex-col items-center">
                <div className="min-h-[60px] sm:min-h-[80px] flex items-end justify-center w-full">
                  <img
                    src="/images/biocuresign.png"
                    alt="Authorized Signature"
                    className="sign w-auto max-h-[50px] sm:max-h-[70px]"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
                <div className="sig-line mt-1 w-32 sm:w-44 md:w-56" />
                <p className="mt-1 sm:mt-2 text-[8px] xs:text-[9px] sm:text-xs text-muted-foreground whitespace-nowrap">Authorized Signature</p>
              </div>
            </div>
          </div>

          {/* Footer Section */}
          <div className="invoice-footer border-t border-border pt-4 mt-4">
            <div className="text-center">
              <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white p-3 rounded-lg">
                <h3 className="text-sm sm:text-base font-bold mb-2">Thank You for Your Business!</h3>
                <div className="text-[10px] sm:text-xs text-blue-100 space-y-0.5">
                  <p>For any queries or assistance regarding this invoice, please don't hesitate to contact us.</p>
                  <p className="font-medium">We value your trust and are committed to providing exceptional service.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated 80mm POS Thermal Receipt - Isolated container for thermal printer */}
      <div id="pos-thermal-receipt" className="pos-thermal-receipt hidden print:hidden">
        <div className="receipt-content w-[76mm] max-w-[80mm] mx-auto p-1 text-black bg-white font-mono text-[11px] leading-tight select-none">
          {/* Centered Pharmacy Header */}
          <div className="text-center mb-1">
            <h1 className="text-sm font-bold uppercase tracking-wider">{companyInfo.name || "BIOCURE HEALTH CARE"}</h1>
            {companyInfo.owner && <p className="text-[10px]">Prop: {companyInfo.owner}</p>}
            {companyInfo.address && <p className="text-[10px]">{companyInfo.address}</p>}
            {companyInfo.phone1 && (
              <p className="text-[10px]">
                Tel: {companyInfo.phone1}
                {companyInfo.phone2 ? ` / ${companyInfo.phone2}` : ""}
              </p>
            )}
            {companyInfo.email && <p className="text-[9px]">{companyInfo.email}</p>}
          </div>

          {/* Receipt Divider & Title */}
          <div className="border-t border-b border-dashed border-black py-0.5 my-1 text-center font-bold text-xs uppercase tracking-wide">
            RETAIL CASH MEMO
          </div>

          {/* Metadata */}
          <div className="text-[10px] space-y-0.5 my-1">
            <div className="flex justify-between">
              <span>Bill #: <strong>{invoiceNumber}</strong></span>
              <span>Date: {invoiceDate}</span>
            </div>
            <div className="flex justify-between">
              <span>Time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span>Counter: 01</span>
            </div>
            {clientInfo.name && (
              <div className="flex justify-between border-t border-dotted border-gray-400 pt-0.5 mt-0.5">
                <span>Patient / Customer:</span>
                <span className="font-semibold text-right">{clientInfo.name}</span>
              </div>
            )}
            {clientInfo.phone && (
              <div className="flex justify-between">
                <span>Phone:</span>
                <span>{clientInfo.phone}</span>
              </div>
            )}
          </div>

          {/* Table Header: Item, Qty, Total */}
          <div className="border-t border-b border-dashed border-black py-0.5 my-1">
            <div className="flex justify-between font-bold text-[10px]">
              <span className="w-[52%] text-left">ITEM</span>
              <span className="w-[18%] text-center">QTY</span>
              <span className="w-[30%] text-right">TOTAL</span>
            </div>
          </div>

          {/* Compact Items List */}
          <div className="space-y-1 my-1">
            {items
              .filter((item) => (item.description && item.description.trim() !== "") || item.unitPrice > 0)
              .map((item, idx) => {
                const itemTotal = calculateItemTotal(item)
                return (
                  <div key={item.id || idx} className="text-[10px]">
                    <div className="font-semibold break-words leading-tight">
                      {idx + 1}. {item.description || "Medicine / Item"}
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-800">
                      <span className="w-[52%] text-left pl-2">
                        {item.quantity} x Rs {Number(item.unitPrice || 0).toFixed(2)}
                        {item.discount > 0 ? ` (-${item.discount}%)` : ""}
                      </span>
                      <span className="w-[18%] text-center font-medium">{item.quantity}</span>
                      <span className="w-[30%] text-right font-semibold">Rs {itemTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )
              })}
          </div>

          {/* Dashed Divider */}
          <div className="border-t border-dashed border-black my-1" />

          {/* Totals Summary */}
          <div className="text-[10px] space-y-0.5 my-1">
            <div className="flex justify-between">
              <span>
                Total Items: {items.filter((item) => (item.description && item.description.trim() !== "") || item.unitPrice > 0).length}
              </span>
              <span>
                Total Qty: {items.filter((item) => (item.description && item.description.trim() !== "") || item.unitPrice > 0).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)}
              </span>
            </div>

            {calculateTotalDiscount() > 0 && (
              <>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>Rs {calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>-Rs {calculateTotalDiscount().toFixed(2)}</span>
                </div>
              </>
            )}

            {calculateTotalTax() > 0 && (
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>Rs {calculateTotalTax().toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Grand Total */}
          <div className="border-t-2 border-b-2 border-dashed border-black py-1 my-1">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="tracking-wide">GRAND TOTAL:</span>
              <span className="text-sm">Rs {calculateGrandTotal().toFixed(2)}</span>
            </div>
          </div>

          {/* Pharmacy POS Footer */}
          <div className="text-center text-[9px] space-y-0.5 mt-2 pt-1 border-t border-dashed border-gray-400">
            <p className="font-bold">*** THANK YOU FOR YOUR VISIT ***</p>
            <p>Wish you a speedy recovery!</p>
            <p>Medicines once sold cannot be returned without original receipt within 3 days.</p>
            <p>Cold chain & cut blister medicines are non-refundable.</p>
            <p className="text-[8px] text-gray-600 pt-0.5">Software Powered by Biocure Systems</p>
          </div>
        </div>
      </div>

      {/* Enhanced Print Styles for PDF Generation */}
      <style jsx global>{`
        /* Thermal Receipt isolation rules */
        .pos-thermal-receipt {
          display: none !important;
        }

        body.thermal-mode, html.thermal-mode {
          width: 80mm !important;
          max-width: 80mm !important;
          min-width: 80mm !important;
          height: auto !important;
          margin: 0 auto !important;
          padding: 0 !important;
          background: white !important;
          color: black !important;
        }

        body.thermal-mode .invoice-document,
        body.thermal-mode .floating-actions,
        body.thermal-mode .control-buttons,
        body.thermal-mode .no-print-thermal,
        body.thermal-mode header,
        body.thermal-mode nav {
          display: none !important;
        }

        body.thermal-mode .pos-thermal-receipt {
          display: block !important;
          width: 80mm !important;
          max-width: 80mm !important;
          margin: 0 auto !important;
          padding: 2mm 3mm !important;
          box-sizing: border-box !important;
          background: white !important;
          color: black !important;
        }
        /* Invoice watermark (screen) */
        .invoice-document {
          position: relative;
          overflow: hidden;
          /* Match printable border style on screen */
          border: 8px solid rgb(241, 238, 231);
          border-radius: 0;
          box-shadow: none;
          background: #ffffff;
        }
        .invoice-document::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: url('/images/biocure-health-care-logo.jpg');
          background-repeat: no-repeat;
          /* Move slightly down and show colorful logo on screen */
          background-position: center 58%;
          background-size: contain;
          opacity: 0.16;
          pointer-events: none;
          z-index: 0;
          filter: none;
          mix-blend-mode: normal;
        }
        .invoice-document > * { position: relative; z-index: 1; }

        /* Enhanced header visuals (screen) */
        .invoice-header { position: relative; overflow: hidden; }
        .invoice-header::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(1200px 600px at 15% 0%, rgba(255,255,255,0.10), transparent 40%),
            radial-gradient(900px 500px at 85% 10%, rgba(255,255,255,0.08), transparent 45%);
          pointer-events: none;
        }
        .invoice-header::after {
          content: "";
          position: absolute;
          left: 0; right: 0; bottom: 0;
          height: 4px;
          background: linear-gradient(90deg, #22d3ee, #60a5fa, #a78bfa);
          opacity: 0.95;
        }
        .invoice-header .company-logo {
          filter: drop-shadow(0 4px 12px rgba(0,0,0,0.25));
        }
        .invoice-header h1 { letter-spacing: 0.02em; }
        .details-card {
          background: rgba(255,255,255,0.18);
          border: 1px solid rgba(255,255,255,0.35);
          box-shadow: 0 6px 20px rgba(0,0,0,0.18);
          backdrop-filter: blur(8px);
        }

        /* Screen-only table enhancements */
        .invoice-document table thead th {
          background: linear-gradient(to right, #1e3a8a, #1e40af) !important;
          color: #ffffff !important;
          letter-spacing: 0.02em;
        }
        /* Match printable table borders on screen */
        .invoice-document table { border-collapse: collapse; }
        .invoice-document th, .invoice-document td { border: 1px solid #e5e7eb; }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          html, body {
            width: 210mm;
            height: 297mm;
          }

          body { 
            margin: 0;
            padding: 0;
            background: white !important;
          }
          
          body.thermal-mode, html.thermal-mode {
            width: 80mm !important;
            max-width: 80mm !important;
            min-width: 80mm !important;
            height: auto !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: white !important;
          }

          body.thermal-mode .invoice-document {
            display: none !important;
          }

          body.thermal-mode .pos-thermal-receipt {
            display: block !important;
          }
          
          .invoice-document { 
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            transform: scale(1) !important;
            transform-origin: top center !important;
            background: white !important;
            width: 100% !important;
            max-width: 210mm !important;
            border: 8px solid rgb(241, 238, 231) !important;
            border-radius: 0 !important;
            page-break-inside: avoid !important;
            overflow: visible !important;
            box-sizing: border-box !important;
          }
          
          .invoice-header {
            background: linear-gradient(to right, #1e3a8a, #1e40af) !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: white !important;
            position: relative !important;
            border-bottom: 3px solid rgb(241, 238, 231) !important;
          }
          .invoice-header::before {
            content: "" !important;
            position: absolute !important;
            inset: 0 !important;
            background:
              radial-gradient(900px 450px at 15% 0%, rgba(255,255,255,0.08), transparent 40%),
              radial-gradient(700px 400px at 85% 10%, rgba(255,255,255,0.06), transparent 45%) !important;
            pointer-events: none !important;
          }
          .invoice-header::after {
            content: "" !important;
            position: absolute !important;
            left: 0; right: 0; bottom: 0;
            height: 3px !important;
            background: linear-gradient(90deg, #22d3ee, #60a5fa, #a78bfa) !important;
          }
          .invoice-header .company-logo { filter: drop-shadow(0 2px 8px rgba(0,0,0,0.25)) !important; }
          /* Watermark (print) */
          .invoice-document::before {
            background-repeat: no-repeat !important;
            /* Move slightly down in print as well */
            background-position: center 58% !important;
            background-size: contain !important; /* show full logo without cropping */
            opacity: 0.18 !important; /* slightly stronger, still formal */
            filter: none !important; /* preserve original logo colors */
            mix-blend-mode: normal !important; /* avoid color shifts */
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .hidden.print\\:block {
            display: block !important;
          }
          
          .hidden.print\\:inline {
            display: inline !important;
          }
          
          .print\\:static {
            position: static !important;
          }
          
          .mobile-hide {
            display: table-cell !important;
          }
          
          table {
            page-break-inside: auto;
          }

          /* Print table refinements */
          .invoice-document table { border-collapse: collapse !important; }
          .invoice-document th, .invoice-document td { border: 0.4pt solid #e5e7eb !important; }
          .invoice-document thead th {
            background: linear-gradient(to right, #1e3a8a, #1e40af) !important;
            color: #ffffff !important;
          }
          
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          
          thead {
            display: table-header-group;
          }
          
          tfoot {
            display: table-footer-group;
          }
          
          @page {
            size: A4;
            margin: 0;
          }
          
          body {
            margin: 0.18in 0.22in !important;
            background: rgb(241, 238, 231) !important;
          }
          
          .invoice-header {
            padding: 0.65rem !important;
          }
          
          .invoice-header h1 {
            font-size: 22px !important; /* Larger company name in print for clarity */
            line-height: 1.25 !important;
          }
          .invoice-header .company-logo {
            height: 72px !important; /* Slightly larger logo in print */
            width: auto !important;
          }
          
          .invoice-header p, .invoice-header span {
            font-size: 10px !important;
          }
          
          .invoice-header .text-sm,
          .invoice-header .text-xs,
          .invoice-header .text-\[10px\],
          .invoice-header .text-\[9px\] {
            font-size: 10px !important;
          }
          
          .p-4, .p-6 {
            padding: 0.65rem !important;
          }
          
          .mb-6 {
            margin-bottom: 0.65rem !important;
          }
          
          .invoice-footer {
            padding-top: 0.55rem !important;
            margin-top: 0.55rem !important;
            page-break-inside: avoid !important;
            border-top: 2px solid rgb(241, 238, 231) !important;
          }
          
          .invoice-footer .bg-gradient-to-r {
            padding: 0.55rem 0.5rem !important;
            margin: 0 !important;
            border: 2px solid rgb(241, 238, 231) !important;
            border-radius: 6px !important;
          }
          
          .invoice-footer h3 {
            font-size: 12px !important;
            margin-bottom: 0.3rem !important;
          }
          
          .invoice-footer p {
            font-size: 9.5px !important;
            line-height: 1.4 !important;
            margin-bottom: 0.15rem !important;
          }
          
          th, td {
            padding: 0.3rem 0.4rem !important;
            font-size: 10px !important;
          }
          
          th {
            font-size: 11px !important;
            font-weight: 600 !important;
          }
          
          /* Bill To section */
          .bg-muted {
            padding: 0.65rem !important;
          }
          
          .bg-muted h3 {
            font-size: 16px !important;
            margin-bottom: 0.7rem !important;
          }
          
          .bg-muted p {
            font-size: 12px !important;
            line-height: 1.6 !important;
          }
          
          /* Totals section */
          .bg-muted .text-sm {
            font-size: 13px !important;
          }
          
          .bg-muted .text-base,
          .bg-muted .text-lg {
            font-size: 16px !important;
          }
          
          .bg-muted .text-xl {
            font-size: 18px !important;
          }
          
          .bg-gradient-to-r {
            background: linear-gradient(to right, #1e3a8a, #1e40af) !important;
          }
          
          .bg-blue-900 {
            background-color: #1e3a8a !important;
          }
          
          .text-white {
            color: white !important;
          }
          
          .text-blue-100 {
            color: #dbeafe !important;
          }

          /* Signature & Stamp print tuning */
          .signature-stamp .stamp {
            height: 60px !important;
            opacity: 1 !important;
          }
          .signature-stamp .sign {
            height: 48px !important;
          }
          .signature-stamp .sig-line {
            border-bottom: 1px dashed #e5e7eb !important;
          }
        }
        
        /* Signature & Stamp screen sizing (app view) */
        .signature-stamp .stamp {
          height: 46px;
          width: auto;
        }
        .signature-stamp .sign {
          height: 38px;
          width: auto;
        }
        @media (min-width: 640px) {
          .signature-stamp .stamp { height: 52px; }
          .signature-stamp .sign { height: 42px; }
        }
        
        /* Enhanced PDF generation styles */
        .pdf-optimized {
          font-family: 'Arial', sans-serif;
          line-height: 1.4;
        }
        
        .pdf-optimized .invoice-header {
          background: linear-gradient(to right, #1e3a8a, #1e40af) !important;
          color: white !important;
        }
        
        .pdf-optimized table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .pdf-optimized th,
        .pdf-optimized td {
          border: 1px solid #e5e7eb;
          padding: 8px;
          text-align: left;
        }
        
        .pdf-optimized th {
          background-color: #1e3a8a;
          color: white;
          font-weight: bold;
        }
      `}</style>
    </div>
  )
}
