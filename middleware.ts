/**
 * middleware.ts
 *
 * Corre antes de cada petición que coincida con el matcher. Hace dos cosas:
 * refresca el token de Supabase y protege /admin.
 */

import type { NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Todas las rutas salvo:
     *   _next/static   · archivos compilados
     *   _next/image    · optimizador de imágenes
     *   favicon.ico    · icono
     *   archivos con extensión conocida (imágenes, fuentes, video)
     *
     * El middleware se aplica también al sitio público, no solo a /admin, para
     * que la sesión se refresque mientras navegas. La exclusión de /admin/login
     * NO va aquí: se resuelve dentro de updateSession, porque esa ruta sí debe
     * pasar por el middleware para poder redirigir al panel a quien ya tiene
     * sesión.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|mp4|m3u8|ts)$).*)',
  ],
}
