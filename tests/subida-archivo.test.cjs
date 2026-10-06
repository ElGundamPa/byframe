const assert = require('node:assert/strict')
const test = require('node:test')
const { createLoader } = require('./helpers/load-ts.cjs')

function uploader(options = {}) {
  const calls = []
  let request
  class Xhr {
    constructor() { this.upload = {} }
    open(method, url) { calls.push({ method, url }); request = this }
    setRequestHeader(name, value) { calls.push({ name, value }) }
    send(file) { this.file = file; if (options.finish) { this.status = 200; this.onload() } }
    abort() { this.onabort() }
  }
  const load = createLoader({}, {
    XMLHttpRequest: Xhr,
    fetch: options.fetch || (async (_, input) => {
      calls.push(JSON.parse(input.body))
      return { ok: true, json: async () => ({ url: 'https://upload.example/unique', rutaPublica: 'https://media.example/video.mp4', contentType: 'video/mp4' }) }
    }),
  })
  return { ...load('lib/admin/subir-archivo.ts'), calls, request: () => request }
}
const file = () => new File(['video'], 'video.mp4', { type: 'video/mp4' })

test('subida usa el MIME firmado y solo devuelve ruta tras completar el PUT', async () => {
  const env = uploader({ finish: true })
  const route = await env.subirArchivo(file(), 'video', 'video', new AbortController().signal, () => {})
  assert.equal(route, 'https://media.example/video.mp4')
  assert.equal(env.calls[0].tipo, 'video')
  assert.equal(env.calls[2].value, 'video/mp4')
})
test('cancelar durante la firma nunca inicia el PUT', async () => {
  let finish
  const env = uploader({ fetch: () => new Promise((resolve) => { finish = resolve }) })
  const controller = new AbortController()
  const operation = env.subirArchivo(file(), 'video', 'video', controller.signal, () => {})
  controller.abort()
  finish({ ok: true, json: async () => ({ url: 'https://upload.example', contentType: 'video/mp4' }) })
  await assert.rejects(operation, { name: 'AbortError' })
  assert.equal(env.calls.length, 0)
})
test('cancelar durante el PUT no devuelve una ruta de archivo incompleto', async () => {
  const env = uploader()
  const controller = new AbortController()
  const operation = env.subirArchivo(file(), 'video', 'video', controller.signal, () => {})
  await new Promise((resolve) => setImmediate(resolve))
  assert.ok(env.request())
  controller.abort()
  await assert.rejects(operation, { name: 'AbortError' })
})
test('error de red y archivo inválido permiten intentar de nuevo sin anunciar éxito', async () => {
  const env = uploader()
  await assert.rejects(env.subirArchivo(new File(['x'], 'x.jpg', { type: 'image/jpeg' }), 'video', 'video', new AbortController().signal, () => {}), /MP4/)
  assert.equal(env.calls.length, 0)
  const operation = env.subirArchivo(file(), 'video', 'video', new AbortController().signal, () => {})
  await new Promise((resolve) => setImmediate(resolve))
  env.request().onerror()
  await assert.rejects(operation, /conectar/)
})
