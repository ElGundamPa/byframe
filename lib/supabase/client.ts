/**
 * lib/supabase/client.ts
 *
 * Cliente para componentes de navegador ('use client').
 *
 * Usa la llave anónima y queda sujeto a las políticas RLS de
 * supabase/migrations/0004_rls.sql: puede leer lo publicado y, si hay sesión
 * iniciada, escribir con el rol authenticated.
 *
 * La sesión vive en cookies, no en localStorage. Eso es lo que permite que el
 * servidor la lea en el mismo ciclo de petición.
 */

import { createBrowserClient } from '@supabase/ssr'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
}
