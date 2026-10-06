import { TAMANO_MAXIMO, tiposParaSubida, type TipoDeSubida } from './esquemas'

export async function subirArchivo(
  archivo: File,
  slug: string,
  tipo: TipoDeSubida,
  signal: AbortSignal,
  progreso: (n: number) => void,
): Promise<string> {
  const contentType =
    archivo.type || (/\.mp4$/i.test(archivo.name) ? 'video/mp4' : '')
  const tipos = tiposParaSubida(tipo)
  if (!tipos.includes(contentType as (typeof tipos)[number]))
    throw new Error(
      tipo === 'video' || tipo === 'loop' || tipo === 'portada'
        ? 'Selecciona un video MP4.'
        : 'Selecciona una imagen JPG, PNG, WebP o AVIF.',
    )
  if (!archivo.size || archivo.size > TAMANO_MAXIMO)
    throw new Error('Selecciona un archivo de hasta 200 MB.')
  if (!slug) throw new Error('Escribe primero el título del proyecto.')
  signal.throwIfAborted()
  const respuesta = await fetch('/api/admin/upload-url', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      slug,
      tipo,
      nombreArchivo: archivo.name,
      contentType,
      tamano: archivo.size,
    }),
  })
  const firma = await respuesta.json()
  if (!respuesta.ok)
    throw new Error(firma.error ?? 'No se pudo preparar la subida.')
  signal.throwIfAborted()
  await new Promise<void>((resolve, reject) => {
    const peticion = new XMLHttpRequest()
    const terminar = (error?: Error) => {
      signal.removeEventListener('abort', cancelar)
      if (error) reject(error)
      else resolve()
    }
    const cancelar = () => peticion.abort()
    peticion.open('PUT', firma.url, true)
    peticion.setRequestHeader('Content-Type', firma.contentType)
    peticion.timeout = 15 * 60 * 1000
    peticion.upload.onprogress = (e) => {
      if (e.lengthComputable) progreso(Math.round((e.loaded / e.total) * 100))
    }
    peticion.onload = () =>
      terminar(
        peticion.status >= 200 && peticion.status < 300
          ? undefined
          : new Error('No se pudo subir el archivo. Vuelve a intentarlo.'),
      )
    peticion.onerror = () =>
      terminar(
        new Error(
          'No se pudo conectar para subir el archivo. Comprueba tu conexión y vuelve a intentarlo.',
        ),
      )
    peticion.ontimeout = () =>
      terminar(new Error('La subida tardó demasiado. Vuelve a intentarlo.'))
    peticion.onabort = () =>
      terminar(new DOMException('Subida cancelada.', 'AbortError'))
    signal.addEventListener('abort', cancelar, { once: true })
    peticion.send(archivo)
  })
  signal.throwIfAborted()
  return firma.rutaPublica
}
