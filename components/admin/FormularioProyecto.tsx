'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { FichaProyecto } from '@/components/site/FichaProyecto'
import { guardarProyecto } from '@/lib/admin/acciones'
import { esquemaProyecto } from '@/lib/admin/esquemas'
import { resolverMedia } from '@/lib/media'
import { extraerIdDeYoutube } from '@/lib/youtube'
import { SubidaArchivo } from './SubidaArchivo'
import { SubidaVideo } from './SubidaVideo'
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
  year: '',
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
function slugificar(texto: string) {
  return (
    texto
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 65) || 'proyecto'
  )
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
  const [valores, setValores] = useState(() => {
    const youtube = extraerIdDeYoutube(inicial.youtube_id)
    return {
      ...inicial,
      youtube_id: youtube
        ? `https://www.youtube.com/watch?v=${youtube}`
        : inicial.youtube_id,
    }
  })
  const [sucio, setSucio] = useState(false)
  const [estado, setEstado] = useState<Estado>({ tipo: 'inactivo' })
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [slugFijo, setSlugFijo] = useState(!esNuevo)
  const [verPrevia, setVerPrevia] = useState(false)
  const [fuente, setFuente] = useState<'video' | 'youtube'>(
    inicial.youtube_id && !inicial.hls_url ? 'youtube' : 'video',
  )
  const [subiendo, setSubiendo] = useState(false)
  const [sufijo] = useState(() => crypto.randomUUID().slice(0, 8))
  const bloqueado = pendiente || subiendo
  const slug = valores.slug || `proyecto-${sufijo}`
  const youtubeId = extraerIdDeYoutube(valores.youtube_id)
  useAvisoDeSalida(sucio || subiendo)

  const actualizar = (parcial: Partial<ValoresProyecto>) => {
    setValores((previos) => ({ ...previos, ...parcial }))
    setSucio(true)
    setEstado({ tipo: 'inactivo' })
    setErrores((previos) =>
      Object.fromEntries(
        Object.entries(previos).filter(
          ([campo]) =>
            !(campo in parcial) &&
            !(campo === 'hls_url' && 'youtube_id' in parcial),
        ),
      ),
    )
  }
  const alCambiarTitulo = (title: string) =>
    actualizar(
      slugFijo ? { title } : { title, slug: `${slugificar(title)}-${sufijo}` },
    )
  const enviar = (publicar?: boolean) => {
    if (bloqueado) return
    const entrada = {
      ...valores,
      slug,
      year: valores.year === '' ? null : Number(valores.year),
      duration:
        fuente === 'youtube' || valores.duration === ''
          ? null
          : Number(valores.duration),
      hls_url: fuente === 'video' ? valores.hls_url : '',
      // Mantiene el respaldo de YouTube de los proyectos HLS existentes.
      youtube_id:
        fuente === 'youtube'
          ? valores.youtube_id
          : inicial.hls_url
            ? inicial.youtube_id
            : '',
      loop_url: fuente === 'video' ? valores.loop_url : '',
      published: publicar ?? valores.published,
      credits: valores.credits.map(({ role, name }) => ({ role, name })),
    }
    const analisis = esquemaProyecto.safeParse(entrada)
    if (!analisis.success) {
      const campos: Record<string, string> = {}
      for (const problema of analisis.error.issues) {
        const campo = String(problema.path[0])
        campos[campo] ??= problema.message
      }
      setErrores(campos)
      setEstado({
        tipo: 'error',
        mensaje: 'Revisa los campos indicados antes de guardar.',
      })
      return
    }
    setEstado({ tipo: 'guardando' })
    setErrores({})
    iniciarTransicion(async () => {
      try {
        const resultado = await guardarProyecto(entrada)
        if (!resultado.ok) {
          setErrores(resultado.campos ?? {})
          setEstado({ tipo: 'error', mensaje: resultado.error })
          return
        }
        if (resultado.datos) {
          const { id, published } = resultado.datos
          setValores((previos) => ({ ...previos, id, slug, published }))
          setSlugFijo(true)
        }
        setSucio(false)
        setEstado({
          tipo: 'exito',
          mensaje: entrada.published
            ? 'Guardado y publicado.'
            : 'Guardado como borrador.',
        })
        if (esNuevo && !valores.id && resultado.datos)
          router.replace(`/admin/proyectos/${resultado.datos.id}`)
        router.refresh()
      } catch {
        setEstado({
          tipo: 'error',
          mensaje:
            'No se pudo guardar. Tus cambios siguen aquí; vuelve a intentarlo.',
        })
      }
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        enviar()
      }}
      className="space-y-6"
    >
      <fieldset disabled={pendiente} className="min-w-0 space-y-6">
        <Campo
          etiqueta="Título del proyecto"
          id="title"
          error={errores.title || errores.slug}
        >
          <input
            id="title"
            value={valores.title}
            disabled={subiendo}
            required
            maxLength={160}
            placeholder="Por ejemplo: Videoclip de la banda"
            className={claseEntrada}
            onChange={(e) => alCambiarTitulo(e.target.value)}
          />
        </Campo>
        <section aria-labelledby="video-label" className="space-y-4">
          <h2 id="video-label" className="text-sm font-medium text-neutral-700">
            Video
          </h2>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Cómo añadir el video"
          >
            {(['video', 'youtube'] as const).map((opcion) => (
              <Boton
                key={opcion}
                type="button"
                disabled={subiendo}
                aria-pressed={fuente === opcion}
                variante={fuente === opcion ? 'primario' : 'secundario'}
                onClick={() => {
                  if (opcion !== fuente)
                    actualizar({ poster_url: '', loop_url: '' })
                  setFuente(opcion)
                  setSucio(true)
                  setErrores({})
                  setEstado({ tipo: 'inactivo' })
                }}
              >
                {opcion === 'video' ? 'Subir video' : 'Enlace de YouTube'}
              </Boton>
            ))}
          </div>
          {fuente === 'video' ? (
            <>
              <SubidaVideo
                slug={slug}
                disabled={bloqueado}
                onOcupado={setSubiendo}
                onSubido={(datos) => {
                  actualizar({
                    hls_url: datos.url,
                    poster_url: datos.poster || valores.poster_url,
                    format: datos.format,
                    duration: String(datos.duration),
                    title: valores.title || datos.nombre,
                    slug,
                    loop_url: '',
                  })
                  setSlugFijo(true)
                }}
              />
              {valores.hls_url ? (
                <p className="text-sm text-green-700">
                  Video añadido. Puedes verlo antes de publicar o seleccionar
                  otro para reemplazarlo.
                </p>
              ) : null}
            </>
          ) : (
            <Campo
              etiqueta="Enlace de YouTube"
              id="youtube_id"
              error={errores.youtube_id}
            ayuda="Usa un video público o no listado. Su imagen de portada se añade automáticamente."
            >
              <input
                id="youtube_id"
                type="text"
                inputMode="url"
                disabled={subiendo}
                value={valores.youtube_id}
                placeholder="https://www.youtube.com/watch?v=…"
                className={claseEntrada}
                onChange={(e) =>
                  actualizar({
                    youtube_id: e.target.value,
                    ...(/\/shorts\//.test(e.target.value)
                      ? { format: 'vertical' as const }
                      : {}),
                  })
                }
              />
            </Campo>
          )}
          {errores.hls_url ? (
            <p role="alert" className="text-sm text-red-600">
              {errores.hls_url}
            </p>
          ) : null}
          <Campo
            etiqueta="Formato"
            id="format"
            error={errores.format}
            ayuda={
              fuente === 'video'
                ? 'Se detecta al subir el video. Puedes ajustarlo si lo necesitas.'
                : undefined
            }
          >
            <select
              id="format"
              value={valores.format}
              disabled={subiendo}
              className={`${claseEntrada} sm:max-w-xs`}
              onChange={(e) =>
                actualizar({
                  format: e.target.value as 'horizontal' | 'vertical',
                })
              }
            >
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
            </select>
          </Campo>
        </section>

        <details
          className="rounded-lg border border-neutral-200 bg-white p-5"
          open={
            Boolean(
              errores.client ||
                errores.year ||
                errores.description ||
                errores.poster_url ||
                errores.credits,
            ) || undefined
          }
        >
          <summary className="cursor-pointer text-sm font-medium text-neutral-700">
            Más detalles{' '}
            <span className="font-normal text-neutral-500">(opcional)</span>
          </summary>
          <div className="mt-5 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo etiqueta="Cliente" id="client" error={errores.client}>
                <input
                  id="client"
                  value={valores.client}
                  disabled={subiendo}
                  className={claseEntrada}
                  onChange={(e) => actualizar({ client: e.target.value })}
                />
              </Campo>
              <Campo etiqueta="Año" id="year" error={errores.year}>
                <input
                  id="year"
                  type="number"
                  min={1990}
                  max={2100}
                  value={valores.year}
                  disabled={subiendo}
                  className={claseEntrada}
                  onChange={(e) => actualizar({ year: e.target.value })}
                />
              </Campo>
            </div>
            <Campo
              etiqueta="Descripción"
              id="description"
              error={errores.description}
            >
              <textarea
                id="description"
                rows={3}
                value={valores.description}
                disabled={subiendo}
                className={claseArea}
                onChange={(e) => actualizar({ description: e.target.value })}
              />
            </Campo>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-neutral-700">
                Imagen de portada personalizada
              </h3>
              <p className="text-xs text-neutral-500">
                Solo si quieres usar una imagen diferente a la automática.
              </p>
              <SubidaArchivo
                slug={slug}
                tipo="miniatura"
                etiqueta="Elegir imagen"
                disabled={bloqueado}
                onOcupado={setSubiendo}
                onSubido={(ruta) => actualizar({ poster_url: ruta })}
              />
              {fuente === 'youtube' && valores.poster_url ? (
                <Boton
                  type="button"
                  disabled={subiendo}
                  onClick={() => actualizar({ poster_url: '' })}
                >
                  Usar imagen de YouTube
                </Boton>
              ) : null}
              {errores.poster_url ? (
                <p role="alert" className="text-sm text-red-600">
                  {errores.poster_url}
                </p>
              ) : null}
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-neutral-700">Créditos</h3>
              <p className="text-xs text-neutral-500">
                Personas que participaron, por ejemplo: Dirección — Ana.
              </p>
              {valores.credits.map((credito, indice) => (
                <div
                  key={credito.id || indice}
                  className="flex flex-wrap gap-2"
                >
                  <input
                    aria-label={`Rol del crédito ${indice + 1}`}
                    placeholder="Función"
                    value={credito.role}
                    disabled={subiendo}
                    className={`${claseEntrada} sm:flex-1 sm:w-auto`}
                    onChange={(e) =>
                      actualizar({
                        credits: valores.credits.map((c, i) =>
                          i === indice ? { ...c, role: e.target.value } : c,
                        ),
                      })
                    }
                  />
                  <input
                    aria-label={`Nombre del crédito ${indice + 1}`}
                    placeholder="Nombre"
                    value={credito.name}
                    disabled={subiendo}
                    className={`${claseEntrada} sm:flex-1 sm:w-auto`}
                    onChange={(e) =>
                      actualizar({
                        credits: valores.credits.map((c, i) =>
                          i === indice ? { ...c, name: e.target.value } : c,
                        ),
                      })
                    }
                  />
                  <Boton
                    type="button"
                    disabled={subiendo}
                    aria-label={`Quitar crédito ${indice + 1}`}
                    onClick={() =>
                      actualizar({
                        credits: valores.credits.filter((_, i) => i !== indice),
                      })
                    }
                  >
                    Quitar
                  </Boton>
                </div>
              ))}
              <Boton
                type="button"
                disabled={subiendo || valores.credits.length >= 60}
                onClick={() =>
                  actualizar({
                    credits: [...valores.credits, { role: '', name: '' }],
                  })
                }
              >
                Añadir persona
              </Boton>
              {errores.credits ? (
                <p role="alert" className="text-sm text-red-600">
                  {errores.credits}
                </p>
              ) : null}
            </div>
          </div>
        </details>

        {(
          fuente === 'video' ? Boolean(valores.hls_url) : Boolean(youtubeId)
        ) ? (
          <section className="space-y-4">
            <Boton
              type="button"
              disabled={subiendo}
              onClick={() => setVerPrevia((v) => !v)}
            >
              {verPrevia ? 'Ocultar vista previa' : 'Ver antes de publicar'}
            </Boton>
            {verPrevia ? (
              <div className="rounded-lg bg-black p-5">
                <FichaProyecto
                  tituloComo="h2"
                  proyecto={{
                    title: valores.title || 'Sin título',
                    client: valores.client || null,
                    year: valores.year ? Number(valores.year) : null,
                    format: valores.format,
                    description: valores.description || null,
                    hls_url:
                      fuente === 'video'
                        ? resolverMedia(valores.hls_url)
                        : null,
                    poster_url: resolverMedia(valores.poster_url),
                    youtube_id: fuente === 'youtube' ? youtubeId : null,
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
        ) : null}

        <AvisoEstado estado={estado} />
        <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center gap-3 border-t border-neutral-200 bg-white/95 px-6 py-4 backdrop-blur">
          <Boton
            type="submit"
            variante={valores.published ? 'primario' : 'secundario'}
            disabled={bloqueado}
          >
            {valores.published ? 'Guardar' : 'Guardar borrador'}
          </Boton>
          {!valores.published ? (
            <Boton
              type="button"
              variante="primario"
              disabled={bloqueado}
              onClick={() => enviar(true)}
            >
              Guardar y publicar
            </Boton>
          ) : (
            <Boton
              type="button"
              disabled={bloqueado}
              onClick={() => enviar(false)}
            >
              Pasar a borrador
            </Boton>
          )}
          <span className="text-xs text-neutral-500">
            {subiendo
              ? 'Espera a que termine la subida'
              : valores.published
                ? 'Publicado'
                : 'Todavía no visible en el sitio'}
          </span>
        </div>
      </fieldset>
    </form>
  )
}
