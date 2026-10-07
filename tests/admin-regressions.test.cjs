const assert = require('node:assert/strict')
const test = require('node:test')
const { createLoader } = require('./helpers/load-ts.cjs')

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const project = {
  id: PROJECT_ID,
  slug: 'prueba', title: 'Prueba', client: null, year: 2026,
  format: 'horizontal', description: null,
  hls_url: '/media/prueba/master.m3u8', poster_url: null, loop_url: null,
  youtube_id: null, duration: null, published: false,
  credits: [{ role: 'Dirección', name: 'Persona' }],
}

function actions({ session = true, result } = {}) {
  const rpcCalls = []
  const invalidated = []
  const load = createLoader({
    'next/cache': { revalidateTag: (tag) => invalidated.push(tag) },
    '@/lib/supabase/server': {
      getUsuarioActual: async () => session ? { id: PROJECT_ID } : null,
      createClient: async () => ({
        rpc: async (name, args) => {
          rpcCalls.push({ name, args })
          return result ?? {
            data: [{ id: PROJECT_ID, slug: 'prueba', published: args.p_proyecto.published }],
            error: null,
          }
        },
        // Un guardado no debe volver a escribir proyecto y créditos por separado.
        from: () => { throw new Error('Escritura fuera de la transacción') },
      }),
    },
  })
  return { ...load('lib/admin/acciones.ts'), rpcCalls, invalidated }
}

test('el guardado usa una sola operación y devuelve la publicación confirmada', async () => {
  const env = actions()
  const result = await env.guardarProyecto({ ...project, published: true })
  assert.equal(result.ok, true)
  assert.equal(result.datos.published, true)
  assert.equal(env.rpcCalls.length, 1)
  assert.equal(env.rpcCalls[0].name, 'guardar_proyecto_con_creditos')
  assert.equal(env.rpcCalls[0].args.p_creditos[0].name, 'Persona')
  assert.deepEqual(env.invalidated, ['proyectos', 'hero'])
})

test('un error en créditos no anuncia éxito ni invalida la versión pública anterior', async () => {
  const env = actions({ result: { data: null, error: { code: '23514', message: 'Crédito rechazado' } } })
  const result = await env.guardarProyecto(project)
  assert.equal(result.ok, false)
  assert.match(result.error, /Crédito rechazado/)
  assert.equal(env.rpcCalls.length, 1)
  assert.deepEqual(env.invalidated, [])
})

test('un slug duplicado devuelve el error en el campo correspondiente', async () => {
  const env = actions({ result: { data: null, error: { code: '23505', message: 'Duplicado' } } })
  const result = await env.guardarProyecto(project)
  assert.equal(result.ok, false)
  assert.match(result.campos.slug, /en uso/)
})

test('sin sesión o con datos inválidos no se llama al guardado', async () => {
  const anonymous = actions({ session: false })
  assert.equal((await anonymous.guardarProyecto(project)).ok, false)
  assert.equal(anonymous.rpcCalls.length, 0)
  const invalid = actions()
  assert.equal((await invalid.guardarProyecto({ ...project, title: '' })).ok, false)
  assert.equal(invalid.rpcCalls.length, 0)
})

test('la ausencia de la migración no activa un guardado parcial de respaldo', async () => {
  const env = actions({ result: { data: null, error: { code: 'PGRST202', message: 'No existe la función' } } })
  assert.equal((await env.guardarProyecto(project)).ok, false)
  assert.equal(env.rpcCalls.length, 1)
  assert.deepEqual(env.invalidated, [])
})

function uploadRoute(session = true) {
  const signed = []
  const load = createLoader({
    'aws4fetch': {
      AwsClient: class {
        async sign(url, options) { signed.push({ url, options }); return { url } }
      },
    },
    'next/server': { NextResponse: { json: (value, options = {}) =>
      new Response(JSON.stringify(value), { status: options.status ?? 200 }) } },
    '@/lib/env': { getR2Config: () => ({
      endpoint: 'https://bucket.example', bucket: 'prueba',
      accessKeyId: 'fake', secretAccessKey: 'fake',
    }) },
    '@/lib/supabase/server': { getUsuarioActual: async () => session ? { id: PROJECT_ID } : null },
  })
  return { ...load('app/api/admin/upload-url/route.ts'), signed }
}

function uploadRequest(tipo, contentType) {
  return new Request('https://app.example/api/admin/upload-url', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slug: 'hero', tipo, nombreArchivo: 'archivo', contentType, tamano: 1024 }),
  })
}

