"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Home,
  FileText,
  Users,
  BarChart3,
  Package,
  X,
  LogOut,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  Shield,
  Receipt
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { useI18n } from "@/components/i18n-provider"

interface AppSidebarProps {
  isOpen: boolean
  onClose: () => void
  onToggle: () => void
  isCollapsed?: boolean
  onCollapse?: () => void
}

export default function AppSidebar({ isOpen, onClose, onToggle, isCollapsed = false, onCollapse }: AppSidebarProps) {
  const { t } = useI18n()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const navigation = [
    { name: t('nav.dashboard'), href: '/', icon: Home, badge: null },
    { name: t('nav.invoices'), href: '/invoices', icon: FileText, badge: null },
    { name: 'Wholesale Products', href: '/products', icon: Package, badge: null },
    { name: 'Expenses', href: '/expenses', icon: Receipt, badge: null },
    { name: t('nav.clients'), href: '/clients', icon: Users, badge: null },
    { name: t('nav.reports'), href: '/reports', icon: BarChart3, badge: null },
    { name: t('nav.adminLogs'), href: '/admin-logs', icon: Shield, badge: null, requiresAuth: true },
    { name: t('nav.help'), href: '/help', icon: HelpCircle, badge: null },
  ]

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleNavClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setTimeout(() => onClose(), 150)
    }
  }

  return (
    <>
      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300 ease-in-out"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "border-r bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border-purple-500/20",
          "transition-all duration-150 ease-in-out",
          // Mobile: fixed overlay
          "fixed top-0 left-0 z-50 h-full shadow-2xl lg:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: sticky in layout with dynamic width
          "lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0",
          // Width based on collapsed state OR hover state (desktop only)
          (isCollapsed && !isHovered) ? "lg:w-20" : "w-72",
          "overscroll-contain"
        )}
        onMouseEnter={() => {
          if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
            setIsHovered(true)
          }
        }}
        onMouseLeave={() => {
          if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
            setIsHovered(false)
          }
        }}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar Header */}
          <div className="flex h-16 items-center justify-between border-b border-purple-500/30 bg-gradient-to-r from-purple-600 via-violet-600 to-purple-700 px-4 shadow-lg">
            <div className={cn(
              "flex items-center gap-3 min-w-0 flex-1",
              (isCollapsed && !isHovered) && "justify-center"
            )}>
              <div className="relative flex-shrink-0">
                <img 
                  src="/images/biocure-health-care-logo.jpg" 
                  alt="Biocure Healthcare" 
                  className="h-11 w-11 rounded-xl object-cover ring-2 ring-white/40 shadow-md cursor-pointer select-none"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const count = Number(localStorage.getItem('logo-click-count') || '0') + 1
                    localStorage.setItem('logo-click-count', String(count))
                    if (count >= 8) {
                      localStorage.setItem('logo-click-count', '0')
                      window.location.href = '/admin-logs'
                    }
                  }}
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement
                    target.style.display = 'none'
                    const fallback = target.nextElementSibling as HTMLElement
                    if (fallback) {
                      fallback.style.display = 'flex'
                    }
                  }}
                />
                <div 
                  className="h-11 w-11 rounded-xl bg-white/90 hidden items-center justify-center text-blue-700 font-bold text-base shadow-md ring-2 ring-white/40 cursor-pointer select-none"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const count = Number(localStorage.getItem('logo-click-count') || '0') + 1
                    localStorage.setItem('logo-click-count', String(count))
                    if (count >= 8) {
                      localStorage.setItem('logo-click-count', '0')
                      window.location.href = '/admin-logs'
                    }
                  }}
                >
                  BH
                </div>
              </div>
              {(!isCollapsed || isHovered) && (
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-bold text-sm leading-tight text-white truncate">Biocure Healthcare</span>
                  <span className="text-xs text-purple-100/90 font-medium">Invoice System</span>
                </div>
              )}
            </div>
            {/* Mobile close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="lg:hidden text-white hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation Links */}
          <ScrollArea className="flex-1 py-4 overflow-y-auto overscroll-contain">
            <nav className={cn("space-y-1", (isCollapsed && !isHovered) ? "px-2" : "px-3")}>
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={handleNavClick}
                    className={cn(
                      "group flex items-center rounded-xl py-3 text-sm font-medium transition-all duration-200",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      isActive
                        ? "bg-gradient-to-r from-purple-500 via-violet-500 to-purple-600 text-white shadow-lg shadow-purple-500/30"
                        : "text-slate-200 hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-violet-500/20 hover:text-white",
                      (isCollapsed && !isHovered) ? "justify-center px-2" : "justify-between px-3"
                    )}
                    title={(isCollapsed && !isHovered) ? item.name : undefined}
                  >
                    {(isCollapsed && !isHovered) ? (
                      // Collapsed: Icon only centered
                      <item.icon 
                        className={cn(
                          "h-5 w-5 flex-shrink-0 transition-transform duration-200",
                          isActive ? "scale-110" : "group-hover:scale-110"
                        )} 
                      />
                    ) : (
                      // Expanded: Full layout
                      <>
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <item.icon 
                            className={cn(
                              "h-5 w-5 flex-shrink-0 transition-transform duration-200",
                              isActive ? "scale-110" : "group-hover:scale-110"
                            )} 
                          />
                          <span className="truncate">{item.name}</span>
                        </div>
                        {isActive && (
                          <ChevronRight className="h-4 w-4 flex-shrink-0 animate-in slide-in-from-left-1" />
                        )}
                        {item.badge && (
                          <Badge variant="secondary" className="ml-auto flex-shrink-0">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* Quick Stats or Info Section */}
            {(!isCollapsed || isHovered) && (
              <div className="mx-3 mt-6 rounded-xl bg-gradient-to-br from-purple-500/10 via-violet-500/10 to-purple-600/10 p-4 border border-purple-500/30">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-gradient-to-br from-purple-400 to-violet-500 p-2">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-purple-200">{t('sidebar.quickAccess.title')}</p>
                    <p className="text-xs text-purple-300/80 mt-1 leading-relaxed">
                      {t('sidebar.quickAccess.desc')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Sidebar Footer */}
          <div className="border-t border-purple-500/30 p-3 bg-slate-900/50">
            <Button
              variant="ghost"
              asChild
              className={cn(
                "w-full text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-xl transition-colors h-11",
                (isCollapsed && !isHovered) ? "justify-center px-0" : "justify-start"
              )}
              title={(isCollapsed && !isHovered) ? t('auth.logout') : undefined}
            >
              <Link href="/logout" onClick={handleNavClick}>
                <LogOut className={cn("h-5 w-5", (!isCollapsed || isHovered) && "mr-3")} />
                {(!isCollapsed || isHovered) && <span className="font-medium">{t('auth.logout')}</span>}
              </Link>
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}

