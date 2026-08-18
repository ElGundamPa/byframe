import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { cerrarSesion } from '@/app/admin/login/actions'
import { getUsuarioActual } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Panel · ByFrame',
  robots: { index: false, follow: false },
}

/** El panel siempre refleja el estado actual de la base: nada de caché. */
export const dynamic = 'force-dynamic'

const SECCIONES = [
  { href: '/admin', texto: 'Resumen' },
  { href: '/admin/orden', texto: 'Orden' },
  { href: '/admin/home', texto: 'Portada' },
  { href: '/admin/equipo', texto: 'Equipo' },
  { href: '/admin/ajustes', texto: 'Ajustes' },
]

/**
 * Envoltorio de las pantallas autenticadas.
 *
 * Va en un grupo de rutas —la carpeta (panel)— para que /admin/login quede
 * fuera: si compartieran layout, la pantalla de acceso mostraría la navegación
 * del panel y un botón de cerrar sesión a quien todavía no ha entrado.
 */
export default async function LayoutPanel({
  children,
}: {
  children: React.ReactNode
}) {
  const usuario = await getUsuarioActual()

  // El middleware ya redirige, pero esta es la segunda cerradura: si algún día
  // alguien toca el matcher, estas páginas no quedan abiertas.
  if (!usuario) redirect('/admin/login')

  return (
    <div className="min-h-dvh">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="text-sm font-semibold tracking-tight text-neutral-900"
            >
              ByFrame
            </Link>
            <nav aria-label="Secciones del panel">
              <ul className="flex flex-wrap items-center gap-1">
                {SECCIONES.map((seccion) => (
                  <li key={seccion.href}>
                    <Link
                      href={seccion.href}
                      className="inline-flex h-11 items-center rounded-md px-3 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                    >
                      {seccion.texto}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center text-sm text-neutral-500 underline-offset-4 hover:underline"
            >
              Ver el sitio
            </a>
            <span className="hidden text-xs text-neutral-400 sm:inline">
              {usuario.email}
            </span>
            <form action={cerrarSesion}>
              <button
                type="submit"
                className="inline-flex h-11 items-center rounded-md border border-neutral-300 px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  )
}
