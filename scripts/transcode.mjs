#!/usr/bin/env node
/**
 * scripts/transcode.mjs
 *
 * Prepara una pieza para el sitio: escalera HLS, poster, loop, subida a R2 y
 * verificación. Todo local, con ffmpeg. Cero servicios de pago.
 *
 * Uso:
 *   npm run transcode -- --input ./master.mov --slug culto-iii \
 *                        --format horizontal --poster 00:00:24
 *
 * Banderas:
 *   --input    archivo maestro (obligatorio)
 *   --slug     identificador del proyecto, minúsculas y guiones (obligatorio)
 *   --format   horizontal | vertical            (por defecto: horizontal)
 *   --poster   timecode del fotograma de portada (por defecto: 00:00:02)
 *   --bucket   nombre del bucket                (por defecto: byframe-media)
 *   --remoto   remoto de rclone                 (por defecto: r2)
 *   --base     dominio público de los medios    (por defecto: NEXT_PUBLIC_MEDIA_BASE_URL)
 *   --salida   carpeta de trabajo               (por defecto: ./.transcode)
 *   --dry-run  imprime los comandos sin ejecutar nada
 *   --no-subir transcodifica pero no sube
 *   --sin-recorte  no detecta ni quita las barras negras del maestro
 *   --local    escribe en public/media y no sube nada: sirve el video desde el
 *              propio servidor de desarrollo, sin depender de R2
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

/* ── Escalera de calidad ─────────────────────────────────────────────────── */

/**
 * Tres niveles. El de arriba va a 8000 kb/s, muy por encima de lo habitual
 * para 1080p, porque el material de ByFrame es oscuro y con grano: son las dos
 * cosas que más castigan a un códec. Con 5000 kb/s, las sombras se rompen en
 * bloques y el grano se convierte en un hervidero.
 *
 * En vertical se invierte la escala: 1080 es el ANCHO, no el alto. Escalar por
 * altura dejaría una pieza 9:16 en 607 px de ancho.
 */
const ESCALERA = [
  { nombre: '1080', lado: 1080, bitrate: 8000, maxrate: 8560, buffer: 12000, audio: 192 },
  { nombre: '720', lado: 720, bitrate: 4000, maxrate: 4280, buffer: 6000, audio: 128 },
  { nombre: '480', lado: 480, bitrate: 1800, maxrate: 1930, buffer: 2700, audio: 96 },
]

const DURACION_LOOP = 6

/* ── Utilidades de consola ───────────────────────────────────────────────── */

const color = {
  gris: (t) => `\x1b[90m${t}\x1b[0m`,
  verde: (t) => `\x1b[32m${t}\x1b[0m`,
  rojo: (t) => `\x1b[31m${t}\x1b[0m`,
  amarillo: (t) => `\x1b[33m${t}\x1b[0m`,
  negrita: (t) => `\x1b[1m${t}\x1b[0m`,
}

function paso(mensaje) {
  console.log(`\n${color.negrita('▸')} ${mensaje}`)
}

function aviso(mensaje) {
  console.log(`${color.amarillo('!')} ${mensaje}`)
}

function morir(mensaje, ayuda) {
  console.error(`\n${color.rojo('✕')} ${mensaje}`)
  if (ayuda) console.error(`\n${ayuda}\n`)
  process.exit(1)
}

/** Barra de progreso en una sola línea. */
function barra(fraccion, etiqueta) {
  const ancho = 28
  const lleno = Math.max(0, Math.min(ancho, Math.round(fraccion * ancho)))
  const pintada = '█'.repeat(lleno) + '░'.repeat(ancho - lleno)
  const pct = String(Math.round(fraccion * 100)).padStart(3)
  process.stdout.write(`\r  ${pintada} ${pct}%  ${etiqueta}   `)
}

/* ── Argumentos ──────────────────────────────────────────────────────────── */

function leerArgumentos(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const actual = argv[i]
    if (!actual.startsWith('--')) continue
    const clave = actual.slice(2)
    const siguiente = argv[i + 1]
    if (!siguiente || siguiente.startsWith('--')) {
      args[clave] = true
    } else {
      args[clave] = siguiente
      i++
    }
  }
  return args
}

