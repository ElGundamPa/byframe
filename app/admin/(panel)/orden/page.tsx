import { OrdenPortafolio } from '@/components/admin/OrdenPortafolio'
import { resolverMedia } from '@/lib/media'
import { createClient } from '@/lib/supabase/server'

export default async function PaginaOrden() {
  const supabase = await createClient()

  const { data: proyectos, error } = await supabase
    .from('projects')
    .select('id, title, format, poster_url, youtube_id, published')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  const resueltos =
    proyectos?.map((p) => ({ ...p, poster_url: resolverMedia(p.poster_url) })) ?? []

  const horizontales = resueltos.filter((p) => p.format === 'horizontal')
  const verticales = resueltos.filter((p) => p.format === 'vertical')

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
        Orden del portafolio
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Arrastra para reordenar. Se guarda solo, al soltar. Con teclado: Tab hasta
        el asa, Espacio para agarrar, flechas para mover y Espacio para soltar.
      </p>

      {error ? (
        <p role="alert" className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudo cargar: {error.message}
        </p>
      ) : (
        <div className="mt-10 space-y-12">
          <OrdenPortafolio
            titulo="Comerciales"
            formato="horizontal"
            inicial={horizontales}
          />
          <OrdenPortafolio titulo="Social" formato="vertical" inicial={verticales} />
        </div>
      )}
    </div>
  )
}
