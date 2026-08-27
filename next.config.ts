import path from 'node:path'

import type { NextConfig } from 'next'

/**
 * Dominios desde los que next/image puede optimizar.
 *
 * media.byframe.co va siempre: es la forma canónica con la que se guardan las
 * rutas en la base de datos. Además se añade el origen configurado, que puede
 * ser un bucket de desarrollo (pub-xxx.r2.dev).
 *
 * Ojo: NEXT_PUBLIC_MEDIA_BASE_URL puede ser una ruta relativa ("/media", el
 * modo local), y entonces no hay ningún dominio que autorizar. Cuando esto se
 * daba por supuesto, el sitio devolvía 500 en toda la portada.
 */
function dominiosDeMedios(): string[] {
  // i.ytimg.com: las miniaturas de las piezas alojadas en YouTube.
  const dominios = new Set(['media.byframe.co', 'i.ytimg.com'])
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL

  if (base?.startsWith('http')) {
    try {
      dominios.add(new URL(base).hostname)
    } catch {
      // Una base mal escrita no debe tumbar la compilación.
    }
  }

  return [...dominios]
}

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Hay un package-lock.json en la carpeta padre (C:\...\Colombia\). Sin esta
  // línea, Next.js deduce que la raíz del proyecto es esa carpeta y avisa en
  // cada compilación.
  // process.cwd() y no import.meta.dirname: al compilar la configuración a
  // CommonJS, import.meta puede quedar sin definir y la raíz de rastreo caía
  // en la raíz del disco. El síntoma era Next intentando vigilar C:\ entero
  // (pagefile.sys, hiberfil.sys) en cada arranque.
  outputFileTracingRoot: path.resolve(process.cwd()),

  images: {
    // Solo se optimizan imágenes del bucket propio. Sin esta lista, next/image
    // rechaza cualquier host externo.
    remotePatterns: dominiosDeMedios().map((hostname) => ({
      protocol: 'https' as const,
      hostname,
      pathname: '/**',
    })),
    // AVIF primero: pesa menos que WebP en fotografía con grano, que es
    // exactamente el material de ByFrame.
    formats: ['image/avif', 'image/webp'],
  },

  async headers() {
    return [
      {
        // El panel nunca debe indexarse ni incrustarse en un iframe ajeno.
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