/* ── Comprobación de herramientas ────────────────────────────────────────── */

function ejecutar(comando, argumentos, { silencioso = true } = {}) {
  return new Promise((resolver) => {
    const proceso = spawn(comando, argumentos, {
      stdio: silencioso ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      shell: false,
    })

    let salida = ''
    let error = ''
    proceso.stdout?.on('data', (d) => (salida += d.toString()))
    proceso.stderr?.on('data', (d) => (error += d.toString()))

    proceso.on('error', () => resolver({ codigo: -1, salida, error }))
    proceso.on('close', (codigo) => resolver({ codigo, salida, error }))
  })
}

const AYUDA_FFMPEG = `Instala ffmpeg:

  Windows   winget install Gyan.FFmpeg
  macOS     brew install ffmpeg
  Linux     sudo apt install ffmpeg

Cierra y vuelve a abrir la terminal, y comprueba con:  ffmpeg -version`

const AYUDA_RCLONE = `Instala y configura rclone (SETUP.md, paso A6):

  Windows   winget install Rclone.Rclone
  macOS     brew install rclone
  Linux     curl https://rclone.org/install.sh | sudo bash

Después ejecuta  rclone config  y crea el remoto llamado "r2".`

async function comprobarHerramientas({ subir }) {
  paso('Comprobando herramientas')

  const ffmpeg = await ejecutar('ffmpeg', ['-version'])
  if (ffmpeg.codigo !== 0) morir('No se encontró ffmpeg.', AYUDA_FFMPEG)
  const version = ffmpeg.salida.split('\n')[0] ?? 'ffmpeg'
  console.log(`  ${color.verde('✓')} ${color.gris(version)}`)

  const ffprobe = await ejecutar('ffprobe', ['-version'])
  if (ffprobe.codigo !== 0) {
    morir('No se encontró ffprobe (viene con ffmpeg).', AYUDA_FFMPEG)
  }
  console.log(`  ${color.verde('✓')} ${color.gris('ffprobe')}`)

  if (!subir) return

  const rclone = await ejecutar('rclone', ['version'])
  if (rclone.codigo !== 0) morir('No se encontró rclone.', AYUDA_RCLONE)
  console.log(`  ${color.verde('✓')} ${color.gris(rclone.salida.split('\n')[0])}`)
}

/* ── Análisis del maestro ────────────────────────────────────────────────── */

async function analizar(entrada) {
  const { codigo, salida } = await ejecutar('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-show_entries', 'stream=codec_type,width,height',
    '-of', 'json',
    entrada,
  ])

  if (codigo !== 0) {
    morir(`ffprobe no pudo leer ${entrada}. ¿Es un archivo de video válido?`)
  }

  const datos = JSON.parse(salida)
  const video = datos.streams?.find((s) => s.codec_type === 'video')
  const tieneAudio = Boolean(datos.streams?.some((s) => s.codec_type === 'audio'))

  if (!video) morir(`${entrada} no contiene ninguna pista de video.`)

  return {
    duracion: Math.round(Number(datos.format?.duration ?? 0)),
    ancho: video.width,
    alto: video.height,
    tieneAudio,
  }
}

/* ── Detección de barras negras ──────────────────────────────────────────── */

/**
 * Muchos maestros salen del montaje con barras negras incrustadas: una pieza
 * rodada en 3:2 exportada dentro de un marco 16:9 lleva 300 px de negro a cada
 * lado, dentro del propio archivo.
 *
 * Eso en la web se nota mucho: la portada a pantalla completa muestra el negro
 * como si el sitio estuviera roto, y los segmentos gastan bitrate en codificar
 * píxeles negros que nadie necesita.
 *
 * ffmpeg sabe encontrarlas con el filtro cropdetect. Se analizan 4 segundos a
 * partir del timecode del poster —no el primer fotograma, que suele ser un
 * fundido a negro y daría un recorte absurdo— y se toma la última medida, que
 * es la más estable.
 *
 * Solo se aplica si el recorte quita más del 2 %: por debajo de eso suele ser
 * ruido de compresión y recortar haría perder imagen real.
 */