test('MP4 de portada se firma en site, no en projects ni hls', async () => {
  const env = uploadRoute()
  const result = await env.POST(uploadRequest('portada', 'video/mp4'))
  assert.equal(result.status, 200)
  const body = await result.json()
  assert.equal(body.clave, 'site/hero.mp4')
  assert.equal(body.contentType, 'video/mp4')
  assert.equal(env.signed.length, 1)
})

test('se rechazan videos en campos de imagen e imágenes en campos de video', async () => {
  for (const [tipo, mime] of [['poster', 'video/mp4'], ['sitio', 'video/mp4'], ['portada', 'image/png'], ['loop', 'image/png']]) {
    const env = uploadRoute()
    assert.equal((await env.POST(uploadRequest(tipo, mime))).status, 400)
    assert.equal(env.signed.length, 0)
  }
})

test('la firma requiere una sesión válida', async () => {
  const env = uploadRoute(false)
  assert.equal((await env.POST(uploadRequest('portada', 'video/mp4'))).status, 401)
  assert.equal(env.signed.length, 0)
})

function formHarness(save) {
  const states = []
  let cursor = 0
  let pending = false
  let operation
  const navigations = []
  const load = createLoader({
    react: { ...require('react'),
      useState(initial) {
        const index = cursor++
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
        return [states[index], (next) => {
          states[index] = typeof next === 'function' ? next(states[index]) : next
        }]
      },
      useTransition: () => [pending, (callback) => {
        pending = true
        operation = Promise.resolve(callback()).finally(() => { pending = false })
      }],
    },
    'next/navigation': { useRouter: () => ({
      replace: (url) => navigations.push(url), refresh: () => {},
    }) },
    '@/components/site/FichaProyecto': { FichaProyecto: 'preview' },
    '@/lib/admin/acciones': { guardarProyecto: save },
    './SubidaArchivo': { SubidaArchivo: 'upload' },
    './SubidaVideo': { SubidaVideo: 'video-upload' },
    '@/lib/media': { resolverMedia: (url) => url || null },
    './ui': { Boton: 'button', Campo: 'label', AvisoEstado: 'status', useAvisoDeSalida: () => {} },
  })
  const { FormularioProyecto } = load('components/admin/FormularioProyecto.tsx')
  return {
    render(props) { cursor = 0; return FormularioProyecto(props) },
    wait: () => operation,
    navigations,
  }
}

function find(node, predicate) {
  if (node == null || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) { const found = find(child, predicate); if (found) return found }
    return null
  }
  if (predicate(node)) return node
  return find(node.props?.children, predicate)
}

const formValues = {
  ...project, client: '', year: '2026', description: '', poster_url: '',
  loop_url: '', youtube_id: '', duration: '',
}
function button(tree, name) {
  const result = find(tree, (node) => node.type === 'button' && node.props.children === name)
  assert.ok(result, `No se encontró el botón ${name}`)
  return result
}

test('publicar, guardar y pasar a borrador no vuelve a enviar el estado anterior', async () => {
  const saved = []
  const env = formHarness(async (input) => {
    saved.push(input)
    return { ok: true, datos: { id: PROJECT_ID, published: input.published } }
  })
  const props = { inicial: formValues, esNuevo: false }
  button(env.render(props), 'Guardar y publicar').props.onClick()
  await env.wait()
  let tree = env.render(props)
  button(tree, 'Pasar a borrador')
  assert.equal(find(tree, (node) => node.type === 'fieldset').props.disabled, false)
  tree.props.onSubmit({ preventDefault() {} })
  await env.wait()
  assert.equal(saved[1].published, true)
  button(env.render(props), 'Pasar a borrador').props.onClick()
  await env.wait()
  tree = env.render(props)
  button(tree, 'Guardar y publicar')
  tree.props.onSubmit({ preventDefault() {} })
  await env.wait()
  assert.equal(saved[3].published, false)
})

test('el formulario queda bloqueado mientras guarda y conserva el ID creado', async () => {
  let resolve
  const saved = []
  const env = formHarness((input) => {
    saved.push(input)
    return new Promise((done) => { resolve = done })
  })
  const props = { inicial: { ...formValues, id: undefined }, esNuevo: true }
  button(env.render(props), 'Guardar y publicar').props.onClick()
  const busy = env.render(props)
  assert.equal(find(busy, (node) => node.type === 'fieldset').props.disabled, true)
  busy.props.onSubmit({ preventDefault() {} })
  assert.equal(saved.length, 1)
  resolve({ ok: true, datos: { id: PROJECT_ID, published: true } })
  await env.wait()
  assert.equal(env.navigations[0], `/admin/proyectos/${PROJECT_ID}`)
  env.render(props).props.onSubmit({ preventDefault() {} })
  assert.equal(saved[1].id, PROJECT_ID)
  resolve({ ok: true, datos: { id: PROJECT_ID, published: true } })
  await env.wait()
  assert.equal(env.navigations.length, 1)
})

