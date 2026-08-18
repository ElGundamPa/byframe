import {
  FormularioAjustes,
  type ValoresAjustes,
} from '@/components/admin/FormularioAjustes'
import { createClient } from '@/lib/supabase/server'

/** Un ajuste que aún no existe no debe romper el formulario: se rellena vacío. */
function leer<T extends Record<string, string>>(
  filas: { key: string; value: unknown }[] | null,
  clave: string,
  porDefecto: T,
): T {
  const valor = filas?.find((fila) => fila.key === clave)?.value
  if (!valor || typeof valor !== 'object') return porDefecto

  const guardado = valor as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(porDefecto).map((campo) => [
      campo,
      typeof guardado[campo] === 'string' ? guardado[campo] : '',
    ]),
  ) as T
}

export default async function PaginaAjustes() {
  const supabase = await createClient()
  const { data: filas, error } = await supabase
    .from('site_settings')
    .select('key, value')

  const inicial: ValoresAjustes = {
    contacto: leer(filas, 'contacto', { email: '', whatsapp: '', ciudad: '' }),
    redes: leer(filas, 'redes', { instagram: '', vimeo: '', youtube: '' }),
    nosotros: leer(filas, 'nosotros', { titulo: '', texto: '' }),
    seo: leer(filas, 'seo', { title: '', description: '', og_image: '' }),
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
        Ajustes del sitio
      </h1>
      <p className="mt-1 mb-8 text-sm text-neutral-500">
        Datos de contacto, redes, texto de Nosotros y metadatos por defecto.
      </p>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudieron cargar: {error.message}
        </p>
      ) : (
        <FormularioAjustes inicial={inicial} />
      )}
    </div>
  )
}
