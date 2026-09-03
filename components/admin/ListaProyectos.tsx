'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import {
  cambiarPublicacion,
  eliminarProyecto,
  restaurarProyecto,
} from '@/lib/admin/acciones'
import { posterDeYoutube } from '@/lib/youtube'
import { AvisoEstado, Boton, ConfirmarBorrado, type Estado } from './ui'

type Fila = {
  id: string
  slug: string
  title: string
  client: string | null
  year: number | null
  format: 'horizontal' | 'vertical'
  poster_url: string | null
  youtube_id: string | null
  published: boolean
  created_at: string
  deleted_at: string | null
}

export function ListaProyectos({
  proyectos,
  enPapelera,
}: {
  proyectos: Fila[]
  enPapelera: boolean
}) {
  const router = useRouter()
  const [pendiente, iniciarTransicion] = useTransition()
  const [busqueda, setBusqueda] = useState('')
  const [formato, setFormato] = useState<'todos' | 'horizontal' | 'vertical'>('todos')
  const [estado, setEstado] = useState<Estado>({ tipo: 'inactivo' })
  const [porEliminar, setPorEliminar] = useState<Fila | null>(null)

  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return proyectos.filter((proyecto) => {
      if (formato !== 'todos' && proyecto.format !== formato) return false
      if (!termino) return true
      // Se busca también por slug y por cliente: es como se busca de verdad
      // cuando hay cuarenta piezas y no recuerdas el título exacto.
      return [proyecto.title, proyecto.slug, proyecto.client ?? '']
        .join(' ')
        .toLowerCase()
        .includes(termino)
    })
  }, [proyectos, busqueda, formato])

  const ejecutar = (accion: () => Promise<{ ok: boolean; error?: string }>, exito: string) => {
    setEstado({ tipo: 'guardando' })
    iniciarTransicion(async () => {
      const resultado = await accion()
      if (resultado.ok) {
        setEstado({ tipo: 'exito', mensaje: exito })
        router.refresh()
      } else {
        setEstado({ tipo: 'error', mensaje: resultado.error ?? 'No se pudo completar.' })
      }
    })
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por título, cliente o slug"
          aria-label="Buscar proyectos"
          className="h-11 w-full max-w-xs rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-900"
        />

        <div className="flex gap-1" role="group" aria-label="Filtrar por formato">
          {(['todos', 'horizontal', 'vertical'] as const).map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => setFormato(opcion)}
              aria-pressed={formato === opcion}
              className={`h-11 rounded-md px-3 text-sm capitalize transition ${
                formato === opcion
                  ? 'bg-neutral-900 text-white'
                  : 'border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {opcion}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          <AvisoEstado estado={estado} />
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="mt-10 rounded-md border border-dashed border-neutral-300 py-14 text-center text-sm text-neutral-500">
          {proyectos.length === 0
            ? enPapelera
              ? 'La papelera está vacía.'
              : 'Todavía no hay proyectos. Crea el primero.'
            : 'Ningún proyecto coincide con la búsqueda.'}
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-200 border-y border-neutral-200">
          {visibles.map((proyecto) => (
            <li key={proyecto.id} className="flex items-center gap-4 py-3">
              <div className="h-14 w-24 shrink-0 overflow-hidden rounded bg-neutral-200">
                {/* Sin póster propio, la miniatura del video de YouTube. */}
                {proyecto.poster_url ?? proyecto.youtube_id ? (
                  // <img> y no next/image: son miniaturas de 96 px en una
                  // pantalla interna. Optimizarlas cuesta más de lo que ahorra.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      proyecto.poster_url ??
                      posterDeYoutube(proyecto.youtube_id as string)
                    }
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden'
                    }}
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">
                  {proyecto.title}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {proyecto.slug} · {proyecto.format}
                  {proyecto.client ? ` · ${proyecto.client}` : ''}
                  {proyecto.year ? ` · ${proyecto.year}` : ''}
                </p>
              </div>

              <span
                className={`hidden shrink-0 rounded-full px-2 py-1 text-xs sm:inline ${
                  proyecto.published
                    ? 'bg-green-50 text-green-700'
                    : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {proyecto.published ? 'Publicado' : 'Borrador'}
              </span>

              <div className="flex shrink-0 items-center gap-2">
                {enPapelera ? (
                  <Boton
                    disabled={pendiente}
                    onClick={() =>
                      ejecutar(() => restaurarProyecto(proyecto.id), 'Restaurado.')
                    }
                  >
                    Restaurar
                  </Boton>
                ) : (
                  <>
                    <Boton
                      disabled={pendiente}
                      onClick={() =>
                        ejecutar(
                          () => cambiarPublicacion(proyecto.id, !proyecto.published),
                          proyecto.published ? 'Pasado a borrador.' : 'Publicado.',
                        )
                      }
                    >
                      {proyecto.published ? 'Despublicar' : 'Publicar'}
                    </Boton>
                    <Link
                      href={`/admin/proyectos/${proyecto.id}`}
                      className="inline-flex h-11 items-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white transition hover:opacity-90"
                    >
                      Editar
                    </Link>
                    <Boton
                      variante="peligro"
                      disabled={pendiente}
                      onClick={() => setPorEliminar(proyecto)}
                    >
                      Eliminar
                    </Boton>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {porEliminar ? (
        <ConfirmarBorrado
          nombre={porEliminar.title}
          onCancelar={() => setPorEliminar(null)}
          onConfirmar={() => {
            const id = porEliminar.id
            setPorEliminar(null)
            ejecutar(() => eliminarProyecto(id), 'Eliminado. Está en la papelera.')
          }}
        />
      ) : null}
    </div>
  )
}
