'use client'

import { useCallback, useEffect, useState } from 'react'

import { ModalProyecto } from './ModalProyecto'
import { Social } from './Social'
import { TarjetaProyecto } from './TarjetaProyecto'
import type { ProyectoPublico } from './tipos'

type Pestana = 'comerciales' | 'social'

export function Trabajo({
  horizontales,
  verticales,
}: {
  horizontales: ProyectoPublico[]
  verticales: ProyectoPublico[]
}) {
  const [pestana, setPestana] = useState<Pestana>('comerciales')
  const [abierto, setAbierto] = useState<ProyectoPublico | null>(null)

  /**
   * La ficha vive en el estado del cliente, pero refleja su slug en la URL con
   * history.pushState. Así el botón "atrás" del teléfono cierra la ficha en vez
   * de sacar al visitante del sitio, y el enlace se puede compartir: /proyecto/
   * <slug> existe como página real para quien lo abra en frío.
   */
  const abrir = useCallback((proyecto: ProyectoPublico) => {
    setAbierto(proyecto)
    window.history.pushState({ ficha: proyecto.slug }, '', `/proyecto/${proyecto.slug}`)
  }, [])

  const cerrar = useCallback(() => {
    setAbierto(null)
    if (window.history.state?.ficha) window.history.back()
    else window.history.replaceState({}, '', '/')
  }, [])

  useEffect(() => {
    const alVolver = () => setAbierto(null)
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [])

  return (
    <section id="trabajo" className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
      <div
        role="tablist"
        aria-label="Formatos"
        className="flex items-center gap-8 border-b border-white/10 pb-4"
      >
        <BotonPestana
          activa={pestana === 'comerciales'}
          onClick={() => setPestana('comerciales')}
          id="pestana-comerciales"
          controla="panel-comerciales"
        >
          Comerciales
        </BotonPestana>
        <BotonPestana
          activa={pestana === 'social'}
          onClick={() => setPestana('social')}
          id="pestana-social"
          controla="panel-social"
        >
          Social
        </BotonPestana>
      </div>

      <div
        role="tabpanel"
        id="panel-comerciales"
        aria-labelledby="pestana-comerciales"
        hidden={pestana !== 'comerciales'}
        className="mt-10"
      >
        {horizontales.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {horizontales.map((proyecto, i) => (
              <TarjetaProyecto
                key={proyecto.id}
                proyecto={proyecto}
                onAbrir={() => abrir(proyecto)}
                // Las tres primeras entran en pantalla sin desplazar: cargarlas
                // con prioridad mejora el LCP; hacerlo con todas lo empeora.
                prioridad={i < 3}
              />
            ))}
          </div>
        ) : (
          <Vacio texto="Todavía no hay comerciales publicados." />
        )}
      </div>

      <div
        role="tabpanel"
        id="panel-social"
        aria-labelledby="pestana-social"
        hidden={pestana !== 'social'}
        className="mt-10"
      >
        {/* Se monta solo al elegir la pestaña: el feed vertical descarga video
            y no tiene por qué hacerlo quien nunca lo abre. */}
        {pestana === 'social' ? (
          verticales.length > 0 ? (
            <Social proyectos={verticales} onAbrir={abrir} />
          ) : (
            <Vacio texto="Todavía no hay piezas verticales publicadas." />
          )
        ) : null}
      </div>

      <ModalProyecto proyecto={abierto} onCerrar={cerrar} />
    </section>
  )
}

function BotonPestana({
  activa,
  onClick,
  id,
  controla,
  children,
}: {
  activa: boolean
  onClick: () => void
  id: string
  controla: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={activa}
      aria-controls={controla}
      onClick={onClick}
      className={`h-11 font-[family-name:var(--fuente-sans)] text-[0.7rem] uppercase tracking-[0.25em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
        activa ? 'text-white' : 'text-white/40 hover:text-white/70'
      }`}
    >
      {children}
    </button>
  )
}

function Vacio({ texto }: { texto: string }) {
  return (
    <p className="py-16 text-center font-[family-name:var(--fuente-sans)] text-[0.7rem] uppercase tracking-[0.25em] text-white/30">
      {texto}
    </p>
  )
}
