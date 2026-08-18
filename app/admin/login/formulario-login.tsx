'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { iniciarSesion, type EstadoLogin } from './actions'

const ESTADO_INICIAL: EstadoLogin = { error: null }

export function FormularioLogin({ destino }: { destino: string }) {
  const [estado, accion] = useActionState(iniciarSesion, ESTADO_INICIAL)

  return (
    <form
      action={accion}
      className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
    >
      <input type="hidden" name="destino" value={destino} />

      <label
        htmlFor="email"
        className="block text-sm font-medium text-neutral-700"
      >
        Correo
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        required
        autoFocus
        className="mt-1 block h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
      />

      <label
        htmlFor="password"
        className="mt-4 block text-sm font-medium text-neutral-700"
      >
        Contraseña
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        className="mt-1 block h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
      />

      {estado.error ? (
        // aria-live para que un lector de pantalla anuncie el error sin que el
        // foco tenga que moverse.
        <p
          role="alert"
          aria-live="polite"
          className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {estado.error}
        </p>
      ) : null}

      <BotonEnviar />
    </form>
  )
}

function BotonEnviar() {
  // useFormStatus solo funciona en un componente hijo del <form>, nunca en el
  // mismo que lo declara.
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 h-11 w-full rounded-md bg-neutral-900 text-sm font-medium text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:opacity-50"
    >
      {pending ? 'Entrando…' : 'Entrar'}
    </button>
  )
}
