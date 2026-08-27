import { z } from 'zod'

import { extraerIdDeYoutube } from '@/lib/youtube'

/**
 * lib/admin/esquemas.ts
 *
 * Validación con Zod, compartida por cliente y servidor.
 *
 * Un solo esquema para los dos lados, y no dos parecidos: si divergen, el
 * formulario deja pasar algo que el servidor rechaza —o al revés— y el usuario
 * se queda mirando un error que no puede corregir. La validación del cliente es
 * comodidad; la del servidor es la que manda, porque una petición puede llegar
 * sin pasar por el formulario.
 */

const textoOpcional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()

/** Debe coincidir con el CHECK de projects.slug y con lo que acepta el script. */
export const esquemaSlug = z
  .string()
  .trim()
  .min(1, 'El slug no puede estar vacío.')
  .max(80, 'El slug es demasiado largo.')
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'Solo minúsculas, números y guiones simples. Es la carpeta del proyecto en el bucket.',
  )

/** Acepta una ruta absoluta a los medios o una relativa (modo local). */
const esquemaRutaMedia = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .refine(
    (v) => v === null || v.startsWith('http') || v.startsWith('/'),
    'Debe ser una URL completa o una ruta que empiece por /.',
  )

export const esquemaCredito = z.object({
  id: z.string().optional(),
  role: z.string().trim().min(1, 'El rol no puede estar vacío.').max(120),
  name: z.string().trim().min(1, 'El nombre no puede estar vacío.').max(160),
})

/**
 * Acepta el id suelto o cualquier forma de enlace de YouTube, y guarda siempre
 * el id. Nadie copia once caracteres a mano: se copia el enlace.
 */
const esquemaYoutube = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : extraerIdDeYoutube(v)))
  .nullable()
  .refine(
    (v) => v === null || /^[A-Za-z0-9_-]{11}$/.test(v),
    'No reconozco ese enlace de YouTube. Pega la URL del video o su id de 11 caracteres.',
  )

export const esquemaProyecto = z.object({
  id: z.string().uuid().optional(),
  slug: esquemaSlug,
  title: z.string().trim().min(1, 'El título es obligatorio.').max(160),
  client: textoOpcional,
  year: z
    .number()
    .int()
    .min(1990, 'Año demasiado antiguo.')
    .max(2100, 'Año demasiado lejano.')
    .nullable(),
  format: z.enum(['horizontal', 'vertical']),
  description: textoOpcional,
  hls_url: esquemaRutaMedia,
  poster_url: esquemaRutaMedia,
  loop_url: esquemaRutaMedia,
  youtube_id: esquemaYoutube,
  duration: z.number().int().min(0).nullable(),
  published: z.boolean(),
  credits: z.array(esquemaCredito).max(60),
})

export type EntradaProyecto = z.input<typeof esquemaProyecto>
export type ProyectoValidado = z.output<typeof esquemaProyecto>

/**
 * JSON que imprime scripts/transcode.mjs.
 *
 * Se valida igual que todo lo demás: ese texto llega de un pegado manual y bien
 * puede ser un JSON de otra cosa.
 */
export const esquemaJsonDelScript = z.object({
  hls_url: z.string(),
  poster_url: z.string(),
  loop_url: z.string(),
  duration: z.number().int().min(0).optional(),
})

export const esquemaMiembro = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(160),
  role: textoOpcional,
  bio: textoOpcional,
  photo_url: esquemaRutaMedia,
  links: z.record(z.string(), z.string().trim().nullable()).default({}),
})

export const esquemaHero = z.object({
  project_id: z.string().uuid().nullable(),
  custom_video_url: esquemaRutaMedia,
  custom_poster_url: esquemaRutaMedia,
  overlay_text: textoOpcional,
})

export const esquemaAjustes = z.object({
  contacto: z.object({
    email: z.string().trim().email('Correo no válido.').or(z.literal('')),
    whatsapp: z.string().trim().max(40),
    ciudad: z.string().trim().max(120),
  }),
  redes: z.object({
    instagram: z.string().trim().url('URL no válida.').or(z.literal('')),
    vimeo: z.string().trim().url('URL no válida.').or(z.literal('')),
    youtube: z.string().trim().url('URL no válida.').or(z.literal('')),
  }),
  nosotros: z.object({
    titulo: z.string().trim().max(120),
    texto: z.string().trim().max(4000),
  }),
  seo: z.object({
    title: z.string().trim().max(160),
    description: z.string().trim().max(320),
    og_image: z.string().trim(),
  }),
})

export type AjustesValidados = z.output<typeof esquemaAjustes>

/** Reordenamiento: lista de ids en su nuevo orden. */
export const esquemaOrden = z.object({
  format: z.enum(['horizontal', 'vertical']),
  ids: z.array(z.string().uuid()).max(500),
})

/**
 * Petición de URL prefirmada para subir.
 *
 * El tipo MIME y el tamaño se validan también aquí, en el servidor: un límite
 * que solo vive en el cliente no es un límite, porque la petición se puede
 * hacer sin abrir el formulario.
 */
export const TIPOS_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'video/mp4',
] as const

/** 200 MB. Un loop de 6 s pesa 2; un póster, menos de uno. */
export const TAMANO_MAXIMO = 200 * 1024 * 1024

export const esquemaSubida = z.object({
  slug: esquemaSlug,
  // Qué se sube. La carpeta HLS nunca: esa va siempre por el script.
  tipo: z.enum(['poster', 'loop', 'equipo', 'sitio']),
  nombreArchivo: z.string().trim().min(1).max(200),
  contentType: z.enum(TIPOS_PERMITIDOS),
  tamano: z.number().int().min(1).max(TAMANO_MAXIMO),
})
