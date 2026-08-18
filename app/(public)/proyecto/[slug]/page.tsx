import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { FichaProyecto } from '@/components/site/FichaProyecto'
import { getProyectoPorSlug, getSlugsPublicados } from '@/lib/queries'

/**
 * Página real de cada proyecto.
 *
 * Dentro del sitio, la ficha se abre en un modal sin recargar. Esta página es
 * la que ve quien llega desde un enlace compartido, desde Google o con
 * JavaScript desactivado, y es la que da metadatos Open Graph decentes cuando
 * alguien pega el enlace en WhatsApp.
 */
export async function generateStaticParams() {
  const slugs = await getSlugsPublicados()
  return slugs.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const proyecto = await getProyectoPorSlug(slug)

  if (!proyecto) return { title: 'Proyecto no encontrado' }

  return {
    title: proyecto.title,
    description:
      proyecto.description ??
      `${proyecto.title}${proyecto.client ? ` para ${proyecto.client}` : ''}.`,
    openGraph: {
      title: `${proyecto.title} · ByFrame`,
      description: proyecto.description ?? undefined,
      images: proyecto.poster_url ? [proyecto.poster_url] : undefined,
      type: 'video.other',
    },
  }
}

export default async function PaginaProyecto({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const proyecto = await getProyectoPorSlug(slug)

  // Un borrador y un slug inexistente devuelven lo mismo, un 404, y no un
  // mensaje distinto: si no, la diferencia revelaría que la pieza existe.
  if (!proyecto) notFound()

  return (
    <main className="px-5 pb-24 pt-24 sm:px-8 sm:pt-28">
      <FichaProyecto proyecto={proyecto} />
    </main>
  )
}
