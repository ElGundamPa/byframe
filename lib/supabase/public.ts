/**
 * lib/supabase/public.ts
 *
 * Cliente de solo lectura para el sitio público. No toca cookies y no conoce
 * ninguna sesión: siempre habla como rol `anon`.
 *
 * Dos razones para que exista, separado de lib/supabase/server.ts:
 *
 * 1. Caché. Las funciones envueltas en unstable_cache no pueden leer cookies:
 *    el resultado se comparte entre todos los visitantes, así que depender de
 *    la petición actual sería un error. Sin este cliente no habría ISR.
 *
 * 2. Corrección. Con el cliente de sesión, un socio con sesión abierta veía el
 *    sitio público con los borradores incluidos, y por tanto no veía lo que ve
 *    el mundo. Aquí el sitio público es idéntico para todos.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env'
import type { Database } from '@/types/database'

export function createPublicClient() {
  return createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
