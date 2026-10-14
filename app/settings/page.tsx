"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { 
  Settings, 
  Building2, 
  Palette, 
  Database, 
  Download, 
  Upload, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Save, 
  RotateCcw,
  Eye,
  EyeOff,
  FileText,
  Shield,
  Wifi,
  WifiOff,
  Clock,
  Bell,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Sun,
  Moon,
  CloudUpload,
  Loader2,
  HardDrive,
  CheckCircle2
} from "lucide-react"
import Link from "next/link"
import AuthGuard from "@/components/auth-guard"
import { useTheme } from "@/components/theme-provider"
import { exportFullDatabaseState } from "@/lib/offline-storage"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

interface AppSettings {
  // Company Information
  company: {
    name: string
    owner: string
    address: string
    phone1: string
    phone2: string
    email: string
    logo?: string
  }
  // User Preferences
  preferences: {
    theme: "light" | "dark" | "system"
    currency: string
    dateFormat: string
    autoSave: boolean
    autoBackup: boolean
    notifications: boolean
    soundEnabled: boolean
    compactMode: boolean
    showTutorials: boolean
  }
  // Invoice Settings
  invoice: {
    defaultTaxRate: number
    defaultPaymentTerms: number
    showEmailInPrint: boolean
    showPhoneInPrint: boolean
    invoicePrefix: string
    nextInvoiceNumber: number
    footerText: string
    showCompanyLogo: boolean
  }
  // Storage Settings
  storage: {
    autoCleanup: boolean
    maxStorageSize: number // in MB
    backupFrequency: "daily" | "weekly" | "monthly"
    exportFormat: "json" | "csv" | "both"
  }
  // Security Settings
  security: {
    sessionTimeout: number // in minutes
    requirePasswordOnStartup: boolean
    enableDataEncryption: boolean
    allowDataExport: boolean
    offlineMode: boolean
  }
}

