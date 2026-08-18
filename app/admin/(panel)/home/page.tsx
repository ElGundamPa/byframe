import { FormularioHero } from '@/components/admin/FormularioHero'
import { createClient } from '@/lib/supabase/server'

export default async function PaginaHome() {
  const supabase = await createClient()

  const [{ data: hero }, { data: proyectos }] = await Promise.all([
    supabase
      .from('home_hero')
      .select('project_id, custom_video_url, custom_poster_url, overlay_text')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('projects')
      .select('id, title, format, published')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true }),
  ])

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
        Portada
      </h1>
      <p className="mt-1 mb-8 text-sm text-neutral-500">
        Qué video se ve al entrar al sitio.
      </p>

      <FormularioHero
        opciones={proyectos ?? []}
        inicial={{
          project_id: hero?.project_id ?? null,
          custom_video_url: hero?.custom_video_url ?? '',
          custom_poster_url: hero?.custom_poster_url ?? '',
          overlay_text: hero?.overlay_text ?? '',
        }}
      />
    </div>
  )
}
