import Link from 'next/link'
import { notFound } from 'next/navigation'

import { FormularioProyecto } from '@/components/admin/FormularioProyecto'
import { createClient } from '@/lib/supabase/server'

export default async function PaginaEditarProyecto({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: proyecto } = await supabase
    .from('projects')
    .select(
      `
        id, slug, title, client, year, format, description,
        hls_url, poster_url, loop_url, youtube_id, duration, published, deleted_at,
        project_credits (id, role, name, sort_order)
      `,
    )
    .eq('id', id)
    .maybeSingle()

  if (!proyecto) notFound()

  const creditos = [...(proyecto.project_credits ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((credito) => ({ id: credito.id, role: credito.role, name: credito.name }))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin"
          className="text-sm text-neutral-500 underline-offset-4 hover:underline"
        >
          ← Proyectos
        </Link>

        {proyecto.published ? (
          <a
            href={`/proyecto/${proyecto.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-neutral-500 underline-offset-4 hover:underline"
          >
            Ver en el sitio ↗
          </a>
        ) : null}
      </div>

      <h1 className="mt-4 text-xl font-semibold tracking-tight text-neutral-900">
        {proyecto.title}
      </h1>

      {proyecto.deleted_at ? (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Este proyecto está en la papelera. Restáuralo desde el listado para que
          vuelva a verse.
        </p>
      ) : null}

      <div className="mt-8">
        <FormularioProyecto
          esNuevo={false}
          inicial={{
            id: proyecto.id,
            slug: proyecto.slug,
            title: proyecto.title,
            client: proyecto.client ?? '',
            year: proyecto.year !== null ? String(proyecto.year) : '',
            format: proyecto.format,
            description: proyecto.description ?? '',
            hls_url: proyecto.hls_url ?? '',
            poster_url: proyecto.poster_url ?? '',
            loop_url: proyecto.loop_url ?? '',
            youtube_id: proyecto.youtube_id ?? '',
            duration: proyecto.duration !== null ? String(proyecto.duration) : '',
            published: proyecto.published,
            credits: creditos,
          }}
        />
      </div>
    </div>
  )
}
