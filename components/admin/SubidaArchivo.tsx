'use client'

import { useRef, useState } from 'react'

import { TAMANO_MAXIMO, TIPOS_PERMITIDOS } from '@/lib/admin/esquemas'
import { Boton } from './ui'

/**
 * Subida directa a R2 con URL prefirmada.
 *
 * El archivo va del navegador a R2 sin pasar por el servidor: este solo firma.
 *
 * Detalle que evita el fallo más común (F5 de SETUP.md): la URL se pide **en el
 * momento del envío**, no al montar el componente. Las firmas caducan en diez
 * minutos, y entre abrir el formulario y soltar el archivo puede pasar media
 * hora.
 *
 * Se usa XMLHttpRequest y no fetch porque fetch todavía no informa del progreso
 * de subida en ningún navegador. Sin progreso real, un loop de 20 MB parece
 * colgado.
 */
export function SubidaArchivo({
  slug,
  tipo,
  etiqueta,
  ayuda,
  onSubido,
}: {
  slug: string
  tipo: 'poster' | 'loop' | 'equipo' | 'sitio'
  etiqueta: string
  ayuda?: string
  onSubido: (rutaPublica: string) => void
}) {
  const entradaRef = useRef<HTMLInputElement>(null)
  const peticionRef = useRef<XMLHttpRequest | null>(null)
  const [progreso, setProgreso] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cancelar = () => {
    peticionRef.current?.abort()
    peticionRef.current = null
    setProgreso(null)
  }

  const subir = async (archivo: File) => {
    setError(null)

    if (archivo.size > TAMANO_MAXIMO) {
      setError(
        `El archivo pesa ${(archivo.size / 1024 / 1024).toFixed(0)} MB y el máximo son ${TAMANO_MAXIMO / 1024 / 1024} MB. Los masters van por el script, no por aquí.`,
      )
      return
    }

    if (!TIPOS_PERMITIDOS.includes(archivo.type as (typeof TIPOS_PERMITIDOS)[number])) {
      setError(`Tipo no admitido: ${archivo.type || 'desconocido'}.`)
      return
    }

    if (!slug) {
      setError('Escribe primero el slug del proyecto: define la carpeta de destino.')
      return
    }

    setProgreso(0)

    let firma: { url: string; rutaPublica: string; contentType: string }
    try {
      const respuesta = await fetch('/api/admin/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug,
          tipo,
          nombreArchivo: archivo.name,
          contentType: archivo.type,
          tamano: archivo.size,
        }),
      })

      const cuerpo = await respuesta.json()
      if (!respuesta.ok) throw new Error(cuerpo.error ?? 'No se pudo firmar la subida.')
      firma = cuerpo
    } catch (e) {
      setProgreso(null)
      setError(e instanceof Error ? e.message : 'No se pudo firmar la subida.')
      return
    }

    await new Promise<void>((resolver) => {
      const peticion = new XMLHttpRequest()
      peticionRef.current = peticion

      peticion.open('PUT', firma.url, true)
      // Debe coincidir EXACTAMENTE con el Content-Type que se firmó, o R2
      // devuelve SignatureDoesNotMatch.
      peticion.setRequestHeader('Content-Type', firma.contentType)

      peticion.upload.onprogress = (evento) => {
        if (evento.lengthComputable) {
          setProgreso(Math.round((evento.loaded / evento.total) * 100))
        }
      }

      peticion.onload = () => {
        if (peticion.status >= 200 && peticion.status < 300) {
          setProgreso(null)
          onSubido(firma.rutaPublica)
        } else {
          setProgreso(null)
          setError(
            peticion.status === 403
              ? 'R2 rechazó la subida (403). La firma pudo caducar: vuelve a intentarlo.'
              : `La subida falló con código ${peticion.status}.`,
          )
        }
        peticionRef.current = null
        resolver()
      }

      peticion.onerror = () => {
        setProgreso(null)
        peticionRef.current = null
        setError(
          'Error de red al subir. Si es un error de CORS, falta el método PUT en la política del bucket (SETUP.md, A4).',
        )
        resolver()
      }

      peticion.onabort = () => {
        peticionRef.current = null
        resolver()
      }

      peticion.send(archivo)
    })
  }

  return (
    <div>
      <input
        ref={entradaRef}
        type="file"
        accept={TIPOS_PERMITIDOS.join(',')}
        className="sr-only"
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          if (archivo) void subir(archivo)
          // Se limpia para poder volver a elegir el mismo archivo tras un fallo.
          e.target.value = ''
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Boton
          type="button"
          onClick={() => entradaRef.current?.click()}
          disabled={progreso !== null}
        >
          {etiqueta}
        </Boton>

        {progreso !== null ? (
          <>
            <div
              className="h-2 w-40 overflow-hidden rounded-full bg-neutral-200"
              role="progressbar"
              aria-valuenow={progreso}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progreso de la subida"
            >
              <div
                className="h-full bg-neutral-900 transition-[width]"
                style={{ width: `${progreso}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-neutral-500">{progreso}%</span>
            <button
              type="button"
              onClick={cancelar}
              className="text-xs text-neutral-500 underline underline-offset-4"
            >
              Cancelar
            </button>
          </>
        ) : null}
      </div>

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
