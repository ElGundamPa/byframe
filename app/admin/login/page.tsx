import type { Metadata } from 'next'

import { FormularioLogin } from './formulario-login'

export const metadata: Metadata = {
  title: 'Acceso · ByFrame',
  // El panel no debe indexarse jamás.
  robots: { index: false, follow: false },
}

export default async function PaginaLogin({
  searchParams,
}: {
  // En Next.js 15 searchParams es una promesa.
  searchParams: Promise<{ destino?: string }>
}) {
  const { destino } = await searchParams

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-lg font-semibold tracking-tight text-neutral-900">
          ByFrame
        </h1>
        <p className="mb-6 text-sm text-neutral-500">
          Panel de administración
        </p>

        <FormularioLogin destino={destino ?? '/admin'} />

        <p className="mt-6 text-xs leading-relaxed text-neutral-500">
          El acceso está restringido a los dos administradores. El registro
          público está desactivado; las cuentas se crean desde el panel de
          Supabase.
        </p>
      </div>
    </main>
  )
}
