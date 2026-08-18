import type { Metadata } from 'next'
import { Imagen } from '@/components/site/Imagen'
import { getAjustes, getEquipo } from '@/lib/queries'

export const metadata: Metadata = {
  title: 'Nosotros',
}

export default async function PaginaNosotros() {
  const [equipo, ajustes] = await Promise.all([getEquipo(), getAjustes()])

  return (
    <main className="px-5 pb-24 pt-32 sm:px-8 sm:pt-40">
      <h1 className="font-[family-name:var(--fuente-serif)] text-[clamp(2.5rem,8vw,6rem)] leading-[0.95]">
        {ajustes.nosotros?.titulo ?? 'Nosotros'}
      </h1>

      {ajustes.nosotros?.texto ? (
        <p className="mt-8 max-w-2xl text-base leading-relaxed text-white/70">
          {ajustes.nosotros.texto}
        </p>
      ) : null}

      <div className="mt-20 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {equipo.map((persona) => (
          <article key={persona.id}>
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-950">
              {persona.photo_url ? (
                <Imagen
                  src={persona.photo_url}
                  alt={`Retrato de ${persona.name}`}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  loading="lazy"
                  // Blanco y negro por decisión de dirección de arte: los
                  // retratos no compiten con el color del trabajo.
                  className="object-cover grayscale"
                />
              ) : null}
            </div>

            <h2 className="mt-5 font-[family-name:var(--fuente-serif)] text-2xl">
              {persona.name}
            </h2>

            {persona.role ? (
              <p className="mt-1 text-[0.65rem] uppercase tracking-[0.25em] text-white/50">
                {persona.role}
              </p>
            ) : null}

            {persona.bio ? (
              <p className="mt-4 text-sm leading-relaxed text-white/60">
                {persona.bio}
              </p>
            ) : null}

            {persona.links && Object.keys(persona.links).length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-5">
                {Object.entries(persona.links).map(([nombre, url]) =>
                  url ? (
                    <li key={nombre}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[0.65rem] uppercase tracking-[0.25em] text-white/50 transition-colors hover:text-white"
                      >
                        {nombre}
                      </a>
                    </li>
                  ) : null,
                )}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </main>
  )
}
