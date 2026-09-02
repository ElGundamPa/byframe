import type { Metadata } from 'next'

import { getAjustes, getEquipo } from '@/lib/queries'

export const metadata: Metadata = {
  title: 'Nosotros',
}

/**
 * Nosotros, sin retratos.
 *
 * Los perfiles se listan solo con nombre, rol, biografía y enlaces. La foto
 * sigue guardándose en la base de datos y el panel mantiene su campo: quitarla
 * aquí es una decisión de presentación, no un borrado, y volver atrás es
 * devolver este bloque.
 *
 * Sin imagen, la rejilla de tres columnas dejaba huecos enormes entre nombres
 * sueltos. Se lista en dos columnas y con líneas de separación, para que se lea
 * como un reparto de créditos y no como una cuadrícula a medio llenar.
 */
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

      <div className="mt-20 grid gap-x-12 border-t border-white/10 sm:grid-cols-2">
        {equipo.map((persona) => (
          <article
            key={persona.id}
            className="border-b border-white/10 py-8 sm:py-10"
          >
            <h2 className="font-[family-name:var(--fuente-serif)] text-[clamp(1.75rem,4vw,2.75rem)] leading-tight">
              {persona.name}
            </h2>

            {persona.role ? (
              <p className="mt-2 text-[0.65rem] uppercase tracking-[0.25em] text-white/50">
                {persona.role}
              </p>
            ) : null}

            {persona.bio ? (
              <p className="mt-5 max-w-prose text-sm leading-relaxed text-white/60">
                {persona.bio}
              </p>
            ) : null}

            {persona.links && Object.keys(persona.links).length > 0 ? (
              <ul className="mt-5 flex flex-wrap gap-6">
                {Object.entries(persona.links).map(([nombre, url]) =>
                  url ? (
                    <li key={nombre}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="-my-3 inline-flex min-h-11 items-center text-[0.65rem] uppercase tracking-[0.25em] text-white/50 transition-colors hover:text-white"
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
