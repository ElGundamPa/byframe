'use client'

import { useState, useTransition } from 'react'

import { guardarAjustes } from '@/lib/admin/acciones'
import { SubidaArchivo } from './SubidaArchivo'
import {
  AvisoEstado,
  Boton,
  Campo,
  claseArea,
  claseEntrada,
  type Estado,
  useAvisoDeSalida,
} from './ui'

export type ValoresAjustes = {
  contacto: { email: string; whatsapp: string; ciudad: string }
  redes: { instagram: string; vimeo: string; youtube: string }
  nosotros: { titulo: string; texto: string }
  seo: { title: string; description: string; og_image: string }
}

export function FormularioAjustes({ inicial }: { inicial: ValoresAjustes }) {
  const [valores, setValores] = useState(inicial)
  const [sucio, setSucio] = useState(false)
  const [estado, setEstado] = useState<Estado>({ tipo: 'inactivo' })
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [pendiente, iniciarTransicion] = useTransition()

  useAvisoDeSalida(sucio)

  function actualizar<S extends keyof ValoresAjustes>(
    seccion: S,
    parcial: Partial<ValoresAjustes[S]>,
  ) {
    setValores((previos) => ({
      ...previos,
      [seccion]: { ...previos[seccion], ...parcial },
    }))
    setSucio(true)
  }

  const enviar = () => {
    setEstado({ tipo: 'guardando' })
    setErrores({})
    iniciarTransicion(async () => {
      const resultado = await guardarAjustes(valores)
      if (resultado.ok) {
        setSucio(false)
        setEstado({ tipo: 'exito', mensaje: 'Ajustes guardados.' })
      } else {
        setErrores(resultado.campos ?? {})
        setEstado({ tipo: 'error', mensaje: resultado.error })
      }
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        enviar()
      }}
      className="max-w-2xl space-y-10"
    >
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-neutral-900">Contacto</legend>

        <Campo etiqueta="Correo" id="email" error={errores['contacto.email']}>
          <input
            id="email"
            type="email"
            value={valores.contacto.email}
            onChange={(e) => actualizar('contacto', { email: e.target.value })}
            className={claseEntrada}
          />
        </Campo>

        <Campo
          etiqueta="WhatsApp"
          id="whatsapp"
          error={errores['contacto.whatsapp']}
          ayuda="Con indicativo de país. El sitio quita espacios y signos para armar el enlace de wa.me."
        >
          <input
            id="whatsapp"
            value={valores.contacto.whatsapp}
            onChange={(e) => actualizar('contacto', { whatsapp: e.target.value })}
            className={claseEntrada}
            placeholder="+57 300 000 0000"
          />
        </Campo>

        <Campo etiqueta="Ciudad" id="ciudad" error={errores['contacto.ciudad']}>
          <input
            id="ciudad"
            value={valores.contacto.ciudad}
            onChange={(e) => actualizar('contacto', { ciudad: e.target.value })}
            className={claseEntrada}
          />
        </Campo>
      </fieldset>

      <fieldset className="space-y-5 border-t border-neutral-200 pt-8">
        <legend className="text-base font-semibold text-neutral-900">Redes</legend>
        <p className="text-sm text-neutral-500">
          URL completa, con https. Las vacías no se muestran.
        </p>

        {(['instagram', 'vimeo', 'youtube'] as const).map((red) => (
          <Campo
            key={red}
            etiqueta={red}
            id={red}
            error={errores[`redes.${red}`]}
          >
            <input
              id={red}
              value={valores.redes[red]}
              onChange={(e) => actualizar('redes', { [red]: e.target.value })}
              className={claseEntrada}
              placeholder="https://…"
            />
          </Campo>
        ))}
      </fieldset>

      <fieldset className="space-y-5 border-t border-neutral-200 pt-8">
        <legend className="text-base font-semibold text-neutral-900">Nosotros</legend>

        <Campo etiqueta="Título" id="nosotros-titulo" error={errores['nosotros.titulo']}>
          <input
            id="nosotros-titulo"
            value={valores.nosotros.titulo}
            onChange={(e) => actualizar('nosotros', { titulo: e.target.value })}
            className={claseEntrada}
          />
        </Campo>

        <Campo etiqueta="Texto" id="nosotros-texto" error={errores['nosotros.texto']}>
          <textarea
            id="nosotros-texto"
            rows={6}
            value={valores.nosotros.texto}
            onChange={(e) => actualizar('nosotros', { texto: e.target.value })}
            className={claseArea}
          />
        </Campo>
      </fieldset>

      <fieldset className="space-y-5 border-t border-neutral-200 pt-8">
        <legend className="text-base font-semibold text-neutral-900">
          Metadatos y buscadores
        </legend>

        <Campo
          etiqueta="Título por defecto"
          id="seo-title"
          error={errores['seo.title']}
          ayuda="Lo que se ve en la pestaña del navegador y en el resultado de Google."
        >
          <input
            id="seo-title"
            value={valores.seo.title}
            onChange={(e) => actualizar('seo', { title: e.target.value })}
            className={claseEntrada}
          />
        </Campo>

        <Campo
          etiqueta="Descripción"
          id="seo-description"
          error={errores['seo.description']}
        >
          <textarea
            id="seo-description"
            rows={3}
            value={valores.seo.description}
            onChange={(e) => actualizar('seo', { description: e.target.value })}
            className={claseArea}
          />
        </Campo>

        <Campo
          etiqueta="Imagen Open Graph"
          id="og_image"
          error={errores['seo.og_image']}
          ayuda="La miniatura que aparece al pegar el enlace en WhatsApp o Instagram. 1200×630."
        >
          <input
            id="og_image"
            value={valores.seo.og_image}
            onChange={(e) => actualizar('seo', { og_image: e.target.value })}
            className={claseEntrada}
          />
          <div className="mt-2">
            <SubidaArchivo
              slug="og"
              tipo="sitio"
              etiqueta="Subir imagen"
              onSubido={(ruta) => actualizar('seo', { og_image: ruta })}
            />
          </div>
        </Campo>
      </fieldset>

      <div className="flex items-center gap-4 border-t border-neutral-200 pt-6">
        <Boton type="submit" variante="primario" disabled={pendiente}>
          Guardar ajustes
        </Boton>
        {sucio ? (
          <span className="text-xs text-neutral-500">Cambios sin guardar</span>
        ) : null}
        <div className="ml-auto">
          <AvisoEstado estado={estado} />
        </div>
      </div>
    </form>
  )
}
