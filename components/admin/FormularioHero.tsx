'use client'

import { useState, useTransition } from 'react'

import { guardarHero } from '@/lib/admin/acciones'
import { SubidaArchivo } from './SubidaArchivo'
import {
  AvisoEstado,
  Boton,
  Campo,
  claseEntrada,
  type Estado,
  useAvisoDeSalida,
} from './ui'

type Opcion = { id: string; title: string; format: string; published: boolean }

export function FormularioHero({
  opciones,
  inicial,
}: {
  opciones: Opcion[]
  inicial: {
    project_id: string | null
    custom_video_url: string
    custom_poster_url: string
    overlay_text: string
  }
}) {
  const [valores, setValores] = useState(inicial)
  const [sucio, setSucio] = useState(false)
  const [estado, setEstado] = useState<Estado>({ tipo: 'inactivo' })
  const [pendiente, iniciarTransicion] = useTransition()

  useAvisoDeSalida(sucio)

  const actualizar = (parcial: Partial<typeof valores>) => {
    setValores((previos) => ({ ...previos, ...parcial }))
    setSucio(true)
  }

  const enviar = () => {
    setEstado({ tipo: 'guardando' })
    iniciarTransicion(async () => {
      const resultado = await guardarHero({
        project_id: valores.project_id,
        custom_video_url: valores.custom_video_url,
        custom_poster_url: valores.custom_poster_url,
        overlay_text: valores.overlay_text,
      })

      if (resultado.ok) {
        setSucio(false)
        setEstado({ tipo: 'exito', mensaje: 'Portada actualizada.' })
      } else {
        setEstado({ tipo: 'error', mensaje: resultado.error })
      }
    })
  }

  const sinPublicar = opciones.find(
    (o) => o.id === valores.project_id && !o.published,
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        enviar()
      }}
      className="max-w-2xl space-y-8"
    >
      <Campo
        etiqueta="Proyecto de la portada"
        id="project_id"
        ayuda="La portada usa su loop, o su manifiesto si no tiene loop."
      >
        <select
          id="project_id"
          value={valores.project_id ?? ''}
          onChange={(e) => actualizar({ project_id: e.target.value || null })}
          className={claseEntrada}
        >
          <option value="">— Ninguno: usar una pieza propia —</option>
          {opciones.map((opcion) => (
            <option key={opcion.id} value={opcion.id}>
              {opcion.title} ({opcion.format})
              {opcion.published ? '' : ' — borrador'}
            </option>
          ))}
        </select>
      </Campo>

      {sinPublicar ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Ese proyecto está en borrador. Las políticas de seguridad no dejan que
          una pieza inédita se vea en la portada: hasta publicarla, el sitio
          usará el video propio de abajo, y si no hay, la portada quedará en negro.
        </p>
      ) : null}

      <fieldset className="space-y-5 border-t border-neutral-200 pt-8">
        <legend className="sr-only">Pieza dedicada</legend>
        <p className="text-sm text-neutral-500">
          O una pieza propia, que no figura en el portafolio.
        </p>

        <Campo etiqueta="Video de portada" id="custom_video_url">
          <input
            id="custom_video_url"
            value={valores.custom_video_url}
            onChange={(e) => actualizar({ custom_video_url: e.target.value })}
            className={claseEntrada}
            placeholder="https://media.byframe.co/site/hero.mp4"
          />
          <div className="mt-2">
            <SubidaArchivo
              slug="hero"
              tipo="sitio"
              etiqueta="Subir video"
              ayuda="mp4 mudo y comprimido: se reproduce en bucle y sin controles."
              onSubido={(ruta) => actualizar({ custom_video_url: ruta })}
            />
          </div>
        </Campo>

        <Campo
          etiqueta="Póster de respaldo"
          id="custom_poster_url"
          ayuda="Se ve mientras carga el video, y en lugar de él si el visitante pidió menos movimiento o activó el ahorro de datos."
        >
          <input
            id="custom_poster_url"
            value={valores.custom_poster_url}
            onChange={(e) => actualizar({ custom_poster_url: e.target.value })}
            className={claseEntrada}
          />
          <div className="mt-2">
            <SubidaArchivo
              slug="hero-poster"
              tipo="sitio"
              etiqueta="Subir póster"
              onSubido={(ruta) => actualizar({ custom_poster_url: ruta })}
            />
          </div>
        </Campo>
      </fieldset>

      <Campo
        etiqueta="Texto superpuesto"
        id="overlay_text"
        ayuda="Se pinta abajo a la izquierda, en serif grande. Déjalo vacío para no mostrar nada."
      >
        <input
          id="overlay_text"
          value={valores.overlay_text}
          onChange={(e) => actualizar({ overlay_text: e.target.value })}
          className={claseEntrada}
        />
      </Campo>

      <div className="flex items-center gap-4 border-t border-neutral-200 pt-6">
        <Boton type="submit" variante="primario" disabled={pendiente}>
          Guardar portada
        </Boton>
        {sucio ? (
          <span className="text-xs text-neutral-500">Cambios sin guardar</span>
        ) : null}
        <div className="ml-auto">
          <AvisoEstado estado={estado} />
        </div>
      </div>
    </form>
  )
}
