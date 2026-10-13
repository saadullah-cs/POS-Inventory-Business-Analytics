"use client"

import AuthGuard from "@/components/auth-guard"
import ProfessionalInvoice from "@/components/professional-invoice"

export default function Home() {
  return (
    <AuthGuard>
      <ProfessionalInvoice />
    </AuthGuard>
  )
}
