'use client'

import Image, { type ImageProps } from 'next/image'
import { useState } from 'react'

/**
 * next/image con degradación limpia.
 *
 * Cuando el archivo no existe todavía —hoy, porque media.byframe.co aún no está
 * publicado; mañana, porque alguien pegó mal una ruta en el panel— el navegador
 * pinta su icono de imagen rota con el texto alternativo al lado. En una web de
 * productora sobre fondo negro eso se ve como un error del sitio.
 *
 * Aquí, si la imagen falla, queda un bloque neutro del mismo tamaño. El diseño
 * se sostiene y el texto sobre el degradado sigue leyéndose.
 *
 * El alt se conserva íntegro en el caso normal: solo desaparece cuando ya no
 * hay ninguna imagen que describir.
 */
export function Imagen({
  className = '',
  alt,
  ...props
}: ImageProps & { alt: string }) {
  const [fallo, setFallo] = useState(false)

  if (fallo) {
    return (
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-neutral-900 ${className}`}
      />
    )
  }

  return (
    <Image
      {...props}
      alt={alt}
      className={className}
      onError={() => setFallo(true)}
    />
  )
}
