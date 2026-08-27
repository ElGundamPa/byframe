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

/* ── Turnos para las incrustaciones de YouTube ───────────────────────────── */

/**
 * Las piezas alojadas en YouTube no tienen loop propio: para que la rejilla se
 * mueva igual, se incrusta el reproductor en silencio detrás de la miniatura.
 *
 * El cupo aquí es más estricto —dos— porque un iframe de YouTube no es un
 * <video>: arrastra su propio reproductor, con megabytes de JavaScript y su
 * propia pila de red. Tres o cuatro a la vez hunden el desplazamiento en un
 * teléfono de gama media.
 *
 * A diferencia del gestor de loops, aquí no se pausa nada: el iframe se
 * desmonta al perder el turno, que es la única forma de que deje de consumir.
 */
const CUPO_YOUTUBE = 2

class GestorDeIncrustaciones {
  private activos: string[] = []
  private oyentes = new Map<string, (activo: boolean) => void>()

  registrar(clave: string, alCambiar: (activo: boolean) => void) {
    this.oyentes.set(clave, alCambiar)
    return () => {
      this.oyentes.delete(clave)
      this.soltar(clave)
    }
  }

  pedirTurno(clave: string) {
    if (this.activos.includes(clave)) return

    this.activos.push(clave)
    while (this.activos.length > CUPO_YOUTUBE) {
      const masAntiguo = this.activos.shift()
      if (masAntiguo && masAntiguo !== clave) {
        this.oyentes.get(masAntiguo)?.(false)
      }
    }
    this.oyentes.get(clave)?.(true)
  }

  soltar(clave: string) {
    this.activos = this.activos.filter((c) => c !== clave)
    this.oyentes.get(clave)?.(false)
  }
}

const gestorDeIncrustaciones = new GestorDeIncrustaciones()

/**
 * Indica si esta tarjeta puede montar su incrustación: está en pantalla y hay
 * turno libre.
 */
export function useTurnoDeIncrustacion(
  ref: React.RefObject<HTMLElement | null>,
  clave: string,
  { habilitado = true }: { habilitado?: boolean } = {},
) {
  const [activo, setActivo] = useState(false)

  useEffect(() => {
    const elemento = ref.current
    if (!elemento || !habilitado || !loopsPermitidos()) return

    const cancelarRegistro = gestorDeIncrustaciones.registrar(clave, setActivo)

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) gestorDeIncrustaciones.pedirTurno(clave)
        else gestorDeIncrustaciones.soltar(clave)
      },
      // Umbral más alto que el de los loops: montar un reproductor entero por
      // una tarjeta que apenas asoma no compensa.
      { threshold: 0.6 },
    )

    observador.observe(elemento)

    return () => {
      observador.disconnect()
      cancelarRegistro()
    }
  }, [ref, clave, habilitado])

  return activo
}
