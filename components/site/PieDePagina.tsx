import type { Ajustes } from '@/lib/queries'

export function PieDePagina({ ajustes }: { ajustes: Ajustes }) {
  const redes = [
    { nombre: 'Instagram', href: ajustes.redes?.instagram },
    { nombre: 'Vimeo', href: ajustes.redes?.vimeo },
    { nombre: 'YouTube', href: ajustes.redes?.youtube ?? undefined },
  ].filter((red): red is { nombre: string; href: string } => Boolean(red.href))

  return (
    <footer className="border-t border-white/10 px-5 py-8 sm:px-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-[family-name:var(--fuente-sans)] text-sm uppercase tracking-[0.35em] text-white">
          ByFrame
        </span>

        <ul className="flex flex-wrap gap-6">
          {redes.map((red) => (
            <li key={red.nombre}>
              <a
                href={red.href}
                target="_blank"
                rel="noreferrer noopener"
                className="-my-3 inline-flex min-h-11 items-center font-[family-name:var(--fuente-sans)] text-[0.7rem] uppercase tracking-[0.25em] text-white/60 transition-colors hover:text-white"
              >
                {red.nombre}
              </a>
            </li>
          ))}
        </ul>

        <span className="font-[family-name:var(--fuente-sans)] text-[0.7rem] uppercase tracking-[0.25em] text-white/40">
          © {new Date().getFullYear()}
        </span>
      </div>
    </footer>
  )
}
