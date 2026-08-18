import { Hero } from '@/components/site/Hero'
import { Trabajo } from '@/components/site/Trabajo'
import { getHero, getProyectosPorFormato } from '@/lib/queries'

export default async function PaginaInicio() {
  const [hero, horizontales, verticales] = await Promise.all([
    getHero(),
    getProyectosPorFormato('horizontal'),
    getProyectosPorFormato('vertical'),
  ])

  // El hero puede venir de una pieza dedicada o heredarse de un proyecto. Si
  // hereda, se prefiere el loop al manifiesto: en la portada el video es
  // decorativo, se ve mudo y en bucle, y un mp4 corto arranca antes que HLS.
  const proyectoDelHero = hero?.projects ?? null
  const videoUrl =
    hero?.custom_video_url ??
    proyectoDelHero?.loop_url ??
    proyectoDelHero?.hls_url ??
    null
  const posterUrl =
    hero?.custom_poster_url ?? proyectoDelHero?.poster_url ?? null

  return (
    <main>
      <Hero
        videoUrl={videoUrl}
        posterUrl={posterUrl}
        texto={hero?.overlay_text ?? null}
      />
      <Trabajo horizontales={horizontales} verticales={verticales} />
    </main>
  )
}
