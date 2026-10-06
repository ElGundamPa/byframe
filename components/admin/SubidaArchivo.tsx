'use client'

import { useEffect, useRef, useState } from 'react'
import { tiposParaSubida, type TipoDeSubida } from '@/lib/admin/esquemas'
import { subirArchivo } from '@/lib/admin/subir-archivo'
import { Boton } from './ui'

export function SubidaArchivo({
  slug,
  tipo,
  etiqueta,
  ayuda,
  onSubido,
  onOcupado,
  disabled = false,
}: {
  slug: string
  tipo: TipoDeSubida
  etiqueta: string
  ayuda?: string
  onSubido: (ruta: string) => void
  onOcupado?: (ocupado: boolean) => void
  disabled?: boolean
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const controlador = useRef<AbortController | null>(null)
  const [progreso, setProgreso] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => () => controlador.current?.abort(), [])
  const subir = async (archivo: File) => {
    const abort = new AbortController()
    controlador.current = abort
    setError(null)
    setProgreso(0)
    onOcupado?.(true)
    try {
      onSubido(
        await subirArchivo(archivo, slug, tipo, abort.signal, setProgreso),
      )
    } catch (e) {
      if (!abort.signal.aborted)
        setError(
          e instanceof Error ? e.message : 'No se pudo subir el archivo.',
        )
    } finally {
      if (controlador.current === abort) {
        controlador.current = null
        setProgreso(null)
        onOcupado?.(false)
      }
    }
  }
  return (
    <div>
      <input
        ref={entrada}
        type="file"
        accept={tiposParaSubida(tipo).join(',')}
        className="sr-only"
        aria-label={etiqueta}
        disabled={disabled || progreso !== null}
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          if (archivo) void subir(archivo)
          e.target.value = ''
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Boton
          type="button"
          disabled={disabled || progreso !== null}
          onClick={() => entrada.current?.click()}
        >
          {etiqueta}
        </Boton>
        {progreso !== null ? (
          <>
            <span
              role="status"
              aria-live="polite"
              className="text-sm text-neutral-500"
            >
              Subiendo… {progreso}%
            </span>
            <Boton type="button" onClick={() => controlador.current?.abort()}>
              Cancelar subida
            </Boton>
          </>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : ayuda ? (
        <p className="mt-2 text-xs text-neutral-500">{ayuda}</p>
      ) : null}
    </div>
  )
}
