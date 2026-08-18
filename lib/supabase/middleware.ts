/**
 * lib/supabase/middleware.ts
 *
 * Refresco de sesión y guardia de /admin, para usarse desde middleware.ts.
 *
 * El detalle que arruina la mayoría de las implementaciones: hay que devolver
 * EXACTAMENTE el objeto de respuesta sobre el que Supabase escribió las
 * cookies. Si creas una NextResponse nueva después de llamar a getUser(),
 * pierdes el token refrescado y la sesión se cae al recargar. Ese es el fallo
 * F3 de SETUP.md.
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env'
import type { Database } from '@/types/database'

/** Rutas de /admin accesibles sin sesión. Sin esto, el login se protege a sí mismo. */
const RUTAS_PUBLICAS_DEL_PANEL = ['/admin/login', '/admin/auth']

export async function updateSession(request: NextRequest) {
  // Respuesta base. Se reasigna dentro de setAll para conservar las cookies.
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // No metas nada entre createServerClient y getUser(): esta llamada es la que
  // refresca el token expirado y dispara setAll.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl
  const esRutaDePanel = pathname.startsWith('/admin')
  const esRutaPublicaDelPanel = RUTAS_PUBLICAS_DEL_PANEL.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`),
  )

  // Sin sesión y pidiendo el panel: al login, recordando a dónde iba.
  if (esRutaDePanel && !esRutaPublicaDelPanel && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.search = ''
    if (pathname !== '/admin') {
      url.searchParams.set('destino', `${pathname}${search}`)
    }
    return redirigirConservandoCookies(url, response)
  }

  // Con sesión y pidiendo el login: directo al panel.
  if (user && pathname === '/admin/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    url.search = ''
    return redirigirConservandoCookies(url, response)
  }

  return response
}

/**
 * Traslada a la redirección las cookies que Supabase acaba de escribir. Si se
 * omite, el token refrescado se pierde en cada redirección y se produce el
 * ciclo /admin → /admin/login → /admin.
 */
function redirigirConservandoCookies(url: URL, origen: NextResponse) {
  const redireccion = NextResponse.redirect(url)
  for (const cookie of origen.cookies.getAll()) {
    redireccion.cookies.set(cookie)
  }
  return redireccion
}
