'use server'

/**
 * app/admin/login/actions.ts
 *
 * Server Actions de autenticación. Al llevar 'use server', este código nunca
 * llega al navegador aunque lo importe un componente de cliente: Next.js lo
 * reemplaza por una llamada de red.
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

export type EstadoLogin = {
  error: string | null
}

/**
 * Solo se permite volver a rutas internas del panel. Sin esta comprobación,
 * un enlace como /admin/login?destino=https://sitio-falso.co convertiría el
 * login en un redirector abierto, perfecto para suplantar la pantalla de
 * acceso y robar las contraseñas de los socios.
 */
function destinoSeguro(valor: FormDataEntryValue | null): string {
  const destino = typeof valor === 'string' ? valor : ''
  if (destino.startsWith('/admin') && !destino.startsWith('//')) return destino
  return '/admin'
}

export async function iniciarSesion(
  _estadoPrevio: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const destino = destinoSeguro(formData.get('destino'))

  if (!email || !password) {
    return { error: 'Escribe el correo y la contraseña.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Mensaje deliberadamente vago: distinguir "correo inexistente" de
    // "contraseña incorrecta" permitiría averiguar qué correos tienen cuenta.
    const mensaje =
      error.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos.'
        : error.message === 'Email not confirmed'
          ? 'El correo no está confirmado. Confírmalo desde el panel de Supabase (SETUP.md, paso B6).'
          : `No se pudo iniciar sesión: ${error.message}`

    return { error: mensaje }
  }

  // Invalida el árbol de /admin para que se rerenderice ya con sesión.
  revalidatePath('/admin', 'layout')

  // redirect() funciona lanzando una excepción especial: debe quedar fuera de
  // cualquier try/catch o Next.js la interpretaría como un error real.
  redirect(destino)
}

export async function cerrarSesion() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/admin', 'layout')
  redirect('/admin/login')
}
