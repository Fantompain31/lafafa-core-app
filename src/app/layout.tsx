import type { Metadata } from 'next'
import './globals.css'
import TopBar from '@/shared/components/TopBar'
import '@/shared/components/TopBar.css'

export const metadata: Metadata = {
  title: 'La Fafa',
  description: 'Organisation de séjours en famille ou entre amis.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <TopBar />
        {children}
      </body>
    </html>
  )
}
