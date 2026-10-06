'use client'

import { useEffect, useRef, useState } from 'react'
import { prepararVideo } from '@/lib/admin/preparar-video'
import { subirArchivo } from '@/lib/admin/subir-archivo'
import { TAMANO_MAXIMO } from '@/lib/admin/esquemas'
import { Boton } from './ui'

export function SubidaVideo({
  slug,
  disabled,
  onOcupado,
  onSubido,
}: {
  slug: string
  disabled: boolean
  onOcupado: (ocupado: boolean) => void
  onSubido: (datos: {
    url: string
    poster?: string
    format: 'horizontal' | 'vertical'
    duration: number
    nombre: string
  }) => void
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const controlador = useRef<AbortController | null>(null)
  const [estado, setEstado] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => () => controlador.current?.abort(), [])
  const subir = async (archivo: File) => {
    if (archivo.size > TAMANO_MAXIMO || !archivo.size) {
      setError(
        'Elige un video de hasta 200 MB. Para uno más grande, usa su enlace de YouTube.',
      )
      return
    }
    if (
      (archivo.type && archivo.type !== 'video/mp4') ||
      !/\.mp4$/i.test(archivo.name)
    ) {
      setError('Selecciona un video MP4.')
      return
    }
    const abort = new AbortController()
    controlador.current = abort
    setError('')
    setOcupado(true)
    onOcupado(true)
    setEstado('Preparando el video…')
    try {
      const datos = await prepararVideo(archivo, abort.signal)
      const url = await subirArchivo(
        archivo,
        slug,
        'video',
        abort.signal,
        (n) => setEstado(`Subiendo video… ${n}%`),
      )
      let poster: string | undefined
      if (datos.miniatura) {
        setEstado('Preparando la imagen de portada…')
        try {
          poster = await subirArchivo(
            new File([datos.miniatura], 'miniatura.jpg', {
              type: 'image/jpeg',
            }),
            slug,
            'miniatura',
            abort.signal,
            () => {},
          )
        } catch {
          if (abort.signal.aborted)
            throw new DOMException('Cancelado', 'AbortError')
        }
      }
      abort.signal.throwIfAborted()
      onSubido({
        url,
        poster,
        format: datos.format,
        duration: datos.duration,
        nombre: archivo.name.replace(/\.mp4$/i, '').replace(/[_-]+/g, ' '),
      })
      setEstado(
        poster
          ? 'Video listo. Imagen de portada creada automáticamente.'
          : 'Video listo. Puedes añadir una imagen en Más detalles.',
      )
    } catch (e) {
      if (abort.signal.aborted)
        setEstado('Subida cancelada. Puedes elegir otro video.')
      else {
        setEstado('')
        setError(e instanceof Error ? e.message : 'No se pudo subir el video.')
      }
    } finally {
      controlador.current = null
      setOcupado(false)
      onOcupado(false)
    }
  }
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6">
      <input
        ref={entrada}
        type="file"
        accept="video/mp4,.mp4"
        className="sr-only"
        aria-label="Seleccionar video MP4"
        disabled={disabled || ocupado}
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          if (archivo) void subir(archivo)
          e.target.value = ''
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Boton
          type="button"
          disabled={disabled || ocupado}
          onClick={() => entrada.current?.click()}
        >
          Seleccionar video
        </Boton>
        {ocupado ? (
          <Boton type="button" onClick={() => controlador.current?.abort()}>
            Cancelar subida
          </Boton>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-neutral-500">
        MP4, hasta 200 MB. La imagen de portada y la duración se preparan
        automáticamente.
      </p>
      {estado ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 text-sm text-neutral-700"
        >
          {estado}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  )
}
