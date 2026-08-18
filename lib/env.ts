/**
 * lib/env.ts
 *
 * Lectura centralizada de variables de entorno.
 *
 * Dos reglas que este archivo hace cumplir:
 *
 * 1. Las variables NEXT_PUBLIC_ se leen por su nombre completo y literal.
 *    Next.js las sustituye en tiempo de compilación mediante análisis estático
 *    del texto: `process.env.NEXT_PUBLIC_SUPABASE_URL` se reemplaza por su
 *    valor, pero `process.env[nombreDinamico]` NO. Por eso no hay bucles ni
 *    acceso por índice aquí.
 *
 * 2. Las variables de servidor se leen dentro de funciones, nunca en el ámbito
 *    del módulo. Así, si un componente de cliente importa este archivo por
 *    error, el bundler no arrastra el secreto: solo se evalúan al llamarlas
 *    desde el servidor.
 */

/**
 * Devuelve el valor por defecto también cuando la variable está definida pero
 * vacía.
 *
 * `process.env.X ?? 'defecto'` NO cubre ese caso: `??` solo actúa con null o
 * undefined, y una cadena vacía pasa de largo. En un panel de despliegue es
 * facilísimo dejar una variable creada y sin valor, y el resultado era un
 * `new URL('')` que tumbaba la compilación entera con un críptico
 * "Invalid URL".
 */
function conDefecto(valor: string | undefined, defecto: string): string {
  const limpio = valor?.trim()
  return limpio && limpio !== '' ? limpio : defecto
}

function requerida(valor: string | undefined, nombre: string): string {
  if (!valor || valor.trim() === '') {
    throw new Error(
      `Falta la variable de entorno ${nombre}. ` +
        `Revisa .env.local — la guía está en SETUP.md, Parte C.`,
    )
  }
  return valor
}

/* ── Públicas: viajan al navegador ──────────────────────────────────────── */

export const SUPABASE_URL = requerida(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  'NEXT_PUBLIC_SUPABASE_URL',
)

export const SUPABASE_ANON_KEY = requerida(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
)

/** Base de los medios, sin barra final. */
export const MEDIA_BASE_URL = conDefecto(
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
  'https://media.byframe.co',
).replace(/\/+$/, '')

export const SITE_URL = conDefecto(
  process.env.NEXT_PUBLIC_SITE_URL,
  'http://localhost:3000',
).replace(/\/+$/, '')

/**
 * SITE_URL como objeto URL, para metadataBase.
 *
 * Si alguien escribe algo que no es una URL —un dominio sin protocolo, por
 * ejemplo— se cae a localhost en vez de romper la compilación. Los metadatos
 * saldrán mal, que es un problema menor y visible; un despliegue que no
 * compila es un problema mayor y opaco.
 */
export function urlDelSitio(): URL {
  try {
    return new URL(SITE_URL)
  } catch {
    return new URL('http://localhost:3000')
  }
}

/* ── De servidor: nunca deben llegar al navegador ───────────────────────── */

/**
 * Llave service_role. Ignora RLS por completo.
 * Solo puede invocarse desde Route Handlers, Server Actions o Server
 * Components. Se usará a partir de la Fase 4.
 */
export function getServiceRoleKey(): string {
  return requerida(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    'SUPABASE_SERVICE_ROLE_KEY',
  )
}

/** Credenciales de R2 para firmar URLs de subida. Se usarán en la Fase 4. */
export function getR2Config() {
  return {
    accountId: requerida(process.env.R2_ACCOUNT_ID, 'R2_ACCOUNT_ID'),
    accessKeyId: requerida(process.env.R2_ACCESS_KEY_ID, 'R2_ACCESS_KEY_ID'),
    secretAccessKey: requerida(
      process.env.R2_SECRET_ACCESS_KEY,
      'R2_SECRET_ACCESS_KEY',
    ),
    bucket: requerida(process.env.R2_BUCKET_NAME, 'R2_BUCKET_NAME'),
    endpoint: requerida(process.env.R2_ENDPOINT, 'R2_ENDPOINT'),
  }
}

export function getRevalidateSecret(): string {
  return requerida(process.env.REVALIDATE_SECRET, 'REVALIDATE_SECRET')
}
