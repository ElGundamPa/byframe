import type { getProyectosPorFormato } from '@/lib/queries'

/**
 * Un proyecto tal y como lo consumen los componentes del sitio público:
 * exactamente lo que devuelve la consulta, sin duplicar la forma a mano.
 * Si mañana cambia el `select`, TypeScript avisa en cada componente afectado.
 */
export type ProyectoPublico = Awaited<
  ReturnType<typeof getProyectosPorFormato>
>[number]
