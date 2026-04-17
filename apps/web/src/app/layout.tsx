import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Coworker — AI for Founders',
  description: 'Your AI coworker. Manages tasks, remembers context, works on autopilot.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
