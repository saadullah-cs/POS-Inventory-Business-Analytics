"use client"

import { useState, useEffect } from "react"
import AppHeader from "./app-header"
import AppSidebar from "./app-sidebar"
import Footer from "./footer"
import { exportFullDatabaseState } from "@/lib/offline-storage"

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Load collapsed state from localStorage, default to true (collapsed/icon-only)
    const savedCollapsed = localStorage.getItem('sidebar-collapsed')
    if (savedCollapsed === null) {
      // First time load - default to collapsed (icon-only)
      setSidebarCollapsed(true)
      localStorage.setItem('sidebar-collapsed', 'true')
    } else if (savedCollapsed === 'true') {
      setSidebarCollapsed(true)
    }
  }, [])

  // Update body data attribute when sidebar state changes
  useEffect(() => {
    if (mounted) {
      document.body.setAttribute('data-sidebar', sidebarOpen ? 'open' : 'closed')
      document.body.setAttribute('data-sidebar-collapsed', sidebarCollapsed ? 'true' : 'false')
    }
  }, [sidebarOpen, sidebarCollapsed, mounted])

  // Automated Silent Background Cloud Sync Engine (triggers every 15 minutes / 900000 ms)
  useEffect(() => {
    const SYNC_INTERVAL_MS = 15 * 60 * 1000 // 900000 ms (15 minutes)

    const performSilentBackup = async () => {
      // Network guard: check connection before querying IndexedDB or fetching API
      if (typeof window !== "undefined" && navigator.onLine) {
        try {
          console.log("[Autonomous Cloud Sync] Initiating silent scheduled database backup...")
          const masterState = await exportFullDatabaseState()

          const response = await fetch("/api/backup", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(masterState),
          })

          const result = await response.json()

          if (!response.ok || !result.success) {
            console.warn("[Autonomous Cloud Sync] Background backup failed silently:", result?.error || response.statusText)
            return
          }

          console.log("[Autonomous Cloud Sync] Background backup completed successfully:", {
            fileName: result.fileName,
            fileId: result.fileId,
            timestamp: new Date().toISOString(),
          })
        } catch (error) {
          console.error("[Autonomous Cloud Sync] Error during silent background sync:", error)
        }
      } else {
        console.log("[Autonomous Cloud Sync] Device offline or window undefined. Skipping scheduled background backup.")
      }
    }

    const intervalId = setInterval(performSilentBackup, SYNC_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [])

  // Handle sidebar collapse/expand
  const handleCollapse = () => {
    const newCollapsed = !sidebarCollapsed
    setSidebarCollapsed(newCollapsed)
    localStorage.setItem('sidebar-collapsed', String(newCollapsed))
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Desktop Sidebar - always visible, can be collapsed to icons only */}
      <div className={`hidden lg:block ${sidebarCollapsed ? 'w-20' : 'w-72'} flex-shrink-0 transition-all duration-300`}>
        <AppSidebar 
          isOpen={true}
          onClose={() => setSidebarOpen(false)}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          isCollapsed={sidebarCollapsed}
          onCollapse={handleCollapse}
        />
      </div>
      
      {/* Mobile sidebar - overlay */}
      <div className="lg:hidden">
        <AppSidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          isCollapsed={false}
          onCollapse={handleCollapse}
        />
      </div>
      
      {/* Main content area - expands when sidebar is closed */}
      <div className="flex flex-1 flex-col min-h-screen w-full transition-all duration-300 ease-in-out relative">
        <AppHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        
        <main className="flex-1 bg-gray-50 relative">
          {children}
        </main>
        
        {/* Footer - dynamically positioned based on sidebar state */}
        <Footer />
      </div>
    </div>
  )
}

