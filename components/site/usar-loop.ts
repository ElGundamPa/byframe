'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Gestor central de loops.
 *
 * El problema que resuelve: una rejilla de doce tarjetas, cada una con su
 * propio <video> en bucle, pone a decodificar doce flujos a la vez. En un
 * teléfono de gama media eso significa ventilador, batería y desplazamiento a
 * tirones. Y Safari en iOS directamente se niega a decodificar más de unos
 * pocos elementos de video simultáneos: los de más quedan en negro.
 *
 * La solución NO es lógica repartida por cada tarjeta —doce componentes
 * decidiendo por su cuenta no pueden saber cuántos hay reproduciéndose—, sino
 * un único gestor con un cupo global.
 *
 * Regla: máximo tres a la vez. Cuando entra un cuarto, se pausa el más
 * antiguo. Los demás muestran su poster, que es una imagen y no cuesta nada.
 */
const CUPO = 3

class GestorDeLoops {
  /** Orden de llegada: el primero de la lista es el candidato a ser pausado. */
  private activos: HTMLVideoElement[] = []

  pedirTurno(video: HTMLVideoElement) {
    if (this.activos.includes(video)) return

    this.activos.push(video)

    while (this.activos.length > CUPO) {
      const masAntiguo = this.activos.shift()
      if (masAntiguo && masAntiguo !== video) {
        masAntiguo.pause()
      }
    }

    // play() devuelve una promesa que el navegador rechaza si la política de
    // autoreproducción lo impide. Sin catch, se ve un error no capturado en la
    // consola cada vez que alguien desplaza rápido.
    void video.play().catch(() => {})
  }

  soltar(video: HTMLVideoElement) {
    this.activos = this.activos.filter((v) => v !== video)
    video.pause()
  }
}

const gestor = new GestorDeLoops()

/**
 * ¿Debe este dispositivo reproducir loops decorativos?
 *
 * Dos casos en que la respuesta es no:
 *   · prefers-reduced-motion: el usuario pidió al sistema menos movimiento.
 *     Puede ser una preferencia estética o puede ser vestibular; se respeta.
 *   · saveData: el usuario activó el ahorro de datos. Un loop de 6 s son cientos
 *     de kilobytes que no pidió.
 *
 * En ambos casos la tarjeta se queda en el poster, que es lo que hay que
 * mostrar de todas formas.
 */
function loopsPermitidos(): boolean {
  if (typeof window === 'undefined') return false

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return false
  }

  const conexion = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection
  if (conexion?.saveData) return false

  return true
}

/**
 * Conecta un <video> al gestor: se reproduce cuando entra en pantalla y se
 * pausa al salir, siempre dentro del cupo global.
 *
 * Devuelve `activo`, útil para cruzar el poster con el video sin parpadeo.
 */
export function useLoopEnViewport<T extends HTMLVideoElement>(
  ref: React.RefObject<T | null>,
  { habilitado = true }: { habilitado?: boolean } = {},
) {
  const [activo, setActivo] = useState(false)
  const permitidoRef = useRef<boolean | null>(null)

  useEffect(() => {
    const video = ref.current
    if (!video || !habilitado) return

    if (permitidoRef.current === null) {
      permitidoRef.current = loopsPermitidos()
    }
    if (!permitidoRef.current) return

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          gestor.pedirTurno(video)
          setActivo(true)
        } else {
          gestor.soltar(video)
          setActivo(false)
        }
      },
      // 40 %: el loop arranca cuando la tarjeta ya es claramente visible, no
      // cuando asoma un píxel por el borde inferior.
      { threshold: 0.4 },
    )

    observador.observe(video)

    return () => {
      observador.disconnect()
      gestor.soltar(video)
    }
  }, [ref, habilitado])

  return activo
}
