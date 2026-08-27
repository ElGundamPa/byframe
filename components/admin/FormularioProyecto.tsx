'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { FichaProyecto } from '@/components/site/FichaProyecto'
import { guardarProyecto } from '@/lib/admin/acciones'
import { esquemaJsonDelScript } from '@/lib/admin/esquemas'
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

type Credito = { id?: string; role: string; name: string }

export type ValoresProyecto = {
  id?: string
  slug: string
  title: string
  client: string
  year: string
  format: 'horizontal' | 'vertical'
  description: string
  hls_url: string
  poster_url: string
  loop_url: string
  youtube_id: string
  duration: string
  published: boolean
  credits: Credito[]
}

export const PROYECTO_VACIO: ValoresProyecto = {
  slug: '',
  title: '',
  client: '',
  year: String(new Date().getFullYear()),
  format: 'horizontal',
  description: '',
  hls_url: '',
  poster_url: '',
  loop_url: '',
  youtube_id: '',
  duration: '',
  published: false,
  credits: [],
}

/**
 * Genera un slug a partir del título.
 *
 * Quita los acentos descomponiendo en Unicode y borrando los diacríticos, para
 * que «Cañón» acabe en «canon» y no en «ca-n-n». El slug es la carpeta del
 * proyecto en el bucket y viaja en la URL: ahí no caben ni tildes ni eñes.
 */
