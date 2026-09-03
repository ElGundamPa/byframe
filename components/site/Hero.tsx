'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  videoUrl: string | null
  posterUrl: string | null
  texto: string | null
}

/**
 * Video de portada: pantalla completa, mudo, en bucle, sin controles.
 *
 * Detalles que importan:
 *   · 100dvh y no 100vh. En móvil, 100vh mide la ventana SIN la barra del
 *     navegador, así que el video queda cortado por abajo hasta que el usuario
 *     desplaza. dvh mide lo que de verdad se ve.
 *   · muted + playsInline + autoPlay es la única combinación que los
 *     navegadores dejan reproducir sola. Falta uno y el video se queda quieto,
 *     sobre todo en iOS.
 *   · El poster se pinta siempre debajo. Si el video tarda, falla o el usuario
 *     pidió menos movimiento, lo que se ve es una imagen fija, nunca un rectángulo negro.
 *   · En pantallas pequeñas se busca una versión ligera del archivo. Un recap
 *     de 40 s en 1080p pesa 14 MB: en un teléfono con datos móviles eso es un
 *     abuso, y además nadie distingue 1080 de 720 en seis pulgadas. La versión
 *     de 720p pesa menos de la mitad.
 */

/**
 * Convención: junto a `hero.mp4` vive `hero-720.mp4`.
 *
 * Se deduce el nombre en vez de guardar dos rutas en la base de datos, para no
 * complicar el panel con un campo que solo entiende quien lo montó. Si el
 * archivo ligero no existe, el <video> emite un error y se vuelve al original,
 * así que la convención puede no cumplirse sin romper nada.
 */
function versionLigera(url: string): string | null {
  return url.endsWith('.mp4') ? url.replace(/\.mp4$/, '-720.mp4') : null
}
export function Hero({ videoUrl, posterUrl, texto }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [listo, setListo] = useState(false)
  const [posterRoto, setPosterRoto] = useState(false)
  const posterRef = useRef<HTMLImageElement>(null)

  /**
   * El poster es parte del HTML inicial, así que el navegador puede haberlo
   * intentado y fallado ANTES de que React hidrate y enganche onError: ese
   * evento ya pasó y no se vuelve a emitir. Por eso, al montar, se comprueba
   * también el estado real del elemento.
   */
  useEffect(() => {
    const img = posterRef.current
    if (img?.complete && img.naturalWidth === 0) setPosterRoto(true)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl) return

    const reducirMovimiento = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const ahorroDeDatos = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection?.saveData

    // Con cualquiera de las dos preferencias activas, la portada se queda en el
    // poster: ni se descarga el video.
    if (reducirMovimiento || ahorroDeDatos) return

    let hls: import('hls.js').default | null = null
    let cancelado = false

    const esManifiesto = videoUrl.endsWith('.m3u8')
    const soportaHlsNativo =
      video.canPlayType('application/vnd.apple.mpegurl') !== ''

    if (!esManifiesto || soportaHlsNativo) {
      const ligera = versionLigera(videoUrl)
      const pantallaPequena = window.matchMedia('(max-width: 767px)').matches

      // Si la versión ligera no existiera, este error devuelve el original.
      const alFallar = () => {
        if (video.src !== videoUrl) {
          video.src = videoUrl
          void video.play().catch(() => {})
        }
      }
      video.addEventListener('error', alFallar)

      video.src = pantallaPequena && ligera ? ligera : videoUrl
      void video.play().catch(() => {})

      return () => {
        video.removeEventListener('error', alFallar)
      }
    } else {
      void import('hls.js').then(({ default: Hls }) => {
        if (cancelado || !Hls.isSupported()) return
        hls = new Hls({ startLevel: -1, capLevelToPlayerSize: true })
        hls.loadSource(videoUrl)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          void video.play().catch(() => {})
        })
      })
    }

    return () => {
      cancelado = true
      hls?.destroy()
      hls = null
    }
  }, [videoUrl])

  return (
    <section className="relative h-[100dvh] w-full overflow-hidden bg-black">
      {posterUrl && !posterRoto ? (
        // Deliberadamente <img> y no next/image: es el LCP de la portada y no
        // necesita ni redimensionado ni lazy loading; cualquier capa intermedia
        // solo retrasa el primer pintado.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={posterRef}
          src={posterUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
          // Si el archivo todavía no está en R2, se retira el elemento en vez
          // de dejar el icono de imagen rota en mitad de la portada.
          onError={() => setPosterRoto(true)}
        />
      ) : null}

      {videoUrl ? (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setListo(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            listo ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : null}

      {/*
        Dos velos, no uno. El de abajo sostiene el título; el de arriba, la
        navegación. Entre ambos queda una franja central limpia, que es donde
        se ve la imagen. Un velo uniforme apagaría el plano entero.
      */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/50"
      />

      {texto ? (
        <h1 className="absolute bottom-16 left-5 right-5 font-[family-name:var(--fuente-serif)] text-[clamp(2.5rem,9vw,7rem)] leading-[0.95] text-white [text-shadow:0_2px_30px_rgba(0,0,0,0.75)] sm:bottom-20 sm:left-8">
          {texto}
        </h1>
      ) : null}

      <a
        href="#trabajo"
        className="absolute bottom-2 left-1/2 flex min-h-11 -translate-x-1/2 items-center px-6 font-[family-name:var(--fuente-sans)] text-[0.65rem] uppercase tracking-[0.3em] text-white/80 [text-shadow:0_1px_10px_rgba(0,0,0,0.7)] transition-colors hover:text-white"
      >
        Trabajo
      </a>
    </section>
  )
}
