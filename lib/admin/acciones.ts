'use server'

/**
 * lib/admin/acciones.ts
 *
 * Server Actions del panel.
 *
 * Tres reglas que cumplen todas:
 *
 * 1. Comprueban la sesión antes de tocar nada. El middleware ya protege /admin,
 *    pero una Server Action es un endpoint de red: se puede invocar sin pasar
 *    por ninguna página.
 * 2. Validan con Zod. Lo que llega del formulario es texto sin garantías.
 * 3. Revalidan las etiquetas afectadas. Sin eso, el sitio público seguiría
 *    sirviendo la versión cacheada y el cambio no se vería hasta dentro de una
 *    hora.
 *
 * Escriben con el cliente de sesión, no con service_role: así RLS sigue
 * actuando como última red de seguridad.
 */

import { revalidateTag } from 'next/cache'

import { TAGS } from '@/lib/cache-tags'
import { createClient, getUsuarioActual } from '@/lib/supabase/server'
import {
  esquemaAjustes,
  esquemaHero,
  esquemaMiembro,
  esquemaOrden,
  esquemaProyecto,
} from '@/lib/admin/esquemas'

export type Resultado<T = undefined> =
  | { ok: true; datos?: T }
  | { ok: false; error: string; campos?: Record<string, string> }

async function exigirSesion() {
  const usuario = await getUsuarioActual()
  if (!usuario) throw new Error('Sesión no válida. Vuelve a iniciar sesión.')
  return usuario
}

/** Convierte los errores de Zod en un mapa campo → mensaje para el formulario. */
function erroresDeZod(error: {
  issues: { path: PropertyKey[]; message: string }[]
}) {
  const campos: Record<string, string> = {}
  for (const issue of error.issues) {
    const clave = issue.path.join('.')
    if (!campos[clave]) campos[clave] = issue.message
  }
  return campos
}

/* ── Proyectos ──────────────────────────────────────────────────────────── */

export async function guardarProyecto(
  entrada: unknown,
): Promise<Resultado<{ id: string }>> {
  try {
    await exigirSesion()

    const analisis = esquemaProyecto.safeParse(entrada)
    if (!analisis.success) {
      return {
        ok: false,
        error: 'Revisa los campos marcados.',
        campos: erroresDeZod(analisis.error),
      }
    }

    const { credits, id, ...proyecto } = analisis.data
    const supabase = await createClient()

    const { data: guardado, error } = id
      ? await supabase
          .from('projects')
          .update(proyecto)
          .eq('id', id)
          .select('id, slug')
          .single()
      : await supabase
          .from('projects')
          .insert(proyecto)
          .select('id, slug')
          .single()

    if (error) {
      // 23505 es violación de unicidad: el único índice único aquí es el slug.
      if (error.code === '23505') {
        return {
          ok: false,
          error: 'Ya existe un proyecto con ese slug.',
          campos: { slug: 'Este slug ya está en uso.' },
        }
      }
      return { ok: false, error: `No se pudo guardar: ${error.message}` }
    }

    /*
     * Los créditos se reemplazan enteros en vez de calcular altas, bajas y
     * cambios. Son cinco o seis filas por proyecto: la diferencia de coste es
     * nula y la lógica incremental es donde aparecen los duplicados y los
     * huérfanos.
     */
    await supabase.from('project_credits').delete().eq('project_id', guardado.id)

    if (credits.length > 0) {
      const { error: errorCreditos } = await supabase
        .from('project_credits')
        .insert(
          credits.map((credito, indice) => ({
            project_id: guardado.id,
            role: credito.role,
            name: credito.name,
            sort_order: indice,
          })),
        )

      if (errorCreditos) {
        return {
          ok: false,
          error: `El proyecto se guardó, pero los créditos no: ${errorCreditos.message}`,
        }
      }
    }

    revalidateTag(TAGS.proyectos)
    revalidateTag(TAGS.hero)

    return { ok: true, datos: { id: guardado.id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error inesperado.' }
  }
}

/**
 * Eliminación lógica. Nunca se borra la fila: el material audiovisual es caro
 * de reponer y un borrado accidental no tendría vuelta atrás.
 */
export async function eliminarProyecto(id: string): Promise<Resultado> {
  try {
    await exigirSesion()
    const supabase = await createClient()

    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: new Date().toISOString(), published: false })
      .eq('id', id)

    if (error) return { ok: false, error: `No se pudo eliminar: ${error.message}` }

    revalidateTag(TAGS.proyectos)
    revalidateTag(TAGS.hero)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error inesperado.' }
  }
}

export async function restaurarProyecto(id: string): Promise<Resultado> {
  try {
    await exigirSesion()
    const supabase = await createClient()

    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: null })
      .eq('id', id)

    if (error) return { ok: false, error: `No se pudo restaurar: ${error.message}` }

    revalidateTag(TAGS.proyectos)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error inesperado.' }
  }
}

export async function cambiarPublicacion(
  id: string,
  publicado: boolean,
): Promise<Resultado> {
  try {
    await exigirSesion()
    const supabase = await createClient()

    const { error } = await supabase
      .from('projects')
      .update({ published: publicado })
      .eq('id', id)

    if (error) return { ok: false, error: `No se pudo cambiar el estado: ${error.message}` }

    revalidateTag(TAGS.proyectos)
    revalidateTag(TAGS.hero)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error inesperado.' }
  }
}

