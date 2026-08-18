import { GestorEquipo } from '@/components/admin/GestorEquipo'
import { createClient } from '@/lib/supabase/server'

export default async function PaginaEquipo() {
  const supabase = await createClient()

  const { data: equipo, error } = await supabase
    .from('team_members')
    .select('id, name, role, bio, photo_url, links, sort_order')
    .order('sort_order', { ascending: true })

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
        Equipo
      </h1>
      <p className="mt-1 mb-8 text-sm text-neutral-500">
        Perfiles de la sección Nosotros, en el orden en que se muestran.
      </p>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudo cargar: {error.message}
        </p>
      ) : (
        <GestorEquipo inicial={equipo ?? []} />
      )}
    </div>
  )
}
