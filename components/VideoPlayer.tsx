'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * components/VideoPlayer.tsx
 *
 * Reproductor HLS con controles propios. Sin logos ajenos, sin marcas de agua,
 * sin la barra nativa del navegador: en una web de productora, el reproductor
 * tiene que desaparecer.
 *
 * Estrategia de reproducción:
 *   · Safari, iOS y iPadOS reproducen HLS de forma nativa en el elemento
 *     <video>. Ahí NO se carga hls.js: sería peor: más batería, peor cambio de
 *     calidad y, en iOS, conflictos con la pantalla completa nativa.
 *   · El resto (Chrome, Firefox, Edge) necesitan hls.js, que se importa de
 *     forma dinámica para no cargar 200 kB a quien no los va a usar.
 */

type Props = {
  /** Manifiesto .m3u8. */
  src: string
  poster?: string | null
  /** Se muestra en aria-label y en la pantalla de carga. */
  titulo: string
  /** Arranca al montar. Requiere que el usuario ya haya interactuado, o silencio. */
  autoPlay?: boolean
  /**
   * Proporción de la caja mientras no se conocen las dimensiones reales.
   * En cuanto llegan los metadatos, se sustituye por la del archivo.
   */
  aspectoPorDefecto?: string
  className?: string
}

export function VideoPlayer({
  src,
  poster,
  titulo,
  autoPlay = false,
  aspectoPorDefecto = '16 / 9',
  className = '',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const ocultarControlesRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [reproduciendo, setReproduciendo] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [duracion, setDuracion] = useState(0)
  const [volumen, setVolumen] = useState(1)
  const [silenciado, setSilenciado] = useState(false)
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const [controlesVisibles, setControlesVisibles] = useState(true)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * Proporción real del archivo.
   *
   * Forzar la caja a 16:9 y meter dentro un video 3:2 con object-contain
   * devuelve barras negras a los lados: el mismo defecto que se quitó del
   * maestro, reintroducido por CSS. Y recortar tampoco vale: en un portafolio,
   * el encuadre del director no se toca.
   *
   * La caja se adapta al archivo. Hasta que llegan los metadatos se usa la
   * proporción por defecto, que solo sirve para reservar el hueco.
   */
  const [aspecto, setAspecto] = useState<string | null>(null)

  /* ── Carga del manifiesto ─────────────────────────────────────────────── */

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    // Instancia de hls.js, si hace falta. Se guarda para destruirla al
    // desmontar: sin destroy(), cada apertura del modal deja atrás un worker y
    // una cola de peticiones que siguen descargando segmentos en segundo plano.
    let hls: import('hls.js').default | null = null
    let cancelado = false

    const soportaHlsNativo =
      video.canPlayType('application/vnd.apple.mpegurl') !== ''

    if (soportaHlsNativo) {
      video.src = src
      setCargando(false)
    } else {
      void import('hls.js').then(({ default: Hls }) => {
        if (cancelado) return

        if (!Hls.isSupported()) {
          setError('Este navegador no puede reproducir el video.')
          setCargando(false)
          return
        }

        hls = new Hls({
          // -1 deja que hls.js mida el ancho de banda real y elija la calidad.
          // Fijar un nivel inicial alto arruina el arranque en 4G; fijarlo bajo
          // deja la primera reproducción borrosa en fibra.
          startLevel: -1,
          capLevelToPlayerSize: true,
          // Con material oscuro y con grano, los segmentos pesan más de lo
          // habitual. Un buffer algo mayor evita cortes en mitad de un plano.
          maxBufferLength: 30,
        })

        hls.loadSource(src)
        hls.attachMedia(video)

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setCargando(false)
          if (autoPlay) void video.play().catch(() => {})
        })

        hls.on(Hls.Events.ERROR, (_evento, datos) => {
          if (!datos.fatal) return

          // Los errores fatales de red y de medios son recuperables: hls.js
          // sabe reengancharse. Solo se rinde con el resto.
          switch (datos.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls?.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls?.recoverMediaError()
              break
            default:
              setError('No se pudo cargar el video.')
              setCargando(false)
              hls?.destroy()
          }
        })
      })
    }

    return () => {
      cancelado = true
      hls?.destroy()
      hls = null
    }
  }, [src, autoPlay])

  /* ── Estado del elemento <video> ──────────────────────────────────────── */

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const alActualizar = () => setProgreso(video.currentTime)
    const alCargarMetadatos = () => {
      setDuracion(video.duration || 0)
      if (video.videoWidth && video.videoHeight) {
        setAspecto(`${video.videoWidth} / ${video.videoHeight}`)
      }
    }
    const alReproducir = () => setReproduciendo(true)
    const alPausar = () => setReproduciendo(false)
    const alCambiarVolumen = () => {
      setVolumen(video.volume)
      setSilenciado(video.muted)
    }

    video.addEventListener('timeupdate', alActualizar)
    video.addEventListener('loadedmetadata', alCargarMetadatos)
    video.addEventListener('play', alReproducir)
    video.addEventListener('pause', alPausar)
    video.addEventListener('volumechange', alCambiarVolumen)

    return () => {
      video.removeEventListener('timeupdate', alActualizar)
      video.removeEventListener('loadedmetadata', alCargarMetadatos)
      video.removeEventListener('play', alReproducir)
      video.removeEventListener('pause', alPausar)
      video.removeEventListener('volumechange', alCambiarVolumen)
    }
  }, [])

  /* ── Pantalla completa ────────────────────────────────────────────────── */

  useEffect(() => {
    const alCambiar = () => setPantallaCompleta(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', alCambiar)
    return () => document.removeEventListener('fullscreenchange', alCambiar)
  }, [])

  /* ── Acciones ─────────────────────────────────────────────────────────── */

  const alternarReproduccion = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play().catch(() => {})
    else video.pause()
  }, [])

  const buscar = useCallback((segundos: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = segundos
    setProgreso(segundos)
  }, [])

  const alternarSilencio = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
  }, [])

  const alternarPantallaCompleta = useCallback(async () => {
    const contenedor = contenedorRef.current
    const video = videoRef.current
    if (!contenedor || !video) return

    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    // iPhone no permite pantalla completa sobre un div: solo el elemento
    // <video> tiene esa API, y con otro nombre.
    const videoIOS = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void
    }

    if (contenedor.requestFullscreen) {
      await contenedor.requestFullscreen().catch(() => {})
    } else if (videoIOS.webkitEnterFullscreen) {
      videoIOS.webkitEnterFullscreen()
    }
  }, [])

  /* ── Ocultar los controles con el ratón quieto ────────────────────────── */

  const mostrarControles = useCallback(() => {
    setControlesVisibles(true)
    if (ocultarControlesRef.current) clearTimeout(ocultarControlesRef.current)
    ocultarControlesRef.current = setTimeout(() => {
      // Nunca se ocultan con el video en pausa: dejarían al usuario sin forma
      // visible de reanudar.
      if (videoRef.current && !videoRef.current.paused) {
        setControlesVisibles(false)
      }
    }, 2600)
  }, [])

  useEffect(() => {
    return () => {
      if (ocultarControlesRef.current) clearTimeout(ocultarControlesRef.current)
    }
  }, [])

  /* ── Teclado ──────────────────────────────────────────────────────────── */

  const alPulsarTecla = useCallback(
    (evento: React.KeyboardEvent) => {
      const video = videoRef.current
      if (!video) return

      switch (evento.key) {
        case ' ':
        case 'k':
          evento.preventDefault()
          alternarReproduccion()
          break
        case 'ArrowRight':
          evento.preventDefault()
          buscar(Math.min(video.currentTime + 5, video.duration || 0))
          break
        case 'ArrowLeft':
          evento.preventDefault()
          buscar(Math.max(video.currentTime - 5, 0))
          break
        case 'm':
          alternarSilencio()
          break
        case 'f':
          void alternarPantallaCompleta()
          break
      }
      mostrarControles()
    },
    [
      alternarReproduccion,
      alternarSilencio,
      alternarPantallaCompleta,
      buscar,
      mostrarControles,
    ],
  )

  const porcentaje = duracion > 0 ? (progreso / duracion) * 100 : 0

  return (
    <div
      ref={contenedorRef}
      className={`group relative bg-black ${className}`}
      style={{ aspectRatio: aspecto ?? aspectoPorDefecto }}
      onMouseMove={mostrarControles}
      onTouchStart={mostrarControles}
      onKeyDown={alPulsarTecla}
      tabIndex={0}
      role="region"
      aria-label={`Reproductor de video: ${titulo}`}
    >
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-contain"
        onClick={alternarReproduccion}
        aria-label={titulo}
      />

      {cargando && !error ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-[0.7rem] uppercase tracking-[0.3em] text-white/60">
            Cargando
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
          <p className="text-sm text-white/70">{error}</p>
        </div>
      ) : null}

      {/* Botón central de reproducción, solo con el video pausado. */}
      {!reproduciendo && !cargando && !error ? (
        <button
          type="button"
          onClick={alternarReproduccion}
          aria-label="Reproducir"
          className="absolute inset-0 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/40 bg-black/30 backdrop-blur-sm transition-colors hover:bg-black/50">
            <IconoReproducir className="ml-1 h-6 w-6" />
          </span>
        </button>
      ) : null}

      {/* Controles */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-10 transition-opacity duration-300 sm:px-4 ${
          controlesVisibles || !reproduciendo
            ? 'opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      >
        <input
          type="range"
          min={0}
          max={duracion || 0}
          step={0.1}
          value={progreso}
          onChange={(e) => buscar(Number(e.target.value))}
          aria-label="Progreso del video"
          aria-valuetext={`${formatearTiempo(progreso)} de ${formatearTiempo(duracion)}`}
          className="h-11 w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
          // backgroundImage y no background: mezclar la abreviada con
          // backgroundSize/Repeat/Position hace que React reescriba la
          // abreviada en cada render y borre las otras tres. Avisa por consola
          // y, en la práctica, la barra parpadea al mover el cursor.
          style={{
            backgroundImage: `linear-gradient(to right, #fff ${porcentaje}%, rgba(255,255,255,0.25) ${porcentaje}%)`,
            backgroundSize: '100% 2px',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
          }}
        />

        <div className="flex items-center gap-1 text-white">
          <BotonControl
            onClick={alternarReproduccion}
            etiqueta={reproduciendo ? 'Pausar' : 'Reproducir'}
          >
            {reproduciendo ? (
              <IconoPausa className="h-4 w-4" />
            ) : (
              <IconoReproducir className="h-4 w-4" />
            )}
          </BotonControl>

          <BotonControl
            onClick={alternarSilencio}
            etiqueta={silenciado ? 'Activar sonido' : 'Silenciar'}
          >
            {silenciado || volumen === 0 ? (
              <IconoSilencio className="h-4 w-4" />
            ) : (
              <IconoSonido className="h-4 w-4" />
            )}
          </BotonControl>

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={silenciado ? 0 : volumen}
            onChange={(e) => {
              const video = videoRef.current
              if (!video) return
              video.volume = Number(e.target.value)
              video.muted = Number(e.target.value) === 0
            }}
            aria-label="Volumen"
            className="hidden h-11 w-20 cursor-pointer appearance-none bg-transparent sm:block [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            style={{
              backgroundImage: `linear-gradient(to right, #fff ${(silenciado ? 0 : volumen) * 100}%, rgba(255,255,255,0.25) ${(silenciado ? 0 : volumen) * 100}%)`,
              backgroundSize: '100% 2px',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
            }}
          />

          <span className="ml-2 font-[family-name:var(--fuente-sans)] text-[0.7rem] tabular-nums text-white/70">
            {formatearTiempo(progreso)} / {formatearTiempo(duracion)}
          </span>

          <span className="flex-1" />

          <BotonControl
            onClick={() => void alternarPantallaCompleta()}
            etiqueta={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            <IconoPantallaCompleta className="h-4 w-4" />
          </BotonControl>
        </div>
      </div>
    </div>
  )
}

