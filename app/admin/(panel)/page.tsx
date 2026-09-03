import Link from 'next/link'

import { ListaProyectos } from '@/components/admin/ListaProyectos'
import { resolverMedia } from '@/lib/media'
import { createClient } from '@/lib/supabase/server'

export default async function PaginaResumen({
  searchParams,
}: {
  searchParams: Promise<{ papelera?: string }>
}) {
  const { papelera } = await searchParams
  const verPapelera = papelera === '1'

  const supabase = await createClient()

  const consulta = supabase
    .from('projects')
    .select(
      'id, slug, title, client, year, format, poster_url, youtube_id, published, created_at, deleted_at',
    )
    .order('sort_order', { ascending: true })

  const { data: filas, error } = verPapelera
    ? await consulta.not('deleted_at', 'is', null)
    : await consulta.is('deleted_at', null)

  /*
   * Las rutas se guardan en su forma canónica (media.byframe.co) y quien las
   * traduce al origen real es lib/media.ts. El sitio público ya lo hacía; el
   * panel no, y por eso las miniaturas salían todas en gris.
   */
  const proyectos = filas?.map((fila) => ({
    ...fila,
    poster_url: resolverMedia(fila.poster_url),
  }))

  const publicados = proyectos?.filter((p) => p.published).length ?? 0
  const borradores = (proyectos?.length ?? 0) - publicados

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            {verPapelera ? 'Papelera' : 'Proyectos'}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {verPapelera
              ? `${proyectos?.length ?? 0} eliminados`
              : `${publicados} publicados · ${borradores} borradores`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={verPapelera ? '/admin' : '/admin?papelera=1'}
            className="inline-flex h-11 items-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            {verPapelera ? 'Volver' : 'Papelera'}
          </Link>
          {!verPapelera ? (
            <Link
              href="/admin/proyectos/nuevo"
              className="inline-flex h-11 items-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white transition hover:opacity-90"
            >
              Nuevo proyecto
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudieron cargar los proyectos: {error.message}
        </p>
      ) : (
        <ListaProyectos proyectos={proyectos ?? []} enPapelera={verPapelera} />
      )}
    </div>
  )
}