async function detectarRecorte(entrada, timecode, info) {
  const { error } = await ejecutar('ffmpeg', [
    '-hide_banner',
    '-ss', timecode,
    '-i', entrada,
    '-t', '4',
    '-vf', 'cropdetect=24:2:0',
    '-f', 'null', '-',
  ])

  const medidas = error.match(/crop=(\d+):(\d+):(\d+):(\d+)/g)
  if (!medidas?.length) return null

  const [, w, h, x, y] = medidas[medidas.length - 1].match(
    /crop=(\d+):(\d+):(\d+):(\d+)/,
  )

  const ancho = Number(w)
  const alto = Number(h)
  const recortado =
    (info.ancho - ancho) / info.ancho > 0.02 ||
    (info.alto - alto) / info.alto > 0.02

  if (!recortado) return null

  // libx264 exige lados pares.
  return {
    filtro: `crop=${ancho - (ancho % 2)}:${alto - (alto % 2)}:${x}:${y}`,
    ancho,
    alto,
  }
}

/* ── Construcción de los comandos ────────────────────────────────────────── */

/**
 * ffmpeg copia la ruta que le das, tal cual, dentro del manifiesto maestro. En
 * Windows, path.join devuelve barras invertidas y el master.m3u8 acaba
 * apuntando a "v0\playlist.m3u8": una ruta que el sistema de archivos entiende
 * y que la CDN devuelve como 404, porque en una URL la barra invertida no
 * separa nada. El video se sube entero y no se reproduce en ningún sitio.
 *
 * Por eso las rutas que van a los argumentos de HLS se normalizan a barra
 * normal, que Windows también acepta al escribir archivos.
 */
function rutaHls(...partes) {
  return path.join(...partes).replace(/\\/g, '/')
}

function comandoHls({ entrada, salidaHls, formato, tieneAudio, recorte }) {
  const esVertical = formato === 'vertical'

  // split reparte la entrada en tres ramas; cada una se escala a su nivel.
  // El -2 hace que la otra dimensión se calcule sola y quede par, que es lo
  // que exige libx264: con un lado impar, ffmpeg falla sin explicar por qué.
  const divisiones = ESCALERA.map((_, i) => `[v${i}]`).join('')
  const escalados = ESCALERA.map((nivel, i) =>
    esVertical
      ? `[v${i}]scale=w=${nivel.lado}:h=-2[v${i}out]`
      : `[v${i}]scale=w=-2:h=${nivel.lado}[v${i}out]`,
  ).join(';')

  const previo = recorte ? `${recorte.filtro},` : ''
  const filtro = `[0:v]${previo}split=${ESCALERA.length}${divisiones};${escalados}`

  const args = ['-hide_banner', '-y', '-i', entrada, '-filter_complex', filtro]

  ESCALERA.forEach((nivel, i) => {
    args.push(
      '-map', `[v${i}out]`,
      `-c:v:${i}`, 'libx264',
      `-b:v:${i}`, `${nivel.bitrate}k`,
      `-maxrate:v:${i}`, `${nivel.maxrate}k`,
      `-bufsize:v:${i}`, `${nivel.buffer}k`,
      // Grano y sombras: preset lento y un tune que no aplaste el ruido, que
      // aquí es textura buscada y no un defecto.
      `-preset:v:${i}`, 'slow',
      `-profile:v:${i}`, 'high',
      `-tune:v:${i}`, 'grain',
      // Un fotograma clave cada 2 s a 24 fps: los segmentos empiezan siempre
      // en un punto de corte limpio y el cambio de calidad no da tirones.
      `-g:v:${i}`, '48',
      `-keyint_min:v:${i}`, '48',
      `-sc_threshold:v:${i}`, '0',
    )
  })

  if (tieneAudio) {
    ESCALERA.forEach((nivel, i) => {
      args.push('-map', 'a:0', `-c:a:${i}`, 'aac', `-b:a:${i}`, `${nivel.audio}k`, `-ac:${i}`, '2')
    })
  }

  const mapa = ESCALERA.map((_, i) =>
    tieneAudio ? `v:${i},a:${i}` : `v:${i}`,
  ).join(' ')

  args.push(
    '-f', 'hls',
    '-hls_time', '6',
    '-hls_playlist_type', 'vod',
    // Cada segmento se puede decodificar por su cuenta: es lo que permite
    // empezar a ver por la mitad sin descargar lo anterior.
    '-hls_flags', 'independent_segments',
    '-hls_segment_type', 'mpegts',
    '-hls_segment_filename', rutaHls(salidaHls, 'v%v', 'seg_%03d.ts'),
    '-master_pl_name', 'master.m3u8',
    '-var_stream_map', mapa,
    rutaHls(salidaHls, 'v%v', 'playlist.m3u8'),
  )

  return args
}

