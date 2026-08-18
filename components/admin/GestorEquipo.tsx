'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { eliminarMiembro, guardarMiembro, guardarOrdenEquipo } from '@/lib/admin/acciones'
import { SubidaArchivo } from './SubidaArchivo'
import {
  AvisoEstado,
  Boton,
  Campo,
  claseArea,
  claseEntrada,
  ConfirmarBorrado,
  type Estado,
} from './ui'

type Miembro = {
  id: string
  name: string
  role: string | null
  bio: string | null
  photo_url: string | null
  links: Record<string, string | null>
  sort_order: number
}

const REDES = ['instagram', 'vimeo', 'linkedin', 'behance'] as const

export function GestorEquipo({ inicial }: { inicial: Miembro[] }) {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>({ tipo: 'inactivo' })
  const [editando, setEditando] = useState<Miembro | 'nuevo' | null>(null)
  const [porEliminar, setPorEliminar] = useState<Miembro | null>(null)
  const [, iniciarTransicion] = useTransition()

  const mover = (indice: number, direccion: -1 | 1) => {
    const destino = indice + direccion
    if (destino < 0 || destino >= inicial.length) return

    const ids = inicial.map((m) => m.id)
    ;[ids[indice], ids[destino]] = [ids[destino], ids[indice]]

    setEstado({ tipo: 'guardando' })
    iniciarTransicion(async () => {
      const resultado = await guardarOrdenEquipo(ids)
      if (resultado.ok) {
        setEstado({ tipo: 'exito', mensaje: 'Orden guardado.' })
        router.refresh()
      } else {
        setEstado({ tipo: 'error', mensaje: resultado.error })
      }
    })
  }

  if (editando) {
    return (
      <FichaMiembro
        miembro={editando === 'nuevo' ? null : editando}
        onCerrar={() => setEditando(null)}
        onGuardado={() => {
          setEditando(null)
          setEstado({ tipo: 'exito', mensaje: 'Perfil guardado.' })
          router.refresh()
        }}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <AvisoEstado estado={estado} />
        <Boton variante="primario" onClick={() => setEditando('nuevo')}>
          Añadir perfil
        </Boton>
      </div>

      {inicial.length === 0 ? (
        <p className="mt-8 rounded-md border border-dashed border-neutral-300 py-14 text-center text-sm text-neutral-500">
          Todavía no hay perfiles.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-200 border-y border-neutral-200">
          {inicial.map((miembro, indice) => (
            <li key={miembro.id} className="flex items-center gap-4 py-3">
              <div className="h-16 w-12 shrink-0 overflow-hidden rounded bg-neutral-200">
                {miembro.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={miembro.photo_url}
                    alt=""
                    className="h-full w-full object-cover grayscale"
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden'
                    }}
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">
                  {miembro.name}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {miembro.role ?? 'Sin rol'}
                </p>
              </div>

              <div className="flex shrink-0 gap-1">
                <Boton
                  aria-label={`Subir ${miembro.name}`}
                  className="w-11 px-0"
                  onClick={() => mover(indice, -1)}
                >
                  ↑
                </Boton>
                <Boton
                  aria-label={`Bajar ${miembro.name}`}
                  className="w-11 px-0"
                  onClick={() => mover(indice, 1)}
                >
                  ↓
                </Boton>
                <Boton onClick={() => setEditando(miembro)}>Editar</Boton>
                <Boton variante="peligro" onClick={() => setPorEliminar(miembro)}>
                  Eliminar
                </Boton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {porEliminar ? (
        <ConfirmarBorrado
          nombre={porEliminar.name}
          onCancelar={() => setPorEliminar(null)}
          onConfirmar={() => {
            const id = porEliminar.id
            setPorEliminar(null)
            setEstado({ tipo: 'guardando' })
            iniciarTransicion(async () => {
              const resultado = await eliminarMiembro(id)
              if (resultado.ok) {
                setEstado({ tipo: 'exito', mensaje: 'Perfil eliminado.' })
                router.refresh()
              } else {
                setEstado({ tipo: 'error', mensaje: resultado.error })
              }
            })
          }}
        />
      ) : null}
    </div>
  )
}

function FichaMiembro({
  miembro,
  onCerrar,
  onGuardado,
}: {
  miembro: Miembro | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [valores, setValores] = useState({
    name: miembro?.name ?? '',
    role: miembro?.role ?? '',
    bio: miembro?.bio ?? '',
    photo_url: miembro?.photo_url ?? '',
    links: Object.fromEntries(
      REDES.map((red) => [red, miembro?.links?.[red] ?? '']),
    ) as Record<string, string>,
  })
  const [estado, setEstado] = useState<Estado>({ tipo: 'inactivo' })
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [pendiente, iniciarTransicion] = useTransition()

  const enviar = () => {
    setEstado({ tipo: 'guardando' })
    setErrores({})
    iniciarTransicion(async () => {
      const resultado = await guardarMiembro({ id: miembro?.id, ...valores })
      if (resultado.ok) onGuardado()
      else {
        setErrores(resultado.campos ?? {})
        setEstado({ tipo: 'error', mensaje: resultado.error })
      }
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        enviar()
      }}
      className="max-w-2xl space-y-6"
    >
      <button
        type="button"
        onClick={onCerrar}
        className="text-sm text-neutral-500 underline-offset-4 hover:underline"
      >
        ← Volver al equipo
      </button>

      <Campo etiqueta="Nombre" id="name" error={errores.name}>
        <input
          id="name"
          value={valores.name}
          onChange={(e) => setValores({ ...valores, name: e.target.value })}
          className={claseEntrada}
          required
        />
      </Campo>

      <Campo etiqueta="Rol" id="role" error={errores.role}>
        <input
          id="role"
          value={valores.role}
          onChange={(e) => setValores({ ...valores, role: e.target.value })}
          className={claseEntrada}
        />
      </Campo>

      <Campo etiqueta="Biografía" id="bio" error={errores.bio}>
        <textarea
          id="bio"
          rows={4}
          value={valores.bio}
          onChange={(e) => setValores({ ...valores, bio: e.target.value })}
          className={claseArea}
        />
      </Campo>

      <Campo
        etiqueta="Foto"
        id="photo_url"
        error={errores.photo_url}
        ayuda="Vertical. El sitio la muestra en blanco y negro."
      >
        <input
          id="photo_url"
          value={valores.photo_url}
          onChange={(e) => setValores({ ...valores, photo_url: e.target.value })}
          className={claseEntrada}
        />
        <div className="mt-2">
          <SubidaArchivo
            slug={
              valores.name
                .toLowerCase()
                .normalize('NFD')
                .replace(/\p{Diacritic}/gu, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '') || 'perfil'
            }
            tipo="equipo"
            etiqueta="Subir foto"
            onSubido={(ruta) => setValores({ ...valores, photo_url: ruta })}
          />
        </div>
      </Campo>

      <fieldset className="space-y-4 border-t border-neutral-200 pt-6">
        <legend className="text-sm font-medium text-neutral-700">Enlaces</legend>
        {REDES.map((red) => (
          <Campo key={red} etiqueta={red} id={`link-${red}`}>
            <input
              id={`link-${red}`}
              value={valores.links[red] ?? ''}
              onChange={(e) =>
                setValores({
                  ...valores,
                  links: { ...valores.links, [red]: e.target.value },
                })
              }
              className={claseEntrada}
              placeholder="https://…"
            />
          </Campo>
        ))}
      </fieldset>

      <div className="flex items-center gap-4 border-t border-neutral-200 pt-6">
        <Boton type="submit" variante="primario" disabled={pendiente}>
          Guardar perfil
        </Boton>
        <Boton type="button" onClick={onCerrar}>
          Cancelar
        </Boton>
        <div className="ml-auto">
          <AvisoEstado estado={estado} />
        </div>
      </div>
    </form>
  )
}