/* ── Piezas ─────────────────────────────────────────────────────────────── */

function BotonControl({
  onClick,
  etiqueta,
  children,
}: {
  onClick: () => void
  etiqueta: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      // 44 px de lado: el mínimo táctil recomendado. Con menos, en un teléfono
      // se falla el objetivo una de cada tres veces.
      className="flex h-11 w-11 items-center justify-center text-white/80 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      {children}
    </button>
  )
}

function formatearTiempo(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return '0:00'
  const m = Math.floor(segundos / 60)
  const s = Math.floor(segundos % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/* Iconos propios. Un paquete de iconos serían 40 kB para dibujar cinco flechas. */

function IconoReproducir({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function IconoPausa({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </svg>
  )
}

function IconoSonido({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />
    </svg>
  )
}

function IconoSilencio({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4zm15.5 3 2.3-2.3-1.2-1.2-2.3 2.3-2.3-2.3-1.2 1.2 2.3 2.3-2.3 2.3 1.2 1.2 2.3-2.3 2.3 2.3 1.2-1.2z" />
    </svg>
  )
}

function IconoPantallaCompleta({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4 9V4h5v2H6v3H4zm11-5h5v5h-2V6h-3V4zM4 15h2v3h3v2H4v-5zm14 3v-3h2v5h-5v-2h3z" />
    </svg>
  )
}
