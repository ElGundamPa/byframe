'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, useTransition } from 'react'

import { guardarOrden } from '@/lib/admin/acciones'
import { posterDeYoutube } from '@/lib/youtube'
import { AvisoEstado, type Estado } from './ui'

type Fila = {
  id: string
  title: string
  poster_url: string | null
  youtube_id: string | null
  published: boolean
}

/**
 * Orden del portafolio con arrastrar y soltar.
 *
 * Guardado optimista: la lista se reordena en pantalla al soltar y la escritura
 * viaja después. Si falla, se vuelve al orden anterior y se avisa — nunca se
 * deja la pantalla mostrando un orden que la base no tiene.
 *
 * El sensor de teclado no es un extra: sin él, reordenar sería imposible sin
 * ratón. Con él, Espacio agarra, las flechas mueven y Espacio suelta.
 */
export function OrdenPortafolio({
  titulo,
  formato,
  inicial,
}: {
  titulo: string
  formato: 'horizontal' | 'vertical'
  inicial: Fila[]
}) {
  const [filas, setFilas] = useState(inicial)
  const [estado, setEstado] = useState<Estado>({ tipo: 'inactivo' })
  const [, iniciarTransicion] = useTransition()

  const sensores = useSensors(
    // 8 px de holgura: sin esto, un clic con el pulso normal se interpreta como
    // arrastre y la tarjeta salta sola.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const alSoltar = (evento: DragEndEvent) => {
    const { active, over } = evento
    if (!over || active.id === over.id) return

    const anterior = filas
    const desde = filas.findIndex((f) => f.id === active.id)
    const hasta = filas.findIndex((f) => f.id === over.id)
    const nuevas = arrayMove(filas, desde, hasta)

    setFilas(nuevas)
    setEstado({ tipo: 'guardando' })

    iniciarTransicion(async () => {
      const resultado = await guardarOrden({
        format: formato,
        ids: nuevas.map((f) => f.id),
      })

      if (resultado.ok) {
        setEstado({ tipo: 'exito', mensaje: 'Orden guardado.' })
      } else {
        setFilas(anterior)
        setEstado({ tipo: 'error', mensaje: resultado.error })
      }
    })
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-neutral-900">{titulo}</h2>
        <AvisoEstado estado={estado} />
      </div>

      {filas.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-500">
          Sin proyectos en este formato.
        </p>
      ) : (
        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={alSoltar}>
          <SortableContext items={filas.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <ul className="mt-4 space-y-2">
              {filas.map((fila, indice) => (
                <ElementoOrdenable key={fila.id} fila={fila} posicion={indice + 1} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  )
}

function ElementoOrdenable({ fila, posicion }: { fila: Fila; posicion: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: fila.id })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-md border bg-white p-2 ${
        isDragging ? 'border-neutral-900 shadow-lg' : 'border-neutral-200'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Mover ${fila.title}. Posición ${posicion}.`}
        className="flex h-11 w-11 cursor-grab items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 active:cursor-grabbing"
      >
        ⠿
      </button>

      <span className="w-6 text-xs tabular-nums text-neutral-400">{posicion}</span>

      <div className="h-10 w-16 shrink-0 overflow-hidden rounded bg-neutral-200">
        {fila.poster_url ?? fila.youtube_id ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fila.poster_url ?? posterDeYoutube(fila.youtube_id as string)}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.visibility = 'hidden'
            }}
          />
        ) : null}
      </div>

      <span className="min-w-0 flex-1 truncate text-sm text-neutral-900">
        {fila.title}
      </span>

      {!fila.published ? (
        <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
          Borrador
        </span>
      ) : null}
    </li>
  )
}
