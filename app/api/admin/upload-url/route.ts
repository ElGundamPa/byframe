import { AwsClient } from 'aws4fetch'
import { NextResponse } from 'next/server'

import { esquemaSubida } from '@/lib/admin/esquemas'
import { getR2Config } from '@/lib/env'
import { getUsuarioActual } from '@/lib/supabase/server'

/**
 * POST /api/admin/upload-url
 *
 * Devuelve una URL prefirmada para subir un archivo a R2 directamente desde el
 * navegador.
 *
 * Por qué prefirmada y no un proxy: el archivo va del navegador a R2 sin pasar
 * por el servidor. Ni consume su ancho de banda ni choca con el límite de
 * tamaño de cuerpo de las funciones.
 *
 * Reglas de seguridad, en orden de importancia:
 *
 *   1. Se valida la SESIÓN ANTES de firmar. Firmar primero y comprobar después
 *      sería regalar acceso de escritura al bucket a quien encuentre la ruta.
 *   2. Las credenciales de R2 viven solo aquí, en el servidor. Nunca viajan al
 *      navegador: lo que viaja es una firma de un solo objeto, con caducidad.
 *   3. El tipo MIME y el tamaño se validan en el servidor. Un límite que solo
 *      existe en el formulario no es un límite.
 *   4. La ruta del objeto la construye el servidor a partir del slug validado.
 *      Si la enviara el cliente, un `../` bien puesto sobrescribiría el
 *      manifiesto de otro proyecto.
 */

/** Diez minutos: de sobra para un póster o un loop, poco para reutilizar la firma. */
const CADUCIDAD_SEGUNDOS = 600

/** Extensión admitida por tipo MIME. Evita subir un mp4 llamado .webp. */
const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
}

export async function POST(peticion: Request) {
  const usuario = await getUsuarioActual()
  if (!usuario) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  let cuerpo: unknown
  try {
    cuerpo = await peticion.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo no válido.' }, { status: 400 })
  }

  const analisis = esquemaSubida.safeParse(cuerpo)
  if (!analisis.success) {
    return NextResponse.json(
      { error: analisis.error.issues[0]?.message ?? 'Datos no válidos.' },
      { status: 400 },
    )
  }

  const { slug, tipo, contentType } = analisis.data
  const extension = EXTENSIONES[contentType]

  // El loop es video; póster y fotos son imagen. Cruzarlos deja el sitio
  // intentando pintar un mp4 dentro de un <img>.
  const esVideo = contentType.startsWith('video/')
  if ((tipo === 'loop') !== esVideo) {
    return NextResponse.json(
      {
        error:
          tipo === 'loop'
            ? 'El loop tiene que ser un archivo de video mp4.'
            : 'Este campo espera una imagen, no un video.',
      },
      { status: 400 },
    )
  }

  /*
   * La ruta se arma aquí, nunca con lo que mande el cliente. Y jamás bajo
   * hls/: esa carpeta la escribe scripts/transcode.mjs y solo él, porque el
   * manifiesto y sus segmentos tienen que subir juntos y coherentes.
   */
  const rutas: Record<typeof tipo, string> = {
    poster: `projects/${slug}/poster.${extension}`,
    loop: `projects/${slug}/loop.${extension}`,
    equipo: `team/${slug}.${extension}`,
    sitio: `site/${slug}.${extension}`,
  }
  const clave = rutas[tipo]

  let config: ReturnType<typeof getR2Config>
  try {
    config = getR2Config()
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : 'Faltan las credenciales de R2 en el servidor.',
      },
      { status: 500 },
    )
  }

  const cliente = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    region: 'auto',
  })

  const destino = new URL(`${config.endpoint}/${config.bucket}/${clave}`)
  destino.searchParams.set('X-Amz-Expires', String(CADUCIDAD_SEGUNDOS))

  // signQuery mete la firma en la URL en vez de en una cabecera: así el
  // navegador puede hacer el PUT con un fetch normal.
  const firmada = await cliente.sign(destino.toString(), {
    method: 'PUT',
    headers: { 'content-type': contentType },
    aws: { signQuery: true },
  })

  return NextResponse.json({
    url: firmada.url,
    clave,
    // Ruta pública final, la que se guarda en la base de datos.
    rutaPublica: `https://media.byframe.co/${clave}`,
    // El PUT debe enviar exactamente este Content-Type o la firma no coincide.
    contentType,
    caducaEn: CADUCIDAD_SEGUNDOS,
  })
}
