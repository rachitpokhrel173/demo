import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { AppShell } from "@/components/layout/app-shell"
import "./globals.css"

const inter = Inter({ variable: "--font-sans", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "ABC ERP — Stock, Billing & Manufacturing",
  description: "Inventory, billing, parties, purchase, manufacturing and accounting for Nepali businesses.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
