'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'

import { FichaProyecto } from './FichaProyecto'
import type { ProyectoPublico } from './tipos'

/**
 * Ficha del proyecto, a pantalla completa sobre el sitio.
 *
 * Se cierra con Esc, con el botón, tocando fuera y —en móvil— arrastrando hacia
 * abajo, que es el gesto que ya existe en las fichas de las apps nativas.
 */
export function ModalProyecto({
  proyecto,
  onCerrar,
}: {
  proyecto: ProyectoPublico | null
  onCerrar: () => void
}) {
  const cerrarRef = useRef<HTMLButtonElement>(null)
  const focoPrevioRef = useRef<HTMLElement | null>(null)

  // Esc cierra.
  useEffect(() => {
    if (!proyecto) return
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [proyecto, onCerrar])

  // El fondo no se desplaza mientras la ficha está abierta.
  useEffect(() => {
    if (!proyecto) return
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = anterior
    }
  }, [proyecto])

  // Gestión del foco: al abrir se lleva al botón de cerrar; al cerrar vuelve a
  // la tarjeta desde la que se abrió. Sin esto, quien navega por teclado queda
  // al principio del documento cada vez que cierra una ficha.
  useEffect(() => {
    if (proyecto) {
      focoPrevioRef.current = document.activeElement as HTMLElement | null
      cerrarRef.current?.focus()
    } else {
      focoPrevioRef.current?.focus()
    }
  }, [proyecto])

  return (
    <AnimatePresence>
      {proyecto ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-black"
          role="dialog"
          aria-modal="true"
          aria-label={proyecto.title}
        >
          <motion.div
            drag="y"
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_evento, info) => {
              // Cierra si el arrastre supera 140 px o si el gesto va rápido
              // hacia abajo. Solo con la distancia, un tirón corto y veloz
              // —que es como la gente cierra de verdad— no cerraría.
              if (info.offset.y > 140 || info.velocity.y > 700) onCerrar()
            }}
            className="min-h-[100dvh]"
          >
            <div className="sticky top-0 z-10 flex justify-end bg-gradient-to-b from-black to-transparent px-3 py-3 sm:px-5">
              <button
                ref={cerrarRef}
                type="button"
                onClick={onCerrar}
                aria-label="Cerrar"
                className="flex h-11 w-11 items-center justify-center text-white/80 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span className="relative block h-5 w-5">
                  <span className="absolute left-0 top-1/2 h-px w-full rotate-45 bg-current" />
                  <span className="absolute left-0 top-1/2 h-px w-full -rotate-45 bg-current" />
                </span>
              </button>
            </div>

            <div className="px-5 pb-20 sm:px-8">
              <FichaProyecto proyecto={proyecto} autoPlay tituloComo="h2" />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
