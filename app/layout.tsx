import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import "./globals-layout-fix.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"
import PageVisitTracker from "@/components/page-visit-tracker"
import { I18nProvider } from "@/components/i18n-provider"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

export const metadata = {
  title: "Professional Invoice Generator - Biocure Health Care",
  description: "Create professional invoices with smart calculations and management features",
  generator: 'Next.js',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Biocure Invoices'
  },
  openGraph: {
    type: 'website',
    siteName: 'Biocure Health Care',
    title: 'Professional Invoice Generator',
    description: 'Create and manage professional invoices offline',
  }
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1e40af'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e40af" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Biocure Invoices" />
        <link rel="apple-touch-icon" href="/images/biocure-health-care-logo.jpg" />
        <link rel="icon" type="image/x-icon" href="/images/biocure-health-care-logo.ico" />
        <link rel="shortcut icon" href="/images/biocure-health-care-logo.ico" />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <AuthProvider>
            <PageVisitTracker />
            <I18nProvider>
              {children}
            </I18nProvider>
          </AuthProvider>
        </ThemeProvider>
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for (var reg of registrations) {
                    reg.unregister();
                  }
                });
                if ('caches' in window) {
                  caches.keys().then(function(names) {
                    for (var name of names) {
                      caches.delete(name);
                    }
                  });
                }
              } else {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('SW registered: ', registration);
                    })
                    .catch(function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    });
                });
              }
            }
          `
        }} />
      </body>
    </html>
  )
}
