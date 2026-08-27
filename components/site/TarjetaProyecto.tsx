'use client'

import { useRef } from 'react'

import { miniaturasDeReserva, posterDeYoutube } from '@/lib/youtube'
import { Imagen } from './Imagen'

import { useLoopEnViewport } from './usar-loop'
import type { ProyectoPublico } from './tipos'

/**
 * Tarjeta de la rejilla de comerciales: poster + loop mudo.
 *
 * El loop solo arranca cuando la tarjeta entra en pantalla, y solo si el gestor
 * central le da turno (máximo tres a la vez). Mientras tanto se ve el poster.
 */
export function TarjetaProyecto({
  proyecto,
  onAbrir,
  prioridad = false,
}: {
  proyecto: ProyectoPublico
  onAbrir: () => void
  prioridad?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const activo = useLoopEnViewport(videoRef, {
    habilitado: Boolean(proyecto.loop_url),
  })

  // Las piezas alojadas en YouTube no tienen póster propio ni loop: la rejilla
  // usa la miniatura del video. Un póster pegado a mano en el panel siempre
  // gana, por si la miniatura automática no es el fotograma que se quiere.
  const poster =
    proyecto.poster_url ??
    (proyecto.youtube_id ? posterDeYoutube(proyecto.youtube_id) : null)

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="group relative block w-full overflow-hidden bg-neutral-950 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      aria-label={`Ver ${proyecto.title}${proyecto.client ? `, ${proyecto.client}` : ''}`}
    >
      <div className="relative aspect-video w-full">
        {poster ? (
          <Imagen
            src={poster}
            alternativas={
              proyecto.youtube_id && !proyecto.poster_url
                ? miniaturasDeReserva(proyecto.youtube_id)
                : undefined
            }
            alt={`Fotograma de ${proyecto.title}`}
            fill
            // Tres columnas en escritorio, dos en tablet, una en móvil: así el
            // navegador pide el tamaño correcto y no una imagen de 1920 px para
            // una tarjeta de 400.
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            priority={prioridad}
            loading={prioridad ? undefined : 'lazy'}
            placeholder="empty"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-neutral-900" />
        )}

        {proyecto.loop_url ? (
          <video
            ref={videoRef}
            src={proyecto.loop_url}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
            tabIndex={-1}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              activo ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : null}

        {/* Degradado sutil: el título tiene que leerse sobre cualquier plano. */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        <div className="absolute bottom-0 left-0 p-4 sm:p-5">
          <h3 className="font-[family-name:var(--fuente-serif)] text-2xl leading-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.7)] sm:text-3xl">
            {proyecto.title}
          </h3>
          {proyecto.client ? (
            <p className="mt-1 font-[family-name:var(--fuente-sans)] text-[0.65rem] uppercase tracking-[0.25em] text-white/60">
              {proyecto.client}
              {proyecto.year ? ` · ${proyecto.year}` : ''}
            </p>
          ) : null}
        </div>
      </div>
    </button>
  )
}