function comandoPoster({ entrada, timecode, formato, destinoJpg, recorte }) {
  // El lado largo se limita a 1920. Un maestro 4K daría un poster de
  // 3840x2160: pesa el triple y el navegador tiene que decodificarlo entero
  // para pintarlo a la mitad de tamaño. En la portada, ese poster es el LCP.
  const escala =
    formato === 'vertical'
      ? "scale=w=-2:h='min(1920,ih)'"
      : "scale=w='min(1920,iw)':h=-2"

  return [
    '-hide_banner', '-y',
    // -ss antes de -i busca por índice y es casi instantáneo aunque el maestro
    // pese 40 GB. Después de -i, ffmpeg decodificaría desde el principio.
    '-ss', timecode,
    '-i', entrada,
    '-frames:v', '1',
    '-vf', recorte ? `${recorte.filtro},${escala}` : escala,
    '-q:v', '2',
    destinoJpg,
  ]
}

function comandoPosterWebp({ origenJpg, destinoWebp }) {
  return ['-hide_banner', '-y', '-i', origenJpg, '-c:v', 'libwebp', '-quality', '82', destinoWebp]
}

function comandoLoop({ entrada, timecode, formato, destino, recorte }) {
  const escala =
    formato === 'vertical' ? 'scale=w=720:h=-2' : 'scale=w=-2:h=720'

  return [
    '-hide_banner', '-y',
    '-ss', timecode,
    '-t', String(DURACION_LOOP),
    '-i', entrada,
    '-an', // mudo: es un adorno de la rejilla, no una reproducción
    '-vf', recorte ? `${recorte.filtro},${escala},fps=24` : `${escala},fps=24`,
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '26',
    '-profile:v', 'main',
    '-pix_fmt', 'yuv420p',
    // faststart mueve el índice al principio del archivo: sin esto, el
    // navegador tiene que descargarlo entero antes de mostrar el primer cuadro.
    '-movflags', '+faststart',
    destino,
  ]
}

/* ── ffmpeg con barra de progreso ────────────────────────────────────────── */

