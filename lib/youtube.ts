/**
 * lib/youtube.ts
 *
 * Piezas cuya copia vive en YouTube, normalmente en el canal del artista.
 *
 * Se incrusta el reproductor en vez de alojar el archivo: descargar el video de
 * YouTube va contra sus condiciones, y además las reproducciones deben contar
 * en el canal de quien publicó la pieza. El precio es que el reproductor lleva
 * la marca de YouTube — la única excepción a la regla de "cero logos ajenos" y
 * una decisión tomada a conciencia.
 */

/** Un id de YouTube son 11 caracteres de alfabeto seguro para URL. */
const ID_VALIDO = /^[A-Za-z0-9_-]{11}$/

/**
 * Acepta un id suelto o cualquier forma de URL de YouTube y devuelve el id.
 *
 * Existe porque nadie copia el id: se copia el enlace de la barra del navegador
 * o el de «Compartir», y cada uno tiene una forma distinta. Pedirle al usuario
 * que recorte a mano once caracteres es pedirle que se equivoque.
 */
export function extraerIdDeYoutube(entrada: string | null | undefined): string | null {
  if (!entrada) return null

  const texto = entrada.trim()
  if (ID_VALIDO.test(texto)) return texto

  try {
    const url = new URL(texto)
    const host = url.hostname.replace(/^www\./, '')

    // youtu.be/<id>
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0]
      return ID_VALIDO.test(id) ? id : null
    }

    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      // youtube.com/watch?v=<id>
      const v = url.searchParams.get('v')
      if (v && ID_VALIDO.test(v)) return v

      // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
      const partes = url.pathname.split('/').filter(Boolean)
      const id = partes[1]
      if (
        ['embed', 'shorts', 'live', 'v'].includes(partes[0] ?? '') &&
        id &&
        ID_VALIDO.test(id)
      ) {
        return id
      }
    }
  } catch {
    // No era una URL. Se cae al null de abajo.
  }

  return null
}

/**
 * URL de incrustación.
 *
 * Se usa youtube-nocookie.com: no deja cookies de seguimiento hasta que el
 * visitante le da al play. Es el mismo reproductor.
 *
 * `rel=0` limita los vídeos sugeridos del final al mismo canal, en vez de
 * mandar al espectador a cualquier parte; `modestbranding` reduce la marca en
 * los controles.
 */
export function urlDeIncrustacion(id: string): string {
  const parametros = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  })
  return `https://www.youtube-nocookie.com/embed/${id}?${parametros}`
}

/**
 * Miniatura del video, para la rejilla.
 *
 * maxresdefault es 1280×720 y respeta el 16:9. Las otras variantes que YouTube
 * garantiza —hqdefault, sddefault— vienen en 4:3 con bandas negras arriba y
 * abajo, que es justo lo que se acaba de quitar del resto del sitio.
 *
 * Si un video no la tuviera, el componente Imagen cae a un bloque neutro y
 * siempre se puede pegar un póster propio en el panel.
 */
export function posterDeYoutube(id: string): string {
  return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
}

/**
 * Miniaturas de reserva, de mejor a peor.
 *
 * maxresdefault no existe para todos los videos —depende de la resolución con
 * la que se subió— y solo se descubre pidiéndola. sddefault y hqdefault sí
 * están siempre, aunque vienen en 4:3 con bandas: peor, pero mucho mejor que un
 * hueco gris. Para esos casos, lo limpio es pegar un póster propio en el panel.
 */
export function miniaturasDeReserva(id: string): string[] {
  return [
    `https://i.ytimg.com/vi/${id}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  ]
}
