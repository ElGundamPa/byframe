import type { Metadata } from 'next'
import { Bodoni_Moda, Inter } from 'next/font/google'

import './globals.css'

/**
 * Tipografías del sitio.
 *
 * Bodoni Moda es una didona: trazo grueso y fino en máximo contraste, remates
 * finísimos. Es la letra de los títulos de proyecto. Inter, en mayúsculas y con
 * tracking amplio, sostiene la navegación y los rótulos.
 *
 * Se cargan con next/font, que las descarga en tiempo de compilación y las
 * sirve desde el propio dominio: cero peticiones a Google en tiempo de
 * ejecución y cero salto de texto al cargar.
 */
const serif = Bodoni_Moda({
  subsets: ['latin'],
  display: 'swap',
  variable: '--fuente-serif',
})

const sans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--fuente-sans',
})

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  ),
  title: {
    default: 'ByFrame — Productora audiovisual',
    template: '%s · ByFrame',
  },
  description: 'Portafolio de comerciales y piezas para redes.',
}

/**
 * El layout raíz no pinta colores: el sitio público y el panel tienen paletas
 * opuestas —negro absoluto uno, gris claro el otro— y cada uno fija la suya.
 * Cuando el color vivía aquí, los campos del login heredaban texto blanco sobre
 * fondo blanco y se escribía a ciegas.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${serif.variable} ${sans.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