function correrFfmpeg(args, { duracion, etiqueta }) {
  return new Promise((resolver, rechazar) => {
    const proceso = spawn('ffmpeg', [...args, '-progress', 'pipe:1', '-nostats'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let errores = ''

    proceso.stdout.on('data', (trozo) => {
      const texto = trozo.toString()
      const coincidencia = texto.match(/out_time_ms=(\d+)/g)?.pop()
      if (coincidencia && duracion > 0) {
        const microsegundos = Number(coincidencia.split('=')[1])
        barra(Math.min(1, microsegundos / 1_000_000 / duracion), etiqueta)
      }
    })

    // ffmpeg escribe TODO su registro por stderr, también cuando va bien. Solo
    // se muestra si el proceso termina mal.
    proceso.stderr.on('data', (trozo) => (errores += trozo.toString()))

    proceso.on('error', () => rechazar(new Error('No se pudo ejecutar ffmpeg.')))

    proceso.on('close', (codigo) => {
      if (codigo === 0) {
        barra(1, etiqueta)
        process.stdout.write('\n')
        resolver()
      } else {
        process.stdout.write('\n')
        rechazar(
          new Error(
            `ffmpeg terminó con código ${codigo}.\n\n${errores.split('\n').slice(-25).join('\n')}`,
          ),
        )
      }
    })
  })
}

/* ── Subida ──────────────────────────────────────────────────────────────── */

/**
 * Dos pasadas, y no una, por el Content-Type.
 *
 * rclone deduce el tipo MIME por extensión y no conoce .m3u8: le pone
 * application/octet-stream, y con ese tipo el reproductor no arranca —o peor,
 * el navegador se descarga el manifiesto en vez de reproducirlo—. Es el fallo
 * F2 de SETUP.md. Por eso los manifiestos se suben aparte, con la cabecera
 * puesta a mano.
 *
 * De paso, la caché se separa: los segmentos son inmutables y viven un año; el
 * manifiesto caduca en dos minutos, para poder reprocesar una pieza sin
 * esperar a que expire la CDN.
 */
function comandosSubida({ carpeta, remoto, bucket, slug }) {
  const destino = `${remoto}:${bucket}/projects/${slug}/`

  return [
    {
      titulo: 'Segmentos, poster y loop (caché larga)',
      args: [
        'copy', carpeta, destino,
        '--exclude', '*.m3u8',
        '--header-upload', 'Cache-Control: public, max-age=31536000, immutable',
        '--s3-no-check-bucket',
        '--transfers', '8',
        '--progress',
      ],
    },
    {
      titulo: 'Manifiestos .m3u8 (Content-Type correcto)',
      args: [
        'copy', carpeta, destino,
        '--include', '*.m3u8',
        '--header-upload', 'Content-Type: application/vnd.apple.mpegurl',
        '--header-upload', 'Cache-Control: public, max-age=120',
        '--s3-no-check-bucket',
        '--progress',
      ],
    },
  ]
}

/* ── Verificación ────────────────────────────────────────────────────────── */

async function verificar(url) {
  try {
    const respuesta = await fetch(url, { method: 'HEAD' })
    const tipo = respuesta.headers.get('content-type') ?? '(sin Content-Type)'
    const correcto =
      respuesta.status === 200 && tipo.includes('application/vnd.apple.mpegurl')
    return { ok: correcto, estado: respuesta.status, tipo }
  } catch (e) {
    return { ok: false, estado: 0, tipo: `error de red: ${e.message}` }
  }
}

/* ── Principal ───────────────────────────────────────────────────────────── */

async function principal() {
  const args = leerArgumentos(process.argv.slice(2))

  const entrada = args.input
  const slug = args.slug
  const formato = args.format ?? 'horizontal'
  const timecodePoster = args.poster ?? '00:00:02'
  const bucket = args.bucket ?? 'byframe-media'
  const remoto = args.remoto ?? 'r2'
  const dryRun = Boolean(args['dry-run'])

  /**
   * Modo local: el material queda en public/media y lo sirve el propio Next.js.
   *
   * Rompe a propósito la regla de "ningún video servido desde el sitio", que
   * vale para producción: en local no hay CDN que valga y lo que importa es
   * poder trabajar sin depender de que exista un bucket ni un dominio. Nada de
   * esto se sube al repositorio (public/media está en .gitignore) ni llega a
   * producción.
   */
  const local = Boolean(args.local)
  const subir = !args['no-subir'] && !local

  const carpetaTrabajo = local
    ? path.resolve('public', 'media', 'projects', slug ?? 'sin-slug')
    : path.resolve(args.salida ?? '.transcode', slug ?? 'sin-slug')

  const base = local
    ? '/media'
    : (
        args.base ??
        process.env.NEXT_PUBLIC_MEDIA_BASE_URL ??
        'https://media.byframe.co'
      ).replace(/\/+$/, '')

  /* Validación de argumentos */

  if (!entrada || !slug) {
    morir(
      'Faltan argumentos obligatorios.',
      `Uso:

  npm run transcode -- --input ./master.mov --slug culto-iii \\
                       --format horizontal --poster 00:00:24`,
    )
  }

  if (!existsSync(entrada)) morir(`No existe el archivo: ${entrada}`)

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    morir(
      `El slug "${slug}" no es válido.`,
      'Solo minúsculas, números y guiones simples. Debe coincidir con el slug\ndel proyecto en el panel: es la carpeta dentro del bucket.',
    )
  }

  if (formato !== 'horizontal' && formato !== 'vertical') {
    morir(`--format debe ser "horizontal" o "vertical", no "${formato}".`)
  }

  if (!/^\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(timecodePoster)) {
    morir(`--poster debe tener la forma HH:MM:SS, no "${timecodePoster}".`)
  }

  console.log(color.negrita(`\nByFrame · transcodificación — ${slug}`))
  console.log(color.gris(`  entrada  ${entrada}`))
  console.log(color.gris(`  formato  ${formato}`))
  console.log(color.gris(`  poster   ${timecodePoster}`))
  console.log(
    color.gris(
      local
        ? `  destino  public/media/projects/${slug}/  (servido por Next.js)`
        : `  destino  ${base}/projects/${slug}/`,
    ),
  )
  if (dryRun) console.log(color.amarillo('\n  MODO SIMULACIÓN: no se ejecuta nada.'))

  await comprobarHerramientas({ subir: subir && !dryRun })

  /* Análisis */

  paso('Analizando el maestro')
  const info = dryRun
    ? { duracion: 0, ancho: 1920, alto: 1080, tieneAudio: true }
    : await analizar(entrada)

  console.log(
    color.gris(
      `  ${info.ancho}×${info.alto} · ${info.duracion}s · ${info.tieneAudio ? 'con audio' : 'sin audio'}`,
    ),
  )

  const pareceVertical = info.alto > info.ancho
  if (!dryRun && pareceVertical !== (formato === 'vertical')) {
    aviso(
      `El archivo parece ${pareceVertical ? 'vertical' : 'horizontal'} pero pasaste ` +
        `--format ${formato}. Revisa: la escalera va a salir del lado equivocado.`,
    )
  }

  /* Preparación de carpetas */

  const carpetaHls = path.join(carpetaTrabajo, 'hls')
  const posterJpg = path.join(carpetaTrabajo, 'poster.jpg')
  const posterWebp = path.join(carpetaTrabajo, 'poster.webp')
  const loopMp4 = path.join(carpetaTrabajo, 'loop.mp4')

  paso('Buscando barras negras incrustadas')
  const recorte = args['sin-recorte']
    ? null
    : await detectarRecorte(entrada, timecodePoster, info)

  if (recorte) {
    console.log(
      color.gris(
        `  El maestro lleva pillarbox: la imagen real es ${recorte.ancho}×${recorte.alto}.
` +
          '  Se recorta antes de transcodificar.',
      ),
    )
  } else {
    console.log(color.gris('  Sin barras: se usa el fotograma completo.'))
  }

  const tareas = [
    {
      titulo: `Escalera HLS · ${ESCALERA.map((n) => n.nombre).join(' / ')}`,
      args: comandoHls({
        entrada,
        salidaHls: carpetaHls,
        formato,
        tieneAudio: info.tieneAudio,
        recorte,
      }),
      etiqueta: 'HLS',
    },
    {
      titulo: `Poster desde ${timecodePoster}`,
      args: comandoPoster({
        entrada,
        timecode: timecodePoster,
        formato,
        destinoJpg: posterJpg,
        recorte,
      }),
      etiqueta: 'poster',
      sinProgreso: true,
    },
    {
      titulo: 'Poster en WebP',
      args: comandoPosterWebp({ origenJpg: posterJpg, destinoWebp: posterWebp }),
      etiqueta: 'webp',
      sinProgreso: true,
    },
    {
      titulo: `Loop mudo de ${DURACION_LOOP}s`,
      args: comandoLoop({
        entrada,
        timecode: timecodePoster,
        formato,
        destino: loopMp4,
        recorte,
      }),
      etiqueta: 'loop',
    },
  ]

  if (dryRun) {
    paso('Comandos que se ejecutarían')
    for (const tarea of tareas) {
      console.log(`\n  ${color.negrita(tarea.titulo)}`)
      console.log(color.gris(`  ffmpeg ${tarea.args.join(' ')}`))
    }
    if (subir) {
      for (const orden of comandosSubida({ carpeta: carpetaTrabajo, remoto, bucket, slug })) {
        console.log(`\n  ${color.negrita(orden.titulo)}`)
        console.log(color.gris(`  rclone ${orden.args.join(' ')}`))
      }
    }
    console.log(`\n${color.gris('Simulación terminada. Nada se ejecutó.')}\n`)
    return
  }

  // Carpeta limpia: restos de un intento anterior se subirían junto a lo nuevo
  // y el manifiesto apuntaría a segmentos que ya no corresponden.
  await rm(carpetaTrabajo, { recursive: true, force: true })
  for (let i = 0; i < ESCALERA.length; i++) {
    await mkdir(path.join(carpetaHls, `v${i}`), { recursive: true })
  }

  /* Transcodificación */

  for (const tarea of tareas) {
    paso(tarea.titulo)
    try {
      await correrFfmpeg(tarea.args, {
        duracion: tarea.sinProgreso ? 0 : info.duracion,
        etiqueta: tarea.etiqueta,
      })
    } catch (e) {
      morir(e.message)
    }
  }

  const segmentos = (
    await Promise.all(
      ESCALERA.map((_, i) => readdir(path.join(carpetaHls, `v${i}`))),
    )
  ).flat().filter((f) => f.endsWith('.ts')).length

  console.log(color.gris(`\n  ${segmentos} segmentos generados`))

  /* Subida */

  const hlsUrl = `${base}/projects/${slug}/hls/master.m3u8`
  const posterUrl = `${base}/projects/${slug}/poster.webp`
  const loopUrl = `${base}/projects/${slug}/loop.mp4`

  if (local) {
    aviso('Modo local: nada se sube. Los archivos los sirve Next.js desde public/.')
    console.log(
      color.gris(
        '  Requiere NEXT_PUBLIC_MEDIA_BASE_URL=/media en .env.local y reiniciar el servidor.',
      ),
    )
  }

  if (subir) {
    for (const orden of comandosSubida({ carpeta: carpetaTrabajo, remoto, bucket, slug })) {
      paso(`Subiendo · ${orden.titulo}`)
      const { codigo } = await ejecutar('rclone', orden.args, { silencioso: false })
      if (codigo !== 0) {
        morir(
          'rclone falló al subir.',
          `Comprueba el remoto con:  rclone lsd ${remoto}:\n\n` +
            'Si responde AccessDenied, el token no alcanza este bucket (SETUP.md, A5).',
        )
      }
    }

    paso('Verificando el manifiesto publicado')
    const resultado = await verificar(hlsUrl)

    if (resultado.ok) {
      console.log(`  ${color.verde('✓')} 200 · ${resultado.tipo}`)
    } else {
      aviso(`El manifiesto respondió ${resultado.estado} · ${resultado.tipo}`)
      console.log(
        color.gris(
          '\n  Si el estado es 200 pero el tipo no es application/vnd.apple.mpegurl,\n' +
            '  repite la segunda pasada de subida y purga la caché de Cloudflare\n' +
            '  (SETUP.md, F2). Si es 404, revisa que el dominio apunte al bucket.',
        ),
      )
    }
  } else if (!local) {
    aviso('Subida omitida por --no-subir. Los archivos quedan en:')
    console.log(color.gris(`  ${carpetaTrabajo}`))
  }

  /* Salida para el panel */

  const json = {
    hls_url: hlsUrl,
    poster_url: posterUrl,
    loop_url: loopUrl,
    duration: info.duracion,
  }

  console.log(`\n${color.negrita('Pega esto en el panel, botón «Pegar JSON del script»:')}\n`)
  console.log(JSON.stringify(json, null, 2))
  console.log('')
}

principal().catch((e) => {
  console.error(`\n${color.rojo('✕')} ${e.stack ?? e.message}`)
  process.exit(1)
})
