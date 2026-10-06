const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

// Carga el código real con dobles de los servicios externos. Nunca usa .env,
// Supabase o R2; tampoco requiere que Next.js esté arrancado.
function createLoader(mocks = {}) {
  const cache = new Map()
  const root = path.resolve(__dirname, '../..')

  return function load(filename) {
    const full = path.resolve(root, filename)
    if (cache.has(full)) return cache.get(full).exports
    const module = { exports: {} }
    cache.set(full, module)
    const { outputText } = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    })
    const localRequire = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name]
      if (name.startsWith('@/') || name.startsWith('.')) {
        const source = name.startsWith('@/')
          ? path.join(root, name.slice(2))
          : path.resolve(path.dirname(full), name)
        const resolved = [source, `${source}.ts`, `${source}.tsx`].find(fs.existsSync)
        if (!resolved) throw new Error(`No existe el módulo ${name}`)
        return load(resolved)
      }
      return require(name)
    }
    vm.runInNewContext(outputText, {
      module,
      exports: module.exports,
      require: localRequire,
      URL,
      URLSearchParams,
      Request,
      Response,
      console,
    }, { filename: full })
    return module.exports
  }
}

module.exports = { createLoader }
