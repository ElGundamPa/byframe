'use client'

import Image, { type ImageProps } from 'next/image'
import { useEffect, useRef, useState } from 'react'

/**
 * next/image con degradación limpia y fuentes de reserva.
 *
 * Dos problemas que resuelve:
 *
 * 1. Cuando el archivo no existe —una ruta mal pegada en el panel, un bucket
 *    todavía sin publicar— el navegador pinta su icono de imagen rota con el
 *    texto alternativo al lado. Sobre el negro del sitio eso parece un fallo
 *    general. Aquí queda un bloque neutro del mismo tamaño y la maqueta aguanta.
 *
 * 2. Algunas fuentes ofrecen la misma imagen en varias calidades sin garantizar
 *    todas. Las miniaturas de YouTube son el caso: `maxresdefault` existe para
 *    la mayoría de los videos, pero no para todos, y solo se descubre pidiéndola.
 *    Con `alternativas` se prueban en orden hasta que una cargue.
 */
export function Imagen({
  className = '',
  alt,
  src,
  alternativas,
  ...props
}: ImageProps & {
  alt: string
  /** Fuentes de reserva, en orden de preferencia decreciente. */
  alternativas?: string[]
}) {
  const [indice, setIndice] = useState(0)
  const imgRef = useRef<HTMLImageElement>(null)

  const fuentes = [src, ...(alternativas ?? [])]
  const actual = fuentes[indice]

  /**
   * La imagen viene en el HTML inicial, así que el navegador puede haberla
   * pedido y haber fallado ANTES de que React hidrate y enganche onError: ese
   * evento ya ocurrió y no se vuelve a emitir, y el componente se quedaba
   * esperando para siempre una señal que nunca llegaba.
   *
   * Por eso, al montar y en cada cambio de fuente, se comprueba también el
   * estado real del elemento.
   */
  useEffect(() => {
    const img = imgRef.current
    if (img?.complete && img.naturalWidth === 0) {
      setIndice((i) => i + 1)
    }
  }, [indice])

  // Se acabaron las alternativas: bloque neutro.
  if (actual === undefined) {
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
      // key fuerza a React a montar un elemento nuevo al cambiar de fuente. Sin
      // esto, el navegador puede quedarse con el estado de error de la imagen
      // anterior y no llegar a pedir la siguiente.
      key={indice}
      ref={imgRef}
      src={actual}
      alt={alt}
      className={className}
      onError={() => setIndice((i) => i + 1)}
    />
  )
}
