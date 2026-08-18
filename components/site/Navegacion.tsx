'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const ENLACES = [
  { href: '/#trabajo', texto: 'Trabajo' },
  { href: '/nosotros', texto: 'Nosotros' },
  { href: '/contacto', texto: 'Contacto' },
]

/**
 * Navegación fija: logo a la izquierda, enlaces a la derecha.
 *
 * En móvil, los enlaces se reemplazan por un botón que abre un menú a pantalla
 * completa. No es un cajón lateral ni un desplegable: en un teléfono, ocupar
 * toda la pantalla evita que el dedo caiga en el enlace de al lado y deja
 * espacio para objetivos táctiles grandes de verdad.
 */
export function Navegacion() {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const ruta = usePathname()

  // Al navegar, el menú se cierra solo. Sin esto, en una transición de cliente
  // la nueva página aparece detrás de un menú que sigue abierto.
  useEffect(() => {
    setMenuAbierto(false)
  }, [ruta])

  // Con el menú abierto, el fondo no debe desplazarse.
  useEffect(() => {
    if (!menuAbierto) return
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = anterior
    }
  }, [menuAbierto])

  // Escape cierra.
  useEffect(() => {
    if (!menuAbierto) return
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbierto(false)
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [menuAbierto])

  return (
    <>
      {/*
        Antes esto usaba mix-blend-difference. Es elegante sobre negro puro y
        falla sobre cualquier plano de gris medio: el texto invierte a un gris
        casi idéntico al fondo y desaparece. Sobre un videoclip lleno de luz de
        fiesta, ocurría cada dos fotogramas.

        En su lugar: blanco fijo, un velo degradado que oscurece la franja
        superior, y sombra en el texto. La navegación se lee sobre cualquier
        imagen sin ensuciar la portada.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-40 h-32 bg-gradient-to-b from-black/80 via-black/35 to-transparent"
      />

      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 py-5 [text-shadow:0_1px_10px_rgba(0,0,0,0.65)] sm:px-8">
        <Link
          href="/"
          aria-label="ByFrame, ir al inicio"
          className="-my-3 inline-flex min-h-11 items-center font-[family-name:var(--fuente-sans)] text-sm uppercase tracking-[0.35em] text-white"
        >
          ByFrame
        </Link>

        <nav aria-label="Principal" className="hidden sm:block">
          <ul className="flex items-center gap-8">
            {ENLACES.map((enlace) => (
              <li key={enlace.href}>
                <Link
                  href={enlace.href}
                  className="-my-3 inline-flex min-h-11 items-center font-[family-name:var(--fuente-sans)] text-[0.7rem] uppercase tracking-[0.25em] text-white transition-opacity hover:opacity-70"
                >
                  {enlace.texto}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => setMenuAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={menuAbierto}
          className="-mr-3 flex h-11 w-11 items-center justify-center sm:hidden"
        >
          <span className="relative block h-3 w-6">
            <span className="absolute inset-x-0 top-0 h-px bg-white" />
            <span className="absolute inset-x-0 bottom-0 h-px bg-white" />
          </span>
        </button>
      </header>

      <AnimatePresence>
        {menuAbierto ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed inset-0 z-[60] flex flex-col bg-black sm:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
          >
            <div className="flex items-center justify-between px-5 py-5">
              <span className="font-[family-name:var(--fuente-sans)] text-sm uppercase tracking-[0.35em] text-white">
                ByFrame
              </span>
              <button
                type="button"
                onClick={() => setMenuAbierto(false)}
                aria-label="Cerrar menú"
                autoFocus
                className="-mr-3 flex h-11 w-11 items-center justify-center text-white"
              >
                <span className="relative block h-6 w-6">
                  <span className="absolute left-0 top-1/2 h-px w-full rotate-45 bg-white" />
                  <span className="absolute left-0 top-1/2 h-px w-full -rotate-45 bg-white" />
                </span>
              </button>
            </div>

            <nav aria-label="Principal" className="flex flex-1 flex-col justify-center px-5">
              <ul className="space-y-2">
                {ENLACES.map((enlace, i) => (
                  <motion.li
                    key={enlace.href}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 * i, duration: 0.3 }}
                  >
                    <Link
                      href={enlace.href}
                      onClick={() => setMenuAbierto(false)}
                      className="block py-3 font-[family-name:var(--fuente-serif)] text-5xl text-white"
                    >
                      {enlace.texto}
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
