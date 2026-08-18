'use client'

import { useEffect, useState } from 'react'

/**
 * components/admin/ui.tsx
 *
 * Piezas compartidas del panel. Sobrias a propósito: aquí se trabaja, y lo que
 * importa es leer rápido y no equivocarse. La estética del sitio público no
 * entra en /admin.
 */

/* ── Campos ─────────────────────────────────────────────────────────────── */

export function Campo({
  etiqueta,
  error,
  ayuda,
  children,
  id,
}: {
  etiqueta: string
  error?: string
  ayuda?: string
  children: React.ReactNode
  id: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-700">
        {etiqueta}
      </label>
      {children}
      {ayuda && !error ? (
        <p className="mt-1 text-xs text-neutral-500">{ayuda}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export const claseEntrada =
  'mt-1 block h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-100'

export const claseArea =
  'mt-1 block w-full rounded-md border border-neutral-300 bg-white p-3 text-sm text-neutral-900 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10'

/* ── Botones ────────────────────────────────────────────────────────────── */

export function Boton({
  variante = 'secundario',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario' | 'peligro'
}) {
  const estilos = {
    primario: 'bg-neutral-900 text-white hover:opacity-90',
    secundario:
      'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
    peligro: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
  }[variante]

  return (
    <button
      {...props}
      className={`inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:opacity-50 ${estilos} ${className}`}
    />
  )
}

/* ── Avisos ─────────────────────────────────────────────────────────────── */

export type Estado =
  | { tipo: 'inactivo' }
  | { tipo: 'guardando' }
  | { tipo: 'exito'; mensaje: string }
  | { tipo: 'error'; mensaje: string }

export function AvisoEstado({ estado }: { estado: Estado }) {
  if (estado.tipo === 'inactivo') return null

  const estilos = {
    guardando: 'bg-neutral-100 text-neutral-700',
    exito: 'bg-green-50 text-green-800',
    error: 'bg-red-50 text-red-700',
  }[estado.tipo]

  const texto =
    estado.tipo === 'guardando' ? 'Guardando…' : estado.mensaje

  return (
    // aria-live para que un lector de pantalla anuncie el resultado sin que el
    // foco tenga que moverse hasta aquí.
    <p
      role="status"
      aria-live="polite"
      className={`rounded-md px-3 py-2 text-sm ${estilos}`}
    >
      {texto}
    </p>
  )
}

/* ── Confirmación de borrado ────────────────────────────────────────────── */

export function ConfirmarBorrado({
  nombre,
  onConfirmar,
  onCancelar,
}: {
  nombre: string
  onConfirmar: () => void
  onCancelar: () => void
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={`Confirmar eliminación de ${nombre}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-base font-semibold text-neutral-900">
          ¿Eliminar «{nombre}»?
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          Deja de verse en el sitio público de inmediato. No se borra de la base
          de datos: se puede restaurar desde la papelera.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Boton onClick={onCancelar}>Cancelar</Boton>
          <Boton variante="peligro" onClick={onConfirmar} autoFocus>
            Eliminar
          </Boton>
        </div>
      </div>
    </div>
  )
}

/* ── Aviso al salir con cambios sin guardar ─────────────────────────────── */

/**
 * Advierte antes de cerrar la pestaña o recargar con cambios pendientes.
 *
 * Los navegadores solo permiten el diálogo nativo, sin texto propio: se ignora
 * cualquier mensaje personalizado desde hace años. Y no cubre la navegación
 * interna de Next.js, que no dispara beforeunload; para eso, los formularios
 * confirman al pulsar un enlace de salida.
 */
export function useAvisoDeSalida(hayCambios: boolean) {
  useEffect(() => {
    if (!hayCambios) return

    const alSalir = (evento: BeforeUnloadEvent) => {
      evento.preventDefault()
      evento.returnValue = ''
    }

    window.addEventListener('beforeunload', alSalir)
    return () => window.removeEventListener('beforeunload', alSalir)
  }, [hayCambios])
}

/** Estado con marca de "sucio": útil para el aviso de salida. */
export function useFormulario<T>(inicial: T) {
  const [valores, setValores] = useState<T>(inicial)
  const [sucio, setSucio] = useState(false)

  const actualizar = (parcial: Partial<T>) => {
    setValores((previos) => ({ ...previos, ...parcial }))
    setSucio(true)
  }

  const reiniciar = (nuevos: T) => {
    setValores(nuevos)
    setSucio(false)
  }

  useAvisoDeSalida(sucio)

  return { valores, actualizar, reiniciar, sucio, setSucio }
}
