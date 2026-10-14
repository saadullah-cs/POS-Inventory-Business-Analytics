"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Printer, X, Share2, Settings, FileText, Download, Upload, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { exportFullDatabaseState, importFullDatabaseState } from "@/lib/offline-storage"

interface MobileActionMenuProps {
  onPrint: () => void
  onWhatsAppShare?: () => void
  onWordDownload?: () => void
}

export default function MobileActionMenu({ onPrint, onWhatsAppShare, onWordDownload }: MobileActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleDownloadDatabaseBackup = async () => {
    if (isDownloading) return
    setIsDownloading(true)

    // Trigger initial toast notification
    toast({
      title: "Generating Database Backup",
      description: "Compiling full offline database ledger into JSON...",
    })

    try {
      // 1. Await exportFullDatabaseState() to capture the entire offline IndexedDB ledger
      const data = await exportFullDatabaseState()

      // 2. Stringify the resulting data
      const jsonString = JSON.stringify(data, null, 2)

      // 3. Create a Blob
      const blob = new Blob([jsonString], { type: "application/json" })

      // 4. Generate timestamped filename (biocure-backup-YYYY-MM-DD.json)
      const dateStr = new Date().toISOString().split("T")[0]
      const fileName = `biocure-backup-${dateStr}.json`

      // 5. Create temporary <a> element and trigger programmatic download
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      // 6. Success toast notification
      toast({
        title: "Backup Downloaded Successfully",
        description: `Saved ${fileName} (${(blob.size / 1024).toFixed(1)} KB) to your device.`,
      })
      setIsOpen(false)
    } catch (error: any) {
      console.error("Database Backup Download Error:", error)
      toast({
        title: "Backup Download Failed",
        description: error.message || "Failed to generate database backup file.",
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsRestoring(true)
    toast({
      title: "Restoring Database",
      description: "Reading backup file and restoring offline stores...",
    })

    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        if (!text || text.trim().length === 0) {
          throw new Error("Selected backup file is empty.")
        }

        const parsedJSON = JSON.parse(text)

        await importFullDatabaseState(parsedJSON)

        toast({
          title: "Database Restored Successfully",
          description: "All records updated. Reloading application...",
        })

        // Crucially, reload the window so the UI refreshes with the newly restored data
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } catch (error: any) {
        console.error("Database restore error:", error)
        toast({
          title: "Database Restore Failed",
          description: error.message || "Invalid or corrupt backup file.",
          variant: "destructive",
        })
        setIsRestoring(false)
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    }

    reader.onerror = () => {
      toast({
        title: "File Read Error",
        description: "Could not read the selected backup file.",
        variant: "destructive",
      })
      setIsRestoring(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }

    reader.readAsText(file)
  }

  return (
    <>
      {/* Hidden file input for database restore */}
      <input
        type="file"
        accept=".json"
        ref={fileInputRef}
        className="hidden"
        onChange={handleRestore}
      />

      {/* Click-away overlay: closes the menu when clicking on background */}
      {isOpen && (
        <div
          className="fixed inset-0 z-10 print:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Action Menu Button - Enhanced for all screen sizes - Bottom Left - Fixed relative to content */}
      <div className="mobile-action-menu fixed bottom-4 left-4 z-20 print:hidden transition-all duration-300 ease-in-out">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-full w-14 h-14 bg-blue-600/60 hover:bg-blue-700/70 shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 backdrop-blur-sm border border-white/20"
          aria-label="Open action menu"
        >
          {isOpen ? <X className="w-6 h-6 text-white/80" /> : <Settings className="w-6 h-6 text-white/80" />}
        </Button>

        {/* Action Menu - Enhanced layout for all devices */}
        {isOpen && (
          <div className="absolute bottom-16 left-0 bg-background border rounded-xl shadow-2xl p-3 min-w-[260px] max-w-[320px] animate-in slide-in-from-bottom-2 duration-200">
            <div className="space-y-2">
              <div className="text-center pb-2 border-b border-border">
                <h3 className="font-semibold text-sm text-foreground">Quick Actions</h3>
              </div>
              {onWhatsAppShare && (
                <Button
                  onClick={() => {
                    onWhatsAppShare()
                    setIsOpen(false)
                  }}
                  variant="ghost"
                  className="w-full justify-start gap-3 h-12 text-left hover:bg-green-50"
                >
                  <Share2 className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="font-medium">Share on WhatsApp</div>
                    <div className="text-xs text-muted-foreground">Send invoice details</div>
                  </div>
                </Button>
              )}

              <Button
                onClick={() => {
                  onPrint()
                  setIsOpen(false)
                }}
                variant="ghost"
                className="w-full justify-start gap-3 h-12 text-left hover:bg-blue-50 border border-blue-200"
              >
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Printer className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-blue-700">Print Invoice</div>
                  <div className="text-xs text-muted-foreground">Print or save as PDF</div>
                </div>
              </Button>

              {onWordDownload && (
                <Button
                  onClick={() => {
                    onWordDownload()
                    setIsOpen(false)
                  }}
                  variant="ghost"
                  className="w-full justify-start gap-3 h-12 text-left hover:bg-emerald-50 border border-emerald-200"
                >
                  <div className="bg-emerald-100 p-2 rounded-lg">
                    <FileText className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="font-medium text-emerald-700">Download Word</div>
                    <div className="text-xs text-muted-foreground">Save as .docx</div>
                  </div>
                </Button>
              )}

              <div className="pt-2 border-t border-border space-y-2">
                <Button
                  onClick={handleDownloadDatabaseBackup}
                  disabled={isDownloading || isRestoring}
                  variant="ghost"
                  className="w-full justify-start gap-3 h-12 text-left hover:bg-sky-50 dark:hover:bg-sky-950 border border-sky-200 dark:border-sky-800"
                >
                  <div className="bg-sky-100 dark:bg-sky-900 p-2 rounded-lg">
                    {isDownloading ? (
                      <Loader2 className="w-5 h-5 text-sky-600 dark:text-sky-400 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-sky-700 dark:text-sky-300">
                      {isDownloading ? "Generating..." : "Download Database Backup"}
                    </div>
                    <div className="text-xs text-muted-foreground">Save offline JSON ledger</div>
                  </div>
                </Button>

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isDownloading || isRestoring}
                  variant="ghost"
                  className="w-full justify-start gap-3 h-12 text-left hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-indigo-200 dark:border-indigo-800"
                >
                  <div className="bg-indigo-100 dark:bg-indigo-900 p-2 rounded-lg">
                    {isRestoring ? (
                      <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-indigo-700 dark:text-indigo-300">
                      {isRestoring ? "Restoring..." : "Restore Database Backup"}
                    </div>
                    <div className="text-xs text-muted-foreground">Load offline JSON ledger</div>
                  </div>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
