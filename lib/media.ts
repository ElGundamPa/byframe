import { MEDIA_BASE_URL } from '@/lib/env'

/**
 * lib/media.ts
 *
 * Traduce las rutas guardadas en la base de datos al origen que esté
 * configurado en NEXT_PUBLIC_MEDIA_BASE_URL.
 *
 * En la base de datos las rutas se guardan siempre con su forma canónica
 * (`https://media.byframe.co/projects/...`), pero de dónde se sirven cambia
 * según dónde estés:
 *
 *   NEXT_PUBLIC_MEDIA_BASE_URL=/media                   → public/media, en local
 *   NEXT_PUBLIC_MEDIA_BASE_URL=https://pub-xxx.r2.dev   → URL de desarrollo de R2
 *   NEXT_PUBLIC_MEDIA_BASE_URL=https://media.byframe.co → producción
 *
 * Así, cambiar de origen es cambiar UNA variable de entorno. Sin esto habría
 * que reescribir cada fila de `projects` en cada mudanza, que es exactamente
 * el trabajo que nadie hace y acaba dejando URLs muertas por la base.
 *
 * Lo que se conserva es todo lo que va desde `/projects/` o `/team/` o `/site/`
 * en adelante: la ruta dentro del bucket, que sí es estable.
 */

/** Carpetas de primer nivel del bucket. Marcan dónde empieza la ruta estable. */
const RAICES = ['/projects/', '/team/', '/site/']

export function resolverMedia(url: string | null | undefined): string | null {
  if (!url) return null

  // Ya es relativa al origen configurado: nada que traducir.
  if (url.startsWith(MEDIA_BASE_URL)) return url

  for (const raiz of RAICES) {
    const indice = url.indexOf(raiz)
    if (indice !== -1) return `${MEDIA_BASE_URL}${url.slice(indice)}`
  }

  // Una ruta que no reconocemos se devuelve intacta: puede ser un archivo
  // servido desde otro sitio a propósito, y romperlo sería peor que dejarlo.
  return url
}
