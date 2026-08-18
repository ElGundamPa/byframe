'use client'

import { Imagen } from './Imagen'
import { useEffect, useRef, useState } from 'react'

import { useLoopEnViewport } from './usar-loop'
import type { ProyectoPublico } from './tipos'

/**
 * Pestaña "Social": piezas verticales 9:16.
 *
 * Dos comportamientos distintos, no uno adaptado:
 *
 *   · Escritorio → carrusel horizontal de tarjetas verticales con loop mudo.
 *     Es una vitrina; el visitante compara piezas de un vistazo.
 *   · Móvil → feed a pantalla completa con scroll-snap vertical: cada pieza
 *     ocupa la pantalla entera, se reproduce al centrarse y se pausa al salir.
 *     Es el gesto que el usuario ya trae aprendido de Instagram y TikTok.
 *
 * La decisión se toma en el cliente, con matchMedia, y no con clases CSS,
 * porque las dos versiones no solo se ven distinto: cargan archivos distintos
 * (loop mudo de 6 s frente al video completo en HLS con sonido).
 */
export function Social({
  proyectos,
  onAbrir,
}: {
  proyectos: ProyectoPublico[]
  onAbrir: (proyecto: ProyectoPublico) => void
}) {
  const [esMovil, setEsMovil] = useState<boolean | null>(null)

  useEffect(() => {
    const consulta = window.matchMedia('(max-width: 767px)')
    const actualizar = () => setEsMovil(consulta.matches)
    actualizar()
    consulta.addEventListener('change', actualizar)
    return () => consulta.removeEventListener('change', actualizar)
  }, [])

  if (esMovil === null) {
    // Primer render: aún no se sabe el ancho. Un hueco con la altura correcta
    // evita que el contenido salte cuando se decida.
    return <div className="h-[60vh]" aria-hidden="true" />
  }

  return esMovil ? (
    <FeedVertical proyectos={proyectos} onAbrir={onAbrir} />
  ) : (
    <CarruselHorizontal proyectos={proyectos} onAbrir={onAbrir} />
  )
}

/* ── Escritorio ─────────────────────────────────────────────────────────── */

function CarruselHorizontal({
  proyectos,
  onAbrir,
}: {
  proyectos: ProyectoPublico[]
  onAbrir: (proyecto: ProyectoPublico) => void
}) {
  return (
    <div
      className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4"
      // Inercia nativa del sistema. Ninguna librería de smooth-scroll: pesan,
      // secuestran la rueda del ratón y rompen el desplazamiento por teclado.
      style={{ scrollbarWidth: 'thin' }}
      role="list"
      aria-label="Piezas verticales"
    >
      {proyectos.map((proyecto) => (
        <div key={proyecto.id} role="listitem" className="w-[min(280px,70vw)] shrink-0 snap-start">
          <TarjetaVertical proyecto={proyecto} onAbrir={() => onAbrir(proyecto)} />
        </div>
      ))}
    </div>
  )
}