test('si falla publicar, el formulario conserva su estado de borrador', async () => {
  const env = formHarness(async () => ({ ok: false, error: 'No se pudo guardar' }))
  const props = { inicial: formValues, esNuevo: false }
  button(env.render(props), 'Guardar y publicar').props.onClick()
  await env.wait()
  button(env.render(props), 'Guardar y publicar')
})

test('un video MP4 se firma con ruta nueva sin sobrescribir el publicado', async () => {
  const env = uploadRoute()
  const first = await (await env.POST(uploadRequest('video', 'video/mp4'))).json()
  const second = await (await env.POST(uploadRequest('video', 'video/mp4'))).json()
  assert.match(first.clave, /^projects\/hero\/video-[a-f0-9-]+\.mp4$/)
  assert.notEqual(first.clave, second.clave)
  assert.equal((await env.POST(uploadRequest('video', 'image/jpeg'))).status, 400)
})

test('la miniatura automática admite una imagen y usa una ruta nueva', async () => {
  const env = uploadRoute()
  const body = await (await env.POST(uploadRequest('miniatura', 'image/jpeg'))).json()
  assert.match(body.clave, /^projects\/hero\/miniatura-[a-f0-9-]+\.jpg$/)
  assert.equal((await env.POST(uploadRequest('miniatura', 'video/mp4'))).status, 400)
})

test('YouTube válido se normaliza y un enlace inválido no escribe ni borra el video', async () => {
  const env = actions()
  const invalid = await env.guardarProyecto({ ...project, youtube_id: 'https://example.com/no-es-youtube' })
  assert.equal(invalid.ok, false)
  assert.match(invalid.campos.youtube_id, /enlace válido/)
  assert.equal(env.rpcCalls.length, 0)
  const valid = await env.guardarProyecto({ ...project, hls_url: '', youtube_id: 'https://youtu.be/abcdefghijk?t=2', published: true })
  assert.equal(valid.ok, true)
  assert.equal(env.rpcCalls[0].args.p_proyecto.youtube_id, 'abcdefghijk')
  assert.equal(env.rpcCalls[0].args.p_proyecto.hls_url, null)
  for (const url of ['https://notyoutube.com/watch?v=abcdefghijk', 'https://youtube.com.evil.example/watch?v=abcdefghijk']) {
    assert.equal((await env.guardarProyecto({ ...project, youtube_id: url })).ok, false)
  }
})

test('un borrador sin video es válido y publicar sin video se rechaza antes de escribir', async () => {
  const env = actions()
  const input = { ...project, hls_url: '', youtube_id: '' }
  assert.equal((await env.guardarProyecto(input)).ok, true)
  assert.equal((await env.guardarProyecto({ ...input, published: true })).ok, false)
  assert.equal(env.rpcCalls.length, 1)
})

test('el formulario permite título y YouTube sin rellenar datos opcionales', async () => {
  const saved = []
  const env = formHarness(async (input) => { saved.push(input); return { ok: true, datos: { id: PROJECT_ID, published: true } } })
  const props = { inicial: { ...formValues, id: undefined, hls_url: '', loop_url: '', credits: [], title: '', slug: '', year: '' }, esNuevo: true }
  let tree = env.render(props)
  find(tree, (node) => node.type === 'input' && node.props.id === 'title').props.onChange({ target: { value: 'Mi videoclip' } })
  tree = env.render(props)
  button(tree, 'Enlace de YouTube').props.onClick()
  tree = env.render(props)
  find(tree, (node) => node.type === 'input' && node.props.id === 'youtube_id').props.onChange({ target: { value: 'https://youtu.be/abcdefghijk' } })
  button(env.render(props), 'Guardar y publicar').props.onClick()
  await env.wait()
  assert.equal(saved[0].title, 'Mi videoclip')
  assert.match(saved[0].slug, /^mi-videoclip-[a-f0-9]{8}$/)
  assert.equal(saved[0].hls_url, '')
  assert.equal(saved[0].published, true)
  assert.equal(saved[0].year, null)
  assert.deepEqual(saved[0].credits, [])
})

test('cambiar de HLS a YouTube evita que se siga reproduciendo el video anterior', async () => {
  const saved = []
  const env = formHarness(async (input) => { saved.push(input); return { ok: true, datos: { id: PROJECT_ID, published: true } } })
  const props = { inicial: { ...formValues, loop_url: '/anterior.mp4', poster_url: '/anterior.jpg' }, esNuevo: false }
  button(env.render(props), 'Enlace de YouTube').props.onClick()
  const tree = env.render(props)
  find(tree, (node) => node.type === 'input' && node.props.id === 'youtube_id').props.onChange({ target: { value: 'https://youtu.be/abcdefghijk' } })
  button(env.render(props), 'Guardar y publicar').props.onClick()
  await env.wait()
  assert.equal(saved[0].hls_url, '')
  assert.equal(saved[0].loop_url, '')
  assert.equal(saved[0].poster_url, '')
})