/* ── Orden del portafolio ───────────────────────────────────────────────── */

export async function guardarOrden(entrada: unknown): Promise<Resultado> {
  try {
    await exigirSesion()

    const analisis = esquemaOrden.safeParse(entrada)
    if (!analisis.success) return { ok: false, error: 'Orden no válido.' }

    const supabase = await createClient()

    /*
     * Una actualización por fila. Con dos docenas de proyectos es
     * instantáneo, y evita el upsert masivo, que exigiría enviar todas las
     * columnas obligatorias de cada fila y podría pisar cambios hechos en otra
     * pestaña.
     */
    const resultados = await Promise.all(
      analisis.data.ids.map((id, indice) =>
        supabase.from('projects').update({ sort_order: indice }).eq('id', id),
      ),
    )

    const fallo = resultados.find((r) => r.error)
    if (fallo?.error) {
      return { ok: false, error: `No se pudo guardar el orden: ${fallo.error.message}` }
    }

    revalidateTag(TAGS.proyectos)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error inesperado.' }
  }
}

/* ── Hero ───────────────────────────────────────────────────────────────── */

export async function guardarHero(entrada: unknown): Promise<Resultado> {
  try {
    await exigirSesion()

    const analisis = esquemaHero.safeParse(entrada)
    if (!analisis.success) {
      return {
        ok: false,
        error: 'Revisa los campos marcados.',
        campos: erroresDeZod(analisis.error),
      }
    }

    const hero = analisis.data
    if (!hero.project_id && !hero.custom_video_url) {
      return {
        ok: false,
        error:
          'Elige un proyecto o pega la ruta de una pieza propia: sin ninguna de las dos, la portada se queda en negro.',
      }
    }

    const supabase = await createClient()

    // La tabla tiene un índice único que garantiza una sola fila: si existe se
    // actualiza, y si no, se crea.
    const { data: existente } = await supabase
      .from('home_hero')
      .select('id')
      .limit(1)
      .maybeSingle()

    const { error } = existente
      ? await supabase.from('home_hero').update(hero).eq('id', existente.id)
      : await supabase.from('home_hero').insert(hero)

    if (error) return { ok: false, error: `No se pudo guardar el hero: ${error.message}` }

    revalidateTag(TAGS.hero)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error inesperado.' }
  }
}

/* ── Equipo ─────────────────────────────────────────────────────────────── */

export async function guardarMiembro(entrada: unknown): Promise<Resultado> {
  try {
    await exigirSesion()

    const analisis = esquemaMiembro.safeParse(entrada)
    if (!analisis.success) {
      return {
        ok: false,
        error: 'Revisa los campos marcados.',
        campos: erroresDeZod(analisis.error),
      }
    }

    const { id, links, ...miembro } = analisis.data

    // Los enlaces vacíos se quitan en vez de guardarse como cadena vacía: si no,
    // el sitio público pintaría un enlace a ninguna parte.
    const enlaces = Object.fromEntries(
      Object.entries(links).filter(([, valor]) => valor && valor.trim() !== ''),
    )

    const supabase = await createClient()
    const { error } = id
      ? await supabase
          .from('team_members')
          .update({ ...miembro, links: enlaces })
          .eq('id', id)
      : await supabase.from('team_members').insert({ ...miembro, links: enlaces })

    if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` }

    revalidateTag(TAGS.equipo)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error inesperado.' }
  }
}

export async function eliminarMiembro(id: string): Promise<Resultado> {
  try {
    await exigirSesion()
    const supabase = await createClient()

    const { error } = await supabase.from('team_members').delete().eq('id', id)
    if (error) return { ok: false, error: `No se pudo eliminar: ${error.message}` }

    revalidateTag(TAGS.equipo)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error inesperado.' }
  }
}

export async function guardarOrdenEquipo(ids: string[]): Promise<Resultado> {
  try {
    await exigirSesion()
    const supabase = await createClient()

    const resultados = await Promise.all(
      ids.map((id, indice) =>
        supabase.from('team_members').update({ sort_order: indice }).eq('id', id),
      ),
    )

    const fallo = resultados.find((r) => r.error)
    if (fallo?.error) {
      return { ok: false, error: `No se pudo guardar el orden: ${fallo.error.message}` }
    }

    revalidateTag(TAGS.equipo)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error inesperado.' }
  }
}

/* ── Ajustes del sitio ──────────────────────────────────────────────────── */

export async function guardarAjustes(entrada: unknown): Promise<Resultado> {
  try {
    await exigirSesion()

    const analisis = esquemaAjustes.safeParse(entrada)
    if (!analisis.success) {
      return {
        ok: false,
        error: 'Revisa los campos marcados.',
        campos: erroresDeZod(analisis.error),
      }
    }

    const supabase = await createClient()
    const ajustes = analisis.data

    const filas = Object.entries(ajustes).map(([key, value]) => ({ key, value }))

    const { error } = await supabase
      .from('site_settings')
      .upsert(filas, { onConflict: 'key' })

    if (error) return { ok: false, error: `No se pudieron guardar: ${error.message}` }

    revalidateTag(TAGS.ajustes)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error inesperado.' }
  }
}
