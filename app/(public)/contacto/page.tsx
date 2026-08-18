import type { Metadata } from 'next'

import { getAjustes } from '@/lib/queries'

export const metadata: Metadata = {
  title: 'Contacto',
}

/** Deja solo los dígitos: wa.me no acepta espacios, signos ni el símbolo +. */
function enlaceWhatsapp(numero: string) {
  return `https://wa.me/${numero.replace(/\D/g, '')}`
}

export default async function PaginaContacto() {
  const ajustes = await getAjustes()

  const vias = [
    ajustes.contacto?.email
      ? {
          etiqueta: 'Correo',
          texto: ajustes.contacto.email,
          href: `mailto:${ajustes.contacto.email}`,
        }
      : null,
    ajustes.contacto?.whatsapp
      ? {
          etiqueta: 'WhatsApp',
          texto: ajustes.contacto.whatsapp,
          href: enlaceWhatsapp(ajustes.contacto.whatsapp),
        }
      : null,
    ajustes.redes?.instagram
      ? {
          etiqueta: 'Instagram',
          texto: '@byframe',
          href: ajustes.redes.instagram,
        }
      : null,
    ajustes.redes?.vimeo
      ? { etiqueta: 'Vimeo', texto: 'ByFrame', href: ajustes.redes.vimeo }
      : null,
  ].filter((via) => via !== null)

  return (
    <main className="px-5 pb-24 pt-32 sm:px-8 sm:pt-40">
      <h1 className="font-[family-name:var(--fuente-serif)] text-[clamp(2.5rem,8vw,6rem)] leading-[0.95]">
        Contacto
      </h1>

      {ajustes.contacto?.ciudad ? (
        <p className="mt-6 text-[0.65rem] uppercase tracking-[0.25em] text-white/50">
          {ajustes.contacto.ciudad}
        </p>
      ) : null}

      {/* Sin formulario, por decisión: un correo directo llega a la bandeja de
          los dos socios y no depende de ningún servicio intermedio. */}
      <ul className="mt-16 max-w-3xl divide-y divide-white/10 border-y border-white/10">
        {vias.map((via) => (
          <li key={via.etiqueta}>
            <a
              href={via.href}
              target={via.href.startsWith('http') ? '_blank' : undefined}
              rel={via.href.startsWith('http') ? 'noreferrer noopener' : undefined}
              className="group flex min-h-[5rem] items-center justify-between gap-6 py-6 transition-colors hover:text-white"
            >
              <span className="text-[0.65rem] uppercase tracking-[0.25em] text-white/40">
                {via.etiqueta}
              </span>
              <span className="font-[family-name:var(--fuente-serif)] text-2xl text-white sm:text-3xl">
                {via.texto}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}
