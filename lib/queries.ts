/**
 * lib/queries.ts
 *
 * Consultas de lectura del sitio público.
 *
 * Todas usan el cliente anónimo sin cookies, así que RLS ya filtra borradores y
 * eliminados: los `.eq('published', true)` que ves abajo son redundantes a
 * propósito. Son defensa en profundidad y, de paso, permiten a Postgres usar
 * los índices parciales de 0002_indexes.sql.
 *
 * Cada consulta va envuelta en unstable_cache con su etiqueta. Así la página se
 * sirve estática hasta que el panel guarde un cambio y dispare revalidateTag.
 */

import { unstable_cache } from 'next/cache'

import { REVALIDAR_CADA, TAGS } from '@/lib/cache-tags'
import { resolverMedia } from '@/lib/media'
import { createPublicClient } from '@/lib/supabase/public'
import type { ProjectFormat } from '@/types/database'

/** Proyectos publicados de un formato, en el orden definido en el panel. */
export const getProyectosPorFormato = unstable_cache(
  async (formato: ProjectFormat) => {
    const supabase = createPublicClient()

    // Se traen también hls_url, descripción y créditos: son pocos bytes y
    // permiten abrir el detalle en un modal sin una segunda petición, que en
    // móvil se nota como medio segundo de pantalla vacía.
    const { data, error } = await supabase
      .from('projects')
      .select(
        `
          id, slug, title, client, year, format, description,
          hls_url, poster_url, loop_url, duration, sort_order,
          project_credits (id, role, name, sort_order)
        `,
      )
      .eq('format', formato)
      .eq('published', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })

    if (error) {
      throw new Error(`No se pudieron cargar los proyectos: ${error.message}`)
    }

    return (data ?? []).map((proyecto) => ({
      ...proyecto,
      hls_url: resolverMedia(proyecto.hls_url),
      poster_url: resolverMedia(proyecto.poster_url),
      loop_url: resolverMedia(proyecto.loop_url),
      project_credits: [...(proyecto.project_credits ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order,
      ),
    }))
  },
  ['proyectos-por-formato'],
  { tags: [TAGS.proyectos], revalidate: REVALIDAR_CADA },
)

/** Slugs publicados, para generateStaticParams y el sitemap. */
export const getSlugsPublicados = unstable_cache(
  async () => {
    const supabase = createPublicClient()

    const { data, error } = await supabase
      .from('projects')
      .select('slug, updated_at')
      .eq('published', true)
      .is('deleted_at', null)

    if (error) {
      throw new Error(`No se pudieron cargar los slugs: ${error.message}`)
    }
    return data ?? []
  },
  ['slugs-publicados'],
  { tags: [TAGS.proyectos], revalidate: REVALIDAR_CADA },
)

/** Detalle de un proyecto con sus créditos. Null si no existe o no es público. */
export const getProyectoPorSlug = unstable_cache(
  async (slug: string) => {
    const supabase = createPublicClient()

    const { data, error } = await supabase
      .from('projects')
      .select(
        `
          id, slug, title, client, year, format, description,
          hls_url, poster_url, loop_url, duration,
          project_credits (id, role, name, sort_order)
        `,
      )
      .eq('slug', slug)
      .eq('published', true)
      .is('deleted_at', null)
      .maybeSingle()

    // PGRST116 es "no se encontró ninguna fila": no es un error, es un 404.
    if (error && error.code !== 'PGRST116') {
      throw new Error(`No se pudo cargar el proyecto: ${error.message}`)
    }
    if (!data) return null

    return {
      ...data,
      hls_url: resolverMedia(data.hls_url),
      poster_url: resolverMedia(data.poster_url),
      loop_url: resolverMedia(data.loop_url),
      project_credits: [...(data.project_credits ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order,
      ),
    }
  },
  ['proyecto-por-slug'],
  { tags: [TAGS.proyectos], revalidate: REVALIDAR_CADA },
)

/** El video de portada. Null si aún no se ha configurado. */
export const getHero = unstable_cache(
  async () => {
    const supabase = createPublicClient()

    const { data, error } = await supabase
      .from('home_hero')
      .select(
        `
          id, custom_video_url, custom_poster_url, overlay_text,
          projects (slug, title, hls_url, poster_url, loop_url)
        `,
      )
      .limit(1)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`No se pudo cargar el hero: ${error.message}`)
    }
    if (!data) return null

    return {
      ...data,
      custom_video_url: resolverMedia(data.custom_video_url),
      custom_poster_url: resolverMedia(data.custom_poster_url),
      projects: data.projects
        ? {
            ...data.projects,
            hls_url: resolverMedia(data.projects.hls_url),
            poster_url: resolverMedia(data.projects.poster_url),
            loop_url: resolverMedia(data.projects.loop_url),
          }
        : null,
    }
  },
  ['hero'],
  { tags: [TAGS.hero, TAGS.proyectos], revalidate: REVALIDAR_CADA },
)

/** Perfiles de la sección Nosotros. */
export const getEquipo = unstable_cache(
  async () => {
    const supabase = createPublicClient()

    const { data, error } = await supabase
      .from('team_members')
      .select('id, name, role, bio, photo_url, links, sort_order')
      .order('sort_order', { ascending: true })

    if (error) throw new Error(`No se pudo cargar el equipo: ${error.message}`)

    return (data ?? []).map((persona) => ({
      ...persona,
      photo_url: resolverMedia(persona.photo_url),
    }))
  },
  ['equipo'],
  { tags: [TAGS.equipo], revalidate: REVALIDAR_CADA },
)

/**
 * Forma de los ajustes que consumen las páginas. Todo es opcional: el panel
 * puede dejarlos a medias y el sitio no debe romperse por eso.
 */
export type Ajustes = {
  contacto?: { email?: string; whatsapp?: string; ciudad?: string }
  redes?: { instagram?: string; vimeo?: string; youtube?: string | null }
  nosotros?: { titulo?: string; texto?: string }
  seo?: { title?: string; description?: string; og_image?: string }
}

/** Ajustes del sitio, ya convertidos a un objeto indexado por clave. */
export const getAjustes = unstable_cache(
  async (): Promise<Ajustes> => {
    const supabase = createPublicClient()

    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')

    if (error) {
      throw new Error(`No se pudieron cargar los ajustes: ${error.message}`)
    }

    return Object.fromEntries(
      (data ?? []).map((fila) => [fila.key, fila.value]),
    ) as Ajustes
  },
  ['ajustes'],
  { tags: [TAGS.ajustes], revalidate: REVALIDAR_CADA },
)
