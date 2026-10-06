import Link from 'next/link'

import {
  FormularioProyecto,
  PROYECTO_VACIO,
} from '@/components/admin/FormularioProyecto'

export default function PaginaNuevoProyecto() {
  return (
    <div>
      <Link
        href="/admin"
        className="text-sm text-neutral-500 underline-offset-4 hover:underline"
      >
        ← Proyectos
      </Link>

      <h1 className="mt-4 text-xl font-semibold tracking-tight text-neutral-900">
        Nuevo proyecto
      </h1>
      <p className="mt-1 mb-8 text-sm text-neutral-500">
        Añade un título, sube tu video o pega su enlace de YouTube y publícalo.
      </p>

      <FormularioProyecto inicial={PROYECTO_VACIO} esNuevo />
    </div>
  )
}