function TarjetaVertical({
  proyecto,
  onAbrir,
}: {
  proyecto: ProyectoPublico
  onAbrir: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const activo = useLoopEnViewport(videoRef, {
    habilitado: Boolean(proyecto.loop_url),
  })

  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`Ver ${proyecto.title}`}
      className="group relative block w-full overflow-hidden bg-neutral-950 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      <div className="relative aspect-[9/16] w-full">
        {proyecto.poster_url ? (
          <Imagen
            src={proyecto.poster_url}
            alt={`Fotograma de ${proyecto.title}`}
            fill
            sizes="280px"
            loading="lazy"
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

        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        <div className="absolute bottom-0 left-0 p-4">
          <h3 className="font-[family-name:var(--fuente-serif)] text-xl leading-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.7)]">
            {proyecto.title}
          </h3>
          {proyecto.client ? (
            <p className="mt-1 font-[family-name:var(--fuente-sans)] text-[0.6rem] uppercase tracking-[0.25em] text-white/60">
              {proyecto.client}
            </p>
          ) : null}
        </div>
      </div>
    </button>
  )
}

/* ── Móvil ──────────────────────────────────────────────────────────────── */

function FeedVertical({
  proyectos,
  onAbrir,
}: {
  proyectos: ProyectoPublico[]
  onAbrir: (proyecto: ProyectoPublico) => void
}) {
  // El sonido es una decisión del usuario y persiste mientras recorre el feed.
  // Arranca apagado porque ningún navegador deja reproducir con sonido sin una
  // interacción previa, y porque nadie quiere que una web le grite.
  const [sonido, setSonido] = useState(false)

  return (
    <div className="relative -mx-5 sm:-mx-8">
      <div
        className="h-[100dvh] snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
        role="list"
        aria-label="Piezas verticales"
      >
        {proyectos.map((proyecto) => (
          <div
            key={proyecto.id}
            role="listitem"
            className="relative h-[100dvh] w-full snap-start snap-always"
          >
            <PiezaFeed
              proyecto={proyecto}
              sonido={sonido}
              onAbrir={() => onAbrir(proyecto)}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setSonido((s) => !s)}
        aria-label={sonido ? 'Silenciar' : 'Activar sonido'}
        aria-pressed={sonido}
        className="fixed bottom-6 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white backdrop-blur-sm"
      >
        {sonido ? <IconoSonido /> : <IconoSilencio />}
      </button>
    </div>
  )
}

function PiezaFeed({
  proyecto,
  sonido,
  onAbrir,
}: {
  proyecto: ProyectoPublico
  sonido: boolean
  onAbrir: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const [enPantalla, setEnPantalla] = useState(false)

  // Fuente: el video completo en HLS, para que el botón de sonido tenga algo
  // que activar. El loop del portafolio es mudo por diseño.
  const fuente = proyecto.hls_url ?? proyecto.loop_url

  useEffect(() => {
    const contenedor = contenedorRef.current
    if (!contenedor) return

    const observador = new IntersectionObserver(
      ([entrada]) => setEnPantalla(entrada.intersectionRatio > 0.6),
      { threshold: [0, 0.6, 1] },
    )
    observador.observe(contenedor)
    return () => observador.disconnect()
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !fuente) return

    let hls: import('hls.js').default | null = null
    let cancelado = false

    if (!enPantalla) {
      video.pause()
      return
    }

    const esManifiesto = fuente.endsWith('.m3u8')
    const soportaHlsNativo =
      video.canPlayType('application/vnd.apple.mpegurl') !== ''

    if (!esManifiesto || soportaHlsNativo) {
      if (video.src !== fuente) video.src = fuente
      void video.play().catch(() => {})
    } else {
      void import('hls.js').then(({ default: Hls }) => {
        if (cancelado || !Hls.isSupported()) return
        hls = new Hls({ startLevel: -1, capLevelToPlayerSize: true })
        hls.loadSource(fuente)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          void video.play().catch(() => {})
        })
      })
    }

    return () => {
      cancelado = true
      // Al salir de pantalla se destruye la instancia: si no, cada pieza que
      // el usuario deja atrás sigue descargando segmentos y en un feed de diez
      // se van decenas de megabytes de datos móviles.
      hls?.destroy()
      hls = null
    }
  }, [enPantalla, fuente])

  // El silencio se aplica por propiedad, no por atributo: cambiar el atributo
  // en caliente no siempre reinicia la pista de audio.
  useEffect(() => {
    const video = videoRef.current
    if (video) video.muted = !sonido
  }, [sonido])

  return (
    <div ref={contenedorRef} className="relative h-full w-full bg-black">
      {proyecto.poster_url ? (
        <Imagen
          src={proyecto.poster_url}
          alt={`Fotograma de ${proyecto.title}`}
          fill
          sizes="100vw"
          className="object-cover"
        />
      ) : null}

      {fuente ? (
        <video
          ref={videoRef}
          loop
          muted
          playsInline
          preload="none"
          poster={proyecto.poster_url ?? undefined}
          aria-label={proyecto.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 to-transparent" />

      <div className="absolute bottom-24 left-5 right-20">
        <h3 className="font-[family-name:var(--fuente-serif)] text-3xl leading-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.7)]">
          {proyecto.title}
        </h3>
        {proyecto.client ? (
          <p className="mt-1 font-[family-name:var(--fuente-sans)] text-[0.65rem] uppercase tracking-[0.25em] text-white/60">
            {proyecto.client}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onAbrir}
          className="mt-4 inline-flex h-11 items-center font-[family-name:var(--fuente-sans)] text-[0.65rem] uppercase tracking-[0.25em] text-white underline underline-offset-8"
        >
          Ver ficha
        </button>
      </div>
    </div>
  )
}

function IconoSonido() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />
    </svg>
  )
}

function IconoSilencio() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4zm15.5 3 2.3-2.3-1.2-1.2-2.3 2.3-2.3-2.3-1.2 1.2 2.3 2.3-2.3 2.3 1.2 1.2 2.3-2.3 2.3 2.3 1.2-1.2z" />
    </svg>
  )
}