test('no se guarda mientras hay una subida pendiente y se habilita al terminar', async () => {
  const saved = []
  const env = formHarness(async (input) => { saved.push(input); return { ok: true, datos: { id: PROJECT_ID, published: true } } })
  const props = { inicial: formValues, esNuevo: false }
  find(env.render(props), (node) => node.type === 'video-upload').props.onOcupado(true)
  let tree = env.render(props)
  assert.equal(button(tree, 'Guardar y publicar').props.disabled, true)
  button(tree, 'Guardar y publicar').props.onClick()
  assert.equal(saved.length, 0)
  find(tree, (node) => node.type === 'video-upload').props.onOcupado(false)
  tree = env.render(props)
  assert.equal(button(tree, 'Guardar y publicar').props.disabled, false)
})

test('la subida completa rellena título, duración, formato y miniatura antes de publicar', async () => {
  const saved = []
  const env = formHarness(async (input) => { saved.push(input); return { ok: true, datos: { id: PROJECT_ID, published: true } } })
  const props = { inicial: { ...formValues, id: undefined, slug: '', title: '', hls_url: '', credits: [] }, esNuevo: true }
  find(env.render(props), (node) => node.type === 'video-upload').props.onSubido({
    url: 'https://media.example/video-unique.mp4', poster: 'https://media.example/miniatura.jpg', format: 'vertical', duration: 12, nombre: 'Mi video',
  })
  button(env.render(props), 'Guardar y publicar').props.onClick()
  await env.wait()
  assert.equal(saved[0].title, 'Mi video')
  assert.equal(saved[0].format, 'vertical')
  assert.equal(saved[0].duration, 12)
  assert.equal(saved[0].poster_url, 'https://media.example/miniatura.jpg')
  assert.equal(saved[0].hls_url, 'https://media.example/video-unique.mp4')
  assert.equal(saved[0].youtube_id, '')
})

test('editar un proyecto de YouTube muestra un enlace completo en lugar de un ID técnico', () => {
  const env = formHarness(async () => ({ ok: true }))
  const props = { inicial: { ...formValues, hls_url: '', youtube_id: 'abcdefghijk' }, esNuevo: false }
  const input = find(env.render(props), (node) => node.type === 'input' && node.props.id === 'youtube_id')
  assert.equal(input.props.value, 'https://www.youtube.com/watch?v=abcdefghijk')
})

test('editar el título de YouTube conserva la portada y la previsualización existentes', async () => {
  const saved = []
  const env = formHarness(async (input) => { saved.push(input); return { ok: true, datos: { id: PROJECT_ID, published: true } } })
  const props = { inicial: { ...formValues, hls_url: '', youtube_id: 'abcdefghijk', poster_url: '/portada.jpg', loop_url: '/preview.mp4' }, esNuevo: false }
  find(env.render(props), (node) => node.type === 'input' && node.props.id === 'title').props.onChange({ target: { value: 'Título actualizado' } })
  button(env.render(props), 'Guardar y publicar').props.onClick()
  await env.wait()
  assert.equal(saved[0].poster_url, '/portada.jpg')
  assert.equal(saved[0].loop_url, '/preview.mp4')
})

test('reemplazar YouTube actualiza la portada, pero añadir parámetros al mismo video la conserva', async () => {
  const saved = []
  const env = formHarness(async (input) => { saved.push(input); return { ok: true, datos: { id: PROJECT_ID, published: true } } })
  const props = { inicial: { ...formValues, hls_url: '', youtube_id: 'abcdefghijk', poster_url: '/portada.jpg', loop_url: '/preview.mp4' }, esNuevo: false }
  find(env.render(props), (node) => node.type === 'input' && node.props.id === 'youtube_id').props.onChange({ target: { value: 'https://youtu.be/abcdefghijk?t=5' } })
  button(env.render(props), 'Guardar y publicar').props.onClick()
  await env.wait()
  assert.equal(saved[0].poster_url, '/portada.jpg')
  assert.equal(saved[0].loop_url, '/preview.mp4')
  find(env.render(props), (node) => node.type === 'input' && node.props.id === 'youtube_id').props.onChange({ target: { value: 'https://youtu.be/lmnopqrstuv' } })
  env.render(props).props.onSubmit({ preventDefault() {} })
  await env.wait()
  assert.equal(saved[1].poster_url, '')
  assert.equal(saved[1].loop_url, '')
})