function slugificar(texto: string): string {
  return texto
    .normalize('NFD')
    // \p{Diacritic} en vez del rango literal de combinantes: son caracteres
    // invisibles en el código fuente y cualquier editor descuidado los pierde.
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function FormularioProyecto({
  inicial,
  esNuevo,
}: {
  inicial: ValoresProyecto
  esNuevo: boolean
}) {
  const router = useRouter()
  const [pendiente, iniciarTransicion] = useTransition()
  const [valores, setValores] = useState(inicial)
  const [sucio, setSucio] = useState(false)
  const [estado, setEstado] = useState<Estado>({ tipo: 'inactivo' })
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [slugTocado, setSlugTocado] = useState(!esNuevo)
  const [verPrevia, setVerPrevia] = useState(false)

  useAvisoDeSalida(sucio)

  const actualizar = (parcial: Partial<ValoresProyecto>) => {
    setValores((previos) => ({ ...previos, ...parcial }))
    setSucio(true)
  }

  /** El slug sigue al título mientras nadie lo edite a mano. */
  const alCambiarTitulo = (title: string) => {
    actualizar(slugTocado ? { title } : { title, slug: slugificar(title) })
  }

  const pegarJson = async () => {
    setErrores({})
    try {
      const texto = await navigator.clipboard.readText()
      const analisis = esquemaJsonDelScript.safeParse(JSON.parse(texto))
      if (!analisis.success) {
        setEstado({
          tipo: 'error',
          mensaje:
            'El portapapeles no tiene el JSON del script: faltan hls_url, poster_url o loop_url.',
        })
        return
      }
      actualizar({
        hls_url: analisis.data.hls_url,
        poster_url: analisis.data.poster_url,
        loop_url: analisis.data.loop_url,
        duration:
          analisis.data.duration !== undefined
            ? String(analisis.data.duration)
            : valores.duration,
      })
      setEstado({ tipo: 'exito', mensaje: 'Rutas pegadas desde el script.' })
    } catch {
      // Safari y Firefox pueden negar el acceso al portapapeles sin gesto
      // explícito; en ese caso, pegar a mano en los campos sigue funcionando.
      setEstado({
        tipo: 'error',
        mensaje: 'No se pudo leer el portapapeles. Pega las rutas a mano en los tres campos.',
      })
    }
  }

  const enviar = (publicar?: boolean) => {
    setEstado({ tipo: 'guardando' })
    setErrores({})

    const entrada = {
      id: valores.id,
      slug: valores.slug,
      title: valores.title,
      client: valores.client,
      year: valores.year === '' ? null : Number(valores.year),
      format: valores.format,
      description: valores.description,
      hls_url: valores.hls_url,
      poster_url: valores.poster_url,
      loop_url: valores.loop_url,
      youtube_id: valores.youtube_id,
      duration: valores.duration === '' ? null : Number(valores.duration),
      published: publicar ?? valores.published,
      credits: valores.credits.map(({ role, name }) => ({ role, name })),
    }

    iniciarTransicion(async () => {
      const resultado = await guardarProyecto(entrada)

      if (resultado.ok) {
        setSucio(false)
        setEstado({
          tipo: 'exito',
          mensaje: entrada.published ? 'Guardado y publicado.' : 'Guardado como borrador.',
        })
        if (esNuevo && resultado.datos) {
          router.replace(`/admin/proyectos/${resultado.datos.id}`)
        }
        router.refresh()
      } else {
        setErrores(resultado.campos ?? {})
        setEstado({ tipo: 'error', mensaje: resultado.error })
      }
    })
  }

  const moverCredito = (indice: number, direccion: -1 | 1) => {
    const destino = indice + direccion
    if (destino < 0 || destino >= valores.credits.length) return
    const creditos = [...valores.credits]
    ;[creditos[indice], creditos[destino]] = [creditos[destino], creditos[indice]]
    actualizar({ credits: creditos })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        enviar()
      }}
      className="space-y-10"
    >
      {/* ── Datos ─────────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo etiqueta="Título" id="title" error={errores.title}>
            <input
              id="title"
              value={valores.title}
              onChange={(e) => alCambiarTitulo(e.target.value)}
              className={claseEntrada}
              required
            />
          </Campo>

          <Campo
            etiqueta="Slug"
            id="slug"
            error={errores.slug}
            ayuda="Carpeta del proyecto en el bucket. Debe coincidir con el --slug del script."
          >
            <input
              id="slug"
              value={valores.slug}
              onChange={(e) => {
                setSlugTocado(true)
                actualizar({ slug: e.target.value })
              }}
              className={claseEntrada}
              required
            />
          </Campo>

          <Campo etiqueta="Cliente" id="client" error={errores.client}>
            <input
              id="client"
              value={valores.client}
              onChange={(e) => actualizar({ client: e.target.value })}
              className={claseEntrada}
            />
          </Campo>

          <div className="grid grid-cols-2 gap-5">
            <Campo etiqueta="Año" id="year" error={errores.year}>
              <input
                id="year"
                type="number"
                inputMode="numeric"
                value={valores.year}
                onChange={(e) => actualizar({ year: e.target.value })}
                className={claseEntrada}
              />
            </Campo>

            <Campo etiqueta="Formato" id="format" error={errores.format}>
              <select
                id="format"
                value={valores.format}
                onChange={(e) =>
                  actualizar({ format: e.target.value as 'horizontal' | 'vertical' })
                }
                className={claseEntrada}
              >
                <option value="horizontal">Horizontal (16:9)</option>
                <option value="vertical">Vertical (9:16)</option>
              </select>
            </Campo>
          </div>
        </div>

        <Campo etiqueta="Descripción" id="description" error={errores.description}>
          <textarea
            id="description"
            rows={4}
            value={valores.description}
            onChange={(e) => actualizar({ description: e.target.value })}
            className={claseArea}
          />
        </Campo>
      </section>

      {/* ── Archivos ──────────────────────────────────────────────────── */}
      <section className="space-y-5 border-t border-neutral-200 pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Archivos</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Pega aquí lo que imprime <code>npm run transcode</code>.
            </p>
          </div>
          <Boton type="button" onClick={pegarJson}>
            Pegar JSON del script
          </Boton>
        </div>

        <Campo
          etiqueta="Manifiesto HLS"
          id="hls_url"
          error={errores.hls_url}
          ayuda="La carpeta HLS siempre se sube con el script: no se puede subir desde aquí."
        >
          <input
            id="hls_url"
            value={valores.hls_url}
            onChange={(e) => actualizar({ hls_url: e.target.value })}
            className={claseEntrada}
            placeholder="https://media.byframe.co/projects/slug/hls/master.m3u8"
          />
        </Campo>

        <Campo etiqueta="Póster" id="poster_url" error={errores.poster_url}>
          <input
            id="poster_url"
            value={valores.poster_url}
            onChange={(e) => actualizar({ poster_url: e.target.value })}
            className={claseEntrada}
          />
          <div className="mt-2">
            <SubidaArchivo
              slug={valores.slug}
              tipo="poster"
              etiqueta="Subir póster"
              ayuda="Alternativa manual: WebP, AVIF, JPG o PNG."
              onSubido={(ruta) => actualizar({ poster_url: ruta })}
            />
          </div>
        </Campo>

        <Campo etiqueta="Loop" id="loop_url" error={errores.loop_url}>
          <input
            id="loop_url"
            value={valores.loop_url}
            onChange={(e) => actualizar({ loop_url: e.target.value })}
            className={claseEntrada}
          />
          <div className="mt-2">
            <SubidaArchivo
              slug={valores.slug}
              tipo="loop"
              etiqueta="Subir loop"
              ayuda="mp4 mudo y corto. Es lo que se reproduce en la rejilla."
              onSubido={(ruta) => actualizar({ loop_url: ruta })}
            />
          </div>
        </Campo>

        <Campo
          etiqueta="Video de YouTube"
          id="youtube_id"
          error={errores.youtube_id}
          ayuda="Para piezas que viven en el canal del artista. Pega el enlace completo: el panel extrae el id. Si hay manifiesto propio, ese manda."
        >
          <input
            id="youtube_id"
            value={valores.youtube_id}
            onChange={(e) => actualizar({ youtube_id: e.target.value })}
            className={claseEntrada}
            placeholder="https://youtu.be/…"
          />
        </Campo>

        <Campo
          etiqueta="Duración (segundos)"
          id="duration"
          error={errores.duration}
        >
          <input
            id="duration"
            type="number"
            inputMode="numeric"
            value={valores.duration}
            onChange={(e) => actualizar({ duration: e.target.value })}
            className={`${claseEntrada} max-w-[12rem]`}
          />
        </Campo>
      </section>

      {/* ── Créditos ──────────────────────────────────────────────────── */}
      <section className="space-y-4 border-t border-neutral-200 pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">Créditos</h2>
          <Boton
            type="button"
            onClick={() =>
              actualizar({ credits: [...valores.credits, { role: '', name: '' }] })
            }
          >
            Añadir línea
          </Boton>
        </div>

        {valores.credits.length === 0 ? (
          <p className="rounded-md border border-dashed border-neutral-300 py-8 text-center text-sm text-neutral-500">
            Sin créditos todavía.
          </p>
        ) : (
          <ul className="space-y-2">
            {valores.credits.map((credito, indice) => (
              <li key={indice} className="flex flex-wrap items-center gap-2">
                <input
                  value={credito.role}
                  onChange={(e) => {
                    const creditos = [...valores.credits]
                    creditos[indice] = { ...credito, role: e.target.value }
                    actualizar({ credits: creditos })
                  }}
                  placeholder="Rol"
                  aria-label={`Rol del crédito ${indice + 1}`}
                  className={`${claseEntrada} mt-0 w-full sm:w-56`}
                />
                <input
                  value={credito.name}
                  onChange={(e) => {
                    const creditos = [...valores.credits]
                    creditos[indice] = { ...credito, name: e.target.value }
                    actualizar({ credits: creditos })
                  }}
                  placeholder="Nombre"
                  aria-label={`Nombre del crédito ${indice + 1}`}
                  className={`${claseEntrada} mt-0 w-full flex-1 sm:w-auto`}
                />
                <div className="flex gap-1">
                  {/* Botones y no arrastrar: son cinco líneas y, con teclado o
                      lector de pantalla, subir y bajar es accesible sin más. */}
                  <Boton
                    type="button"
                    onClick={() => moverCredito(indice, -1)}
                    aria-label={`Subir crédito ${indice + 1}`}
                    className="w-11 px-0"
                  >
                    ↑
                  </Boton>
                  <Boton
                    type="button"
                    onClick={() => moverCredito(indice, 1)}
                    aria-label={`Bajar crédito ${indice + 1}`}
                    className="w-11 px-0"
                  >
                    ↓
                  </Boton>
                  <Boton
                    type="button"
                    variante="peligro"
                    aria-label={`Quitar crédito ${indice + 1}`}
                    className="w-11 px-0"
                    onClick={() =>
                      actualizar({
                        credits: valores.credits.filter((_, i) => i !== indice),
                      })
                    }
                  >
                    ×
                  </Boton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Vista previa ──────────────────────────────────────────────── */}
      <section className="border-t border-neutral-200 pt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Vista previa</h2>
            <p className="mt-1 text-sm text-neutral-500">
              El mismo reproductor del sitio, antes de publicar.
            </p>
          </div>
          <Boton type="button" onClick={() => setVerPrevia((v) => !v)}>
            {verPrevia ? 'Ocultar' : 'Ver'}
          </Boton>
        </div>

        {verPrevia ? (
          <div className="mt-5 rounded-lg bg-black p-5">
            <FichaProyecto
              tituloComo="h2"
              proyecto={{
                title: valores.title || 'Sin título',
                client: valores.client || null,
                year: valores.year ? Number(valores.year) : null,
                format: valores.format,
                description: valores.description || null,
                hls_url: valores.hls_url || null,
                poster_url: valores.poster_url || null,
                youtube_id: valores.youtube_id || null,
                project_credits: valores.credits.map((c, i) => ({
                  id: String(i),
                  role: c.role,
                  name: c.name,
                })),
              }}
            />
          </div>
        ) : null}
      </section>

      {/* ── Guardar ───────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center gap-3 border-t border-neutral-200 bg-white/95 px-6 py-4 backdrop-blur">
        <Boton type="submit" variante="primario" disabled={pendiente}>
          {valores.published ? 'Guardar' : 'Guardar borrador'}
        </Boton>

        {!valores.published ? (
          <Boton type="button" disabled={pendiente} onClick={() => enviar(true)}>
            Guardar y publicar
          </Boton>
        ) : (
          <Boton type="button" disabled={pendiente} onClick={() => enviar(false)}>
            Pasar a borrador
          </Boton>
        )}

        <span className="text-xs text-neutral-500">
          {valores.published ? 'Publicado' : 'Borrador'}
          {sucio ? ' · cambios sin guardar' : ''}
        </span>

        <div className="ml-auto">
          <AvisoEstado estado={estado} />
        </div>
      </div>
    </form>
  )
}
