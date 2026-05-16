import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'La Fafa',
  description: 'Organisation de séjours en famille ou entre amis.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
      </body>
    </html>
  )
}
