'use client'

import { VideoPlayer } from '@/components/VideoPlayer'
import { urlDeIncrustacion } from '@/lib/youtube'
import type { ProjectFormat } from '@/types/database'

/**
 * Cuerpo de la ficha de un proyecto: video, título, descripción y créditos.
 *
 * Lo comparten el modal del portafolio y la página /proyecto/[slug]. Con dos
 * copias, cualquier ajuste de maqueta habría que hacerlo dos veces y tarde o
 * temprano una de las dos se queda atrás.
 *
 * El tipo es estructural a propósito: le sirve tanto la fila del listado como
 * la del detalle, que traen campos distintos.
 */
export type ProyectoFicha = {
  title: string
  client: string | null
  year: number | null
  format: ProjectFormat
  description: string | null
  hls_url: string | null
  poster_url: string | null
  /** Piezas cuya copia vive en el canal del artista. */
  youtube_id?: string | null
  project_credits: { id: string; role: string; name: string }[]
}

export function FichaProyecto({
  proyecto,
  autoPlay = false,
  // En su propia página el título del proyecto es el encabezado principal. En
  // el modal no: la página que hay debajo ya tiene su h1 y dos h1 desorientan
  // a quien navega por encabezados con un lector de pantalla.
  tituloComo: Titulo = 'h1',
}: {
  proyecto: ProyectoFicha
  autoPlay?: boolean
  tituloComo?: 'h1' | 'h2'
}) {
  const Subtitulo = Titulo === 'h1' ? 'h2' : 'h3'

  return (
    <div className="mx-auto max-w-6xl">
      {/*
        En el teléfono el reproductor va de borde a borde. Los márgenes
        laterales de la página lo dejaban flotando en medio del negro, pequeño y
        sin peso: en una pantalla de 390 pt, 40 pt de margen son el 10 % del
        ancho, y en un portafolio de video ese 10 % es imagen.

        El -mx-5 anula el padding del contenedor solo hasta el primer punto de
        ruptura; a partir de ahí el reproductor vuelve a la columna.
      */}
      <div className="-mx-5 sm:mx-0">
        {/*
          Orden de preferencia: manifiesto propio primero, incrustación después.
          Si una pieza tiene las dos cosas, gana la copia propia: mejor calidad,
          sin marcas ajenas y sin depender de que YouTube siga sirviéndola.
        */}
        {!proyecto.hls_url && proyecto.youtube_id ? (
          <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: '16 / 9' }}>
            <iframe
              src={urlDeIncrustacion(proyecto.youtube_id)}
              title={proyecto.title}
              // Sin allow="fullscreen" el botón de pantalla completa aparece
              // pero no hace nada, que confunde más que no tenerlo.
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              // Carga diferida: el iframe de YouTube arrastra bastante
              // JavaScript, y en la ficha suele estar por debajo del pliegue.
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        ) : proyecto.hls_url ? (
          <VideoPlayer
            src={proyecto.hls_url}
            poster={proyecto.poster_url}
            titulo={proyecto.title}
            autoPlay={autoPlay}
            // Sin aspect-* en las clases: la caja la fija el propio
            // reproductor con la proporción real del archivo. Aquí solo se
            // limita el tamaño máximo.
            aspectoPorDefecto={proyecto.format === 'vertical' ? '9 / 16' : '16 / 9'}
            className={
              proyecto.format === 'vertical'
                ? // Vertical: manda la altura y el ancho se deduce de la
                  // proporción del archivo. Con w-full pasaba lo contrario y,
                  // al toparse con el límite de altura, reaparecían unas
                  // barras finas a los lados.
                  'mx-auto h-[78dvh] max-w-full'
                : 'w-full max-h-[80dvh]'
            }
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-neutral-950">
            <p className="text-[0.7rem] uppercase tracking-[0.25em] text-white/40">
              Video no disponible
            </p>
          </div>
        )}
      </div>

      <header className="mt-10">
        <Titulo className="font-[family-name:var(--fuente-serif)] text-[clamp(2rem,6vw,4.5rem)] leading-[1] text-white">
          {proyecto.title}
        </Titulo>
        {proyecto.client || proyecto.year ? (
          <p className="mt-3 text-[0.7rem] uppercase tracking-[0.25em] text-white/50">
            {[proyecto.client, proyecto.year].filter(Boolean).join(' · ')}
          </p>
        ) : null}
      </header>

      {proyecto.description ? (
        <p className="mt-8 max-w-2xl text-base leading-relaxed text-white/70">
          {proyecto.description}
        </p>
      ) : null}

      {proyecto.project_credits.length > 0 ? (
        <section className="mt-14 border-t border-white/10 pt-8">
          <Subtitulo className="text-[0.65rem] uppercase tracking-[0.3em] text-white/40">
            Créditos
          </Subtitulo>
          <dl className="mt-6 space-y-3">
            {proyecto.project_credits.map((credito) => (
              <div
                key={credito.id}
                className="grid gap-x-10 gap-y-1 sm:grid-cols-[14rem_1fr]"
              >
                <dt className="text-[0.65rem] uppercase tracking-[0.25em] text-white/40">
                  {credito.role}
                </dt>
                <dd className="text-sm text-white/80">{credito.name}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  )
}
