/**
 * lib/cache-tags.ts
 *
 * Etiquetas de caché, en un solo sitio.
 *
 * Este archivo existe por un motivo muy concreto: `revalidateTag('proyectos')`
 * contra una consulta etiquetada como `'projects'` no coincide, no lanza
 * ningún error y deja el sitio mostrando datos viejos para siempre. Es el fallo
 * F8 de SETUP.md. Con constantes, ese error lo detecta TypeScript.
 *
 * Lo consume la Fase 4: cada guardado del panel revalida las etiquetas
 * afectadas.
 */

export const TAGS = {
  /** Cualquier cambio en el portafolio. */
  proyectos: 'proyectos',
  /** Un proyecto concreto, por slug. */
  proyecto: (slug: string) => `proyecto:${slug}`,
  /** El video de portada. */
  hero: 'hero',
  /** Perfiles de la sección Nosotros. */
  equipo: 'equipo',
  /** Correo, WhatsApp, redes, SEO. */
  ajustes: 'ajustes',
} as const

/**
 * Revalidación por tiempo, como red de seguridad.
 *
 * Una hora. La actualización real llega por etiqueta en cuanto se guarda algo
 * en el panel; esto solo cubre el caso de que una revalidación se pierda.
 */
export const REVALIDAR_CADA = 3600