const defaultSettings: AppSettings = {
  company: {
    name: "Biocure Health Care",
    owner: "Mushtaq Ahmad", 
    address: "Sheikh Maltoon",
    phone1: "0345-5167742",
    phone2: "",
    email: "biocurehealthcare1979@gmail.com",
  },
  preferences: {
    theme: "system",
    currency: "PKR",
    dateFormat: "DD/MM/YYYY",
    autoSave: true,
    autoBackup: false,
    notifications: true,
    soundEnabled: true,
    compactMode: false,
    showTutorials: true,
  },
  invoice: {
    defaultTaxRate: 0,
    defaultPaymentTerms: 30,
    showEmailInPrint: false,
    showPhoneInPrint: false,
    invoicePrefix: "INV",
    nextInvoiceNumber: 1,
    footerText: "Thank You for Your Business!",
    showCompanyLogo: true,
  },
  storage: {
    autoCleanup: false,
    maxStorageSize: 100,
    backupFrequency: "weekly",
    exportFormat: "json",
  },
  security: {
    sessionTimeout: 60,
    requirePasswordOnStartup: false,
    enableDataEncryption: false,
    allowDataExport: true,
    offlineMode: false,
  },
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const { toast } = useToast()
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 0 })
  const [showPasswords, setShowPasswords] = useState(false)
  const [lastBackup, setLastBackup] = useState<Date | null>(null)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [lastCloudBackup, setLastCloudBackup] = useState<string | null>(null)

  // Monitor online status
  useEffect(() => {
    const handleOnlineStatus = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', handleOnlineStatus)
    window.addEventListener('offline', handleOnlineStatus)
    return () => {
      window.removeEventListener('online', handleOnlineStatus)
      window.removeEventListener('offline', handleOnlineStatus)
    }

    // Try cloud load
    ;(async () => {
      const { isSupabaseConfigured } = await import("@/lib/supabase")
      if (!isSupabaseConfigured) return
      try {
        const { supabaseService } = await import("@/lib/supabase-service")
        const cloud = await supabaseService.loadCollection<AppSettings>("settings", "app")
        if (cloud) {
          setSettings({ ...defaultSettings, ...cloud })
        }
      } catch {}
    })()
  }, [])

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Load settings from localStorage and cloud (if available)
  useEffect(() => {
    const savedSettings = localStorage.getItem("app-settings")
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings({ ...defaultSettings, ...parsed })
      } catch (error) {
        console.error("Failed to parse settings:", error)
      }
    }

    // Load last backup date
    const lastBackupDate = localStorage.getItem("last-backup-date")
    if (lastBackupDate) {
      setLastBackup(new Date(lastBackupDate))
    }

    const cloudBackupDate = localStorage.getItem("last-google-drive-backup")
    if (cloudBackupDate) {
      setLastCloudBackup(new Date(cloudBackupDate).toLocaleString())
    }

    // Calculate storage usage
    calculateStorageUsage()
  }, [])

  // Auto-save settings
  useEffect(() => {
    if (hasUnsavedChanges) {
      const timeoutId = setTimeout(() => {
        saveSettings()
      }, 2000) // Auto-save after 2 seconds
      return () => clearTimeout(timeoutId)
    }
  }, [settings, hasUnsavedChanges])

  const calculateStorageUsage = () => {
    try {
      let totalSize = 0
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage.getItem(key)?.length || 0
        }
      }
      
      // Convert to MB (approximate)
      const usedMB = totalSize / (1024 * 1024)
      const totalMB = 5 // Most browsers allow ~5-10MB for localStorage
      
      setStorageUsage({ used: usedMB, total: totalMB })
    } catch (error) {
      console.error("Failed to calculate storage usage:", error)
    }
  }

  const saveSettings = () => {
    try {
      localStorage.setItem("app-settings", JSON.stringify(settings))
      
      // Set offline mode flag in localStorage if enabled
      if (settings.security.offlineMode) {
        localStorage.setItem("offlineMode", "true")
      } else {
        localStorage.removeItem("offlineMode")
      }
      
      setHasUnsavedChanges(false)
      calculateStorageUsage()
      
      // Broadcast settings update to all tabs/windows for real-time sync
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'app-settings',
        newValue: JSON.stringify(settings),
        storageArea: localStorage
      }))

      // Fire-and-forget cloud save
      ;(async () => {
        const { isSupabaseConfigured } = await import("@/lib/supabase")
        if (!isSupabaseConfigured) return
        try {
          const { supabaseService } = await import("@/lib/supabase-service")
          await supabaseService.saveCollection("settings", "app", settings)
        } catch (e) {
          console.warn('Cloud save (settings) failed:', e)
        }
      })()
    } catch (error) {
      console.error("Failed to save settings:", error)
    }
  }

  const resetSettings = () => {
    if (confirm("Are you sure you want to reset all settings to default? This action cannot be undone.")) {
      setSettings(defaultSettings)
      setHasUnsavedChanges(true)
    }
  }

  const exportData = () => {
    try {
      const data = {
        settings,
        invoices: JSON.parse(localStorage.getItem("saved-invoices") || "[]"),
        exportDate: new Date().toISOString(),
        version: "1.0.0"
      }
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `biocure-healthcare-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      // Update last backup date
      const now = new Date()
      setLastBackup(now)
      localStorage.setItem("last-backup-date", now.toISOString())
      
    } catch (error) {
      console.error("Failed to export data:", error)
    }
  }

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        
        if (data.settings) {
          setSettings({ ...defaultSettings, ...data.settings })
          setHasUnsavedChanges(true)
        }
        
        if (data.invoices) {
          localStorage.setItem("saved-invoices", JSON.stringify(data.invoices))
        }
        
        calculateStorageUsage()
      } catch (error) {
        console.error("Failed to import data:", error)
      }
    }
    reader.readAsText(file)
  }

  const clearAllData = () => {
    if (confirm("Are you sure you want to clear ALL application data? This will delete all invoices and settings. This action cannot be undone.")) {
      localStorage.clear()
      setSettings(defaultSettings)
      setHasUnsavedChanges(false)
      calculateStorageUsage()
    }
  }

  const handleGoogleDriveBackup = async () => {
    if (isBackingUp) return
    setIsBackingUp(true)

    try {
      // Retrieve master state from all IndexedDB stores & persistent cache
      const masterState = await exportFullDatabaseState()

      // POST to /api/backup Google Drive service account endpoint
      const response = await fetch("/api/backup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(masterState),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to upload database backup to Google Drive")
      }

      const now = new Date()
      setLastBackup(now)
      setLastCloudBackup(now.toLocaleString())
      localStorage.setItem("last-backup-date", now.toISOString())
      localStorage.setItem("last-google-drive-backup", now.toISOString())

      toast({
        title: "Backup Uploaded Successfully",
        description: `Full database state saved to Google Drive (${result.fileName || "biocure-backup.json"}). File ID: ${result.fileId}`,
      })
    } catch (error: any) {
      console.error("Google Drive Backup Error:", error)
      toast({
        title: "Backup Failed",
        description: error.message || "Failed to upload database backup to Google Drive.",
        variant: "destructive",
      })
    } finally {
      setIsBackingUp(false)
    }
  }

  const updateSetting = (path: string, value: any) => {
    const keys = path.split('.')
    const newSettings = JSON.parse(JSON.stringify(settings))
    
    let current = newSettings
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]]
    }
    current[keys[keys.length - 1]] = value
    
    setSettings(newSettings)
    setHasUnsavedChanges(true)
  }

  const formatDateTime = (date: Date) => {
    return {
      time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      date: date.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    }
  }

  const { time, date } = formatDateTime(currentTime)

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                <Link href="/" className="bg-white p-2 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
                  <img src="/images/biocure-health-care-logo.jpg" alt="Biocure Healthcare Logo" className="h-8 w-auto" />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Settings</h1>
                    <div className="flex items-center gap-2 flex-wrap">
                      {isOnline ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                          <Wifi className="w-3 h-3 mr-1" />
                          Online
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                          <WifiOff className="w-3 h-3 mr-1" />
                          Offline
                        </Badge>
                      )}
                      {hasUnsavedChanges && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                          <Clock className="w-3 h-3 mr-1" />
                          Unsaved
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-blue-100 text-xs sm:text-sm">Manage your application preferences</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-left sm:text-right text-blue-100">
                  <div className="text-base sm:text-lg font-bold font-mono">{time}</div>
                  <div className="text-xs">{date}</div>
                </div>
                <Link href="/">
                  <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Back to Invoice</span>
                    <span className="sm:hidden">Back</span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Content */}
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Quick Actions Sidebar */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    onClick={saveSettings} 
                    className="w-full"
                    disabled={!hasUnsavedChanges}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>

                  <Button 
                    onClick={handleGoogleDriveBackup} 
                    variant="outline" 
                    className="w-full bg-blue-50/70 hover:bg-blue-100/70 dark:bg-blue-950/30 dark:hover:bg-blue-900/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-medium transition-all"
                    disabled={isBackingUp}
                  >
                    {isBackingUp ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin text-blue-600" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <CloudUpload className="w-4 h-4 mr-2 text-blue-600" />
                        Backup to Google Drive
                      </>
                    )}
                  </Button>
                  
                  <Button onClick={exportData} variant="outline" className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Export Data
                  </Button>
                  
                  <div className="relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={importData}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Button variant="outline" className="w-full">
                      <Upload className="w-4 h-4 mr-2" />
                      Import Data
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Storage Usage</p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${Math.min((storageUsage.used / storageUsage.total) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {storageUsage.used.toFixed(2)} MB of {storageUsage.total} MB used
                    </p>
                  </div>
                  
                  {lastBackup && (
                    <div className="text-xs text-muted-foreground">
                      <p>Last local backup:</p>
                      <p>{lastBackup.toLocaleDateString()}</p>
                    </div>
                  )}

                  {lastCloudBackup && (
                    <div className="text-xs text-muted-foreground">
                      <p>Last Google Drive backup:</p>
                      <p>{lastCloudBackup}</p>
                    </div>
                  )}
                  
                  <Separator />
                  
                  <Button onClick={resetSettings} variant="destructive" className="w-full">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset to Defaults
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Main Settings */}
            <div className="lg:col-span-3">
              <Tabs defaultValue="company" className="space-y-6">
                <TabsList className="grid w-full grid-cols-5 gap-1">
                  <TabsTrigger value="company" className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1 p-2 sm:p-3">
                    <Building2 className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs sm:text-sm">Company</span>
                  </TabsTrigger>
                  <TabsTrigger value="preferences" className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1 p-2 sm:p-3">
                    <Palette className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs sm:text-sm hidden xs:inline">Prefs</span>
                    <span className="text-xs sm:text-sm xs:hidden">P</span>
                  </TabsTrigger>
                  <TabsTrigger value="invoice" className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1 p-2 sm:p-3">
                    <FileText className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs sm:text-sm">Invoice</span>
                  </TabsTrigger>
                  <TabsTrigger value="storage" className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1 p-2 sm:p-3">
                    <Database className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs sm:text-sm hidden xs:inline">Storage</span>
                    <span className="text-xs sm:text-sm xs:hidden">S</span>
                  </TabsTrigger>
                  <TabsTrigger value="security" className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1 p-2 sm:p-3">
                    <Shield className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs sm:text-sm hidden xs:inline">Security</span>
                    <span className="text-xs sm:text-sm xs:hidden">Sec</span>
                  </TabsTrigger>
                </TabsList>

                {/* Company Settings */}
                <TabsContent value="company">
                  <Card>
                    <CardHeader>
                      <CardTitle>Company Information</CardTitle>
                      <CardDescription>
                        Update your company details that appear on invoices
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="company-name">Company Name</Label>
                          <Input
                            id="company-name"
                            value={settings.company.name}
                            onChange={(e) => updateSetting('company.name', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="owner-name">Owner Name</Label>
                          <Input
                            id="owner-name"
                            value={settings.company.owner}
                            onChange={(e) => updateSetting('company.owner', e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="company-address">Address</Label>
                        <Input
                          id="company-address"
                          value={settings.company.address}
                          onChange={(e) => updateSetting('company.address', e.target.value)}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="phone1">Primary Phone</Label>
                          <Input
                            id="phone1"
                            value={settings.company.phone1}
                            onChange={(e) => updateSetting('company.phone1', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="phone2">Secondary Phone</Label>
                          <Input
                            id="phone2"
                            value={settings.company.phone2}
                            onChange={(e) => updateSetting('company.phone2', e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="company-email">Email</Label>
                        <Input
                          id="company-email"
                          type="email"
                          value={settings.company.email}
                          onChange={(e) => updateSetting('company.email', e.target.value)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Preferences Settings */}
                <TabsContent value="preferences">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Palette className="w-5 h-5 text-purple-600" />
                        Appearance & Theme Preferences
                      </CardTitle>
                      <CardDescription>
                        Customize the visual appearance of the application. Default theme is set to Light mode.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <Label className="text-base font-semibold">Color Mode / Theme</Label>
                        <p className="text-xs text-muted-foreground">
                          Choose between Light mode (default) and Dark mode.
                        </p>
                        
                        <div className="grid grid-cols-2 gap-4 max-w-md pt-2">
                          {/* Light Mode Button */}
                          <div 
                            onClick={() => {
                              setTheme("light")
                              updateSetting('preferences.theme', 'light')
                            }}
                            className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-3 transition-all ${
                              theme === 'light' 
                                ? 'border-purple-600 bg-purple-50/50 shadow-md' 
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <div className={`p-3 rounded-full ${theme === 'light' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                              <Sun className="w-6 h-6" />
                            </div>
                            <div className="text-center">
                              <p className="font-semibold text-sm">Light Mode</p>
                              <p className="text-[11px] text-muted-foreground">Clean & bright UI (Default)</p>
                            </div>
                            {theme === 'light' && (
                              <Badge className="bg-purple-600 text-white text-[10px]">Active</Badge>
                            )}
                          </div>

                          {/* Dark Mode Button */}
                          <div 
                            onClick={() => {
                              setTheme("dark")
                              updateSetting('preferences.theme', 'dark')
                            }}
                            className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-3 transition-all ${
                              theme === 'dark' 
                                ? 'border-purple-600 bg-slate-900 text-white shadow-md' 
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <div className={`p-3 rounded-full ${theme === 'dark' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                              <Moon className="w-6 h-6" />
                            </div>
                            <div className="text-center">
                              <p className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Dark Mode</p>
                              <p className={`text-[11px] ${theme === 'dark' ? 'text-slate-400' : 'text-muted-foreground'}`}>Sleek & high-contrast UI</p>
                            </div>
                            {theme === 'dark' && (
                              <Badge className="bg-purple-600 text-white text-[10px]">Active</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <Label className="text-base font-semibold">General Preferences</Label>
                        <div className="space-y-3 max-w-md">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="auto-save">Auto Save Invoices</Label>
                            <Switch
                              id="auto-save"
                              checked={settings.preferences.autoSave}
                              onCheckedChange={(checked) => updateSetting('preferences.autoSave', checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="compact-mode">Compact Mode</Label>
                            <Switch
                              id="compact-mode"
                              checked={settings.preferences.compactMode}
                              onCheckedChange={(checked) => updateSetting('preferences.compactMode', checked)}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Invoice Settings */}
                <TabsContent value="invoice">
                  <Card>
                    <CardHeader>
                      <CardTitle>Invoice Settings</CardTitle>
                      <CardDescription>
                        Configure default invoice behavior and appearance
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="tax-rate">Default Tax Rate (%)</Label>
                            <Input
                              id="tax-rate"
                              type="number"
                              step="0.1"
                              value={settings.invoice.defaultTaxRate}
                              onChange={(e) => updateSetting('invoice.defaultTaxRate', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="payment-terms">Default Payment Terms (days)</Label>
                            <Input
                              id="payment-terms"
                              type="number"
                              value={settings.invoice.defaultPaymentTerms}
                              onChange={(e) => updateSetting('invoice.defaultPaymentTerms', parseInt(e.target.value) || 30)}
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="invoice-prefix">Invoice Number Prefix</Label>
                            <Input
                              id="invoice-prefix"
                              value={settings.invoice.invoicePrefix}
                              onChange={(e) => updateSetting('invoice.invoicePrefix', e.target.value)}
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="next-number">Next Invoice Number</Label>
                            <Input
                              id="next-number"
                              type="number"
                              value={settings.invoice.nextInvoiceNumber}
                              onChange={(e) => updateSetting('invoice.nextInvoiceNumber', parseInt(e.target.value) || 1)}
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="space-y-3">
                            <Label>Print Options</Label>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="show-email">Show Email in Print</Label>
                              <Switch
                                id="show-email"
                                checked={settings.invoice.showEmailInPrint}
                                onCheckedChange={(checked) => updateSetting('invoice.showEmailInPrint', checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="show-phone">Show Phone in Print</Label>
                              <Switch
                                id="show-phone"
                                checked={settings.invoice.showPhoneInPrint}
                                onCheckedChange={(checked) => updateSetting('invoice.showPhoneInPrint', checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="show-logo">Show Company Logo</Label>
                              <Switch
                                id="show-logo"
                                checked={settings.invoice.showCompanyLogo}
                                onCheckedChange={(checked) => updateSetting('invoice.showCompanyLogo', checked)}
                              />
                            </div>
                          </div>
                          
                          <div>
                            <Label htmlFor="footer-text">Footer Text</Label>
                            <Input
                              id="footer-text"
                              value={settings.invoice.footerText}
                              onChange={(e) => updateSetting('invoice.footerText', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Data & Storage Settings */}
                <TabsContent value="storage">
                  <div className="space-y-6">
                    {/* Google Drive Cloud Backup Card */}
                    <Card>
                      <CardHeader>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <CloudUpload className="w-5 h-5 text-blue-600" />
                              Google Drive Cloud Backup
                            </CardTitle>
                            <CardDescription>
                              Upload your complete offline database (invoices, customers, products, settings) directly to Google Drive
                            </CardDescription>
                          </div>
                          <Badge variant="outline" className="w-fit bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                            Service Account Ready
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-4 rounded-lg border bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-900 dark:to-slate-800/80 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                                <Database className="w-4 h-4 text-blue-600" />
                                Master Database Snapshot
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Asynchronously queries all IndexedDB stores (`invoices`, `customers`, `settings`, `syncQueue`) and bundles them into a timestamped JSON backup.
                              </p>
                            </div>
                            <Button
                              onClick={handleGoogleDriveBackup}
                              disabled={isBackingUp}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-medium shrink-0 shadow-sm"
                            >
                              {isBackingUp ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <CloudUpload className="w-4 h-4 mr-2" />
                                  Backup to Google Drive
                                </>
                              )}
                            </Button>
                          </div>

                          {lastCloudBackup && (
                            <div className="pt-2 border-t text-xs text-muted-foreground flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                              Last Google Drive backup: <span className="font-medium text-foreground">{lastCloudBackup}</span>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="p-3 border rounded-lg bg-card space-y-1">
                            <span className="text-xs font-semibold text-muted-foreground">Destination Folder</span>
                            <p className="text-xs font-mono text-foreground truncate">Google Drive Service Account Vault</p>
                          </div>
                          <div className="p-3 border rounded-lg bg-card space-y-1">
                            <span className="text-xs font-semibold text-muted-foreground">Storage Engine</span>
                            <p className="text-xs text-foreground">IndexedDB (`BiocureHealthcareDB`) + LocalStorage</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Local Storage & Manual Data Controls */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <HardDrive className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                          Local Storage & Data Management
                        </CardTitle>
                        <CardDescription>
                          Manage local browser quota, download manual JSON backups, or restore previous data
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">Browser Storage Usage</span>
                            <span className="text-muted-foreground">{storageUsage.used.toFixed(2)} MB of {storageUsage.total} MB</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                            <div
                              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min((storageUsage.used / storageUsage.total) * 100, 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                          <Button onClick={exportData} variant="outline" className="flex-1">
                            <Download className="w-4 h-4 mr-2" />
                            Download JSON File
                          </Button>
                          <div className="relative flex-1">
                            <input
                              type="file"
                              accept=".json"
                              onChange={importData}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <Button variant="outline" className="w-full">
                              <Upload className="w-4 h-4 mr-2" />
                              Restore from File
                            </Button>
                          </div>
                          <Button onClick={clearAllData} variant="destructive" className="flex-1">
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Clear Local Storage
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Security Settings */}
                <TabsContent value="security">
                  <Card>
                    <CardHeader>
                      <CardTitle>Security & Access</CardTitle>
                      <CardDescription>
                        Manage security settings and access controls
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                            <Input
                              id="session-timeout"
                              type="number"
                              min="5"
                              max="480"
                              value={settings.security.sessionTimeout}
                              onChange={(e) => updateSetting('security.sessionTimeout', parseInt(e.target.value) || 60)}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Automatically log out after this period of inactivity
                            </p>
                          </div>
                          
                          <div className="space-y-3">
                            <Label>Access Control</Label>
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <Label htmlFor="require-password">Require Password on Startup</Label>
                                <p className="text-xs text-muted-foreground">
                                  Require authentication every time the app starts
                                </p>
                              </div>
                              <Switch
                                id="require-password"
                                checked={settings.security.requirePasswordOnStartup}
                                onCheckedChange={(checked) => updateSetting('security.requirePasswordOnStartup', checked)}
                              />
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <Label htmlFor="offline-mode" className="flex items-center gap-2">
                                  {settings.security.offlineMode ? (
                                    <WifiOff className="w-4 h-4 text-orange-600" />
                                  ) : (
                                    <Wifi className="w-4 h-4 text-green-600" />
                                  )}
                                  Offline Mode
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  Allow app usage without login when offline
                                </p>
                              </div>
                              <Switch
                                id="offline-mode"
                                checked={settings.security.offlineMode}
                                onCheckedChange={(checked) => updateSetting('security.offlineMode', checked)}
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="space-y-3">
                            <Label>Data Protection</Label>
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <Label htmlFor="enable-encryption">Enable Data Encryption</Label>
                                <p className="text-xs text-muted-foreground">
                                  Encrypt sensitive data stored locally
                                </p>
                              </div>
                              <Switch
                                id="enable-encryption"
                                checked={settings.security.enableDataEncryption}
                                onCheckedChange={(checked) => updateSetting('security.enableDataEncryption', checked)}
                              />
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <Label htmlFor="allow-export">Allow Data Export</Label>
                                <p className="text-xs text-muted-foreground">
                                  Enable backup and export functionality
                                </p>
                              </div>
                              <Switch
                                id="allow-export"
                                checked={settings.security.allowDataExport}
                                onCheckedChange={(checked) => updateSetting('security.allowDataExport', checked)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                        <div className="flex items-start gap-3">
                          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                              Security Notice
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                              Offline mode allows full access to the application without authentication. 
                              Only enable this if you're using the app on a trusted, personal device.
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
      <Toaster />
    </AuthGuard>
  )
}
