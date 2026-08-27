'use client'

import { useState } from 'react'

import { urlDePrevisualizacion } from '@/lib/youtube'

/**
 * Previsualización muda de una pieza alojada en YouTube, para la rejilla.
 *
 * Hace el papel del loop de 6 s que tienen las piezas con archivo propio: se
 * mueve, no suena y no se puede tocar.
 *
 * Dos trucos, y los dos son necesarios:
 *
 * 1. **Se escala un 40 % y se centra.** El reproductor incrustado no recorta:
 *    si la proporción del video no coincide con la de la tarjeta, deja franjas
 *    negras, y además asoma el título en la banda superior. Ampliando y
 *    recortando por los bordes queda solo imagen, como en un loop propio.
 *
 * 2. **Aparece cuando el reproductor ya está listo**, no al montarse. Un
 *    iframe recién insertado pinta negro durante un segundo largo; si se
 *    mostrara de inmediato, cada tarjeta parpadearía en negro antes de
 *    arrancar. Hasta entonces manda la miniatura, que está debajo.
 */
export function PrevisualizacionYoutube({ id }: { id: string }) {
  const [listo, setListo] = useState(false)

  return (
    // pointer-events-none: los clics tienen que llegar a la tarjeta que hay
    // debajo, no al reproductor. Sin esto, tocar una tarjeta abriría YouTube
    // en vez de la ficha.
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <iframe
        src={urlDePrevisualizacion(id)}
        title=""
        tabIndex={-1}
        allow="autoplay; encrypted-media"
        onLoad={() => setListo(true)}
        className={`absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 border-0 transition-opacity duration-700 ${
          listo ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
