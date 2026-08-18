/**
 * lib/supabase/server.ts
 *
 * Clientes para el servidor: Server Components, Server Actions y Route
 * Handlers.
 *
 * En Next.js 15 `cookies()` es asíncrona, por eso `createClient()` también lo
 * es y siempre se llama con await.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { SUPABASE_ANON_KEY, SUPABASE_URL, getServiceRoleKey } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * Cliente con la llave anónima y la sesión del usuario tomada de las cookies.
 * Es el que debes usar por defecto: respeta RLS, así que un descuido en una
 * consulta no puede filtrar borradores.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Los Server Components no pueden escribir cookies. Se ignora a
          // propósito: el refresco del token lo hace el middleware, que sí
          // puede, en cada petición. Sin este try/catch, cualquier página que
          // lea la sesión reventaría al renderizarse.
        }
      },
    },
  })
}

/**
 * Cliente administrativo con la llave service_role.
 *
 * IGNORA RLS POR COMPLETO. Puede leer, modificar y borrar cualquier fila de
 * cualquier tabla.
 *
 * Reglas de uso:
 *   · Solo dentro de Route Handlers o Server Actions.
 *   · Nunca en un archivo que lleve 'use client' ni que este importe.
 *   · Solo cuando de verdad haga falta saltarse RLS. Para todo lo demás,
 *     createClient().
 *
 * No mantiene sesión ni refresca tokens: es un cliente sin estado.
 */
export function createAdminClient() {
  return createServerClient<Database>(SUPABASE_URL, getServiceRoleKey(), {
    cookies: {
      getAll() {
        return []
      },
      setAll() {
        /* sin sesión: este cliente no persiste nada */
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

/**
 * Devuelve el usuario autenticado, o null.
 *
 * Usa getUser() y no getSession(): getSession() lee la cookie sin validarla
 * contra el servidor de autenticación, así que un atacante podría fabricarla.
 * getUser() verifica el token con Supabase en cada llamada.
 */
export async function getUsuarioActual() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
