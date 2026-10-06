export type DatosVideo = {
  format: 'horizontal' | 'vertical'
  duration: number
  miniatura: Blob | null
}

/** Lee el video local sin enviarlo a un servicio de conversión. */
export function prepararVideo(
  archivo: File,
  signal: AbortSignal,
): Promise<DatosVideo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    let datos: Omit<DatosVideo, 'miniatura'> | null = null
    let terminado = false
    const limpiar = () => {
      clearTimeout(limite)
      signal.removeEventListener('abort', cancelar)
      video.onloadedmetadata =
        video.onseeked =
        video.onloadeddata =
        video.onerror =
          null
      video.pause()
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
    }
    const terminar = (miniatura: Blob | null, error?: Error) => {
      if (terminado) return
      terminado = true
      limpiar()
      if (error) reject(error)
      else if (datos) resolve({ ...datos, miniatura })
      else
        reject(
          new Error(
            'No se pudo leer el video. Usa un MP4 para web (H.264) o su enlace de YouTube.',
          ),
        )
    }
    const cancelar = () =>
      terminar(null, new DOMException('Subida cancelada.', 'AbortError'))
    const limite = setTimeout(() => terminar(null), 15000)
    const capturar = () => {
      if (!datos || terminado || video.readyState < 2) return
      const canvas = document.createElement('canvas')
      const escala = Math.min(
        1,
        1280 / Math.max(video.videoWidth, video.videoHeight),
      )
      canvas.width = Math.round(video.videoWidth * escala)
      canvas.height = Math.round(video.videoHeight * escala)
      try {
        const contexto = canvas.getContext('2d')
        if (!contexto) return terminar(null)
        contexto.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => terminar(blob), 'image/jpeg', 0.85)
      } catch {
        terminar(null)
      }
    }
    video.onloadedmetadata = () => {
      if (
        !video.videoWidth ||
        !video.videoHeight ||
        !Number.isFinite(video.duration)
      )
        return terminar(null)
      datos = {
        format:
          video.videoHeight > video.videoWidth ? 'vertical' : 'horizontal',
        duration: Math.round(video.duration),
      }
      if (video.duration > 0.2)
        video.currentTime = Math.min(1, video.duration / 2)
      else capturar()
    }
    video.onseeked = capturar
    video.onloadeddata = () => {
      if (video.duration <= 0.2) capturar()
    }
    video.onerror = () =>
      terminar(
        null,
        new Error(
          'Este video no se puede reproducir en el navegador. Usa un MP4 para web (H.264) o pega su enlace de YouTube.',
        ),
      )
    signal.addEventListener('abort', cancelar, { once: true })
    if (signal.aborted) cancelar()
    else video.src = url
  })
}
