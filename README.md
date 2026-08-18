# ByFrame

Sitio de portafolio y panel de administración de ByFrame, productora audiovisual
colombiana.

- **Sitio público**: Next.js 15 (App Router) + Tailwind CSS. Fondo negro, el video manda.
- **Datos y sesión**: Supabase (Postgres + Auth + Row Level Security).
- **Medios**: Cloudflare R2 tras el dominio `media.byframe.co`. Reproducción HLS.
- **Transcodificación**: local, con ffmpeg, mediante `scripts/transcode.mjs`. Cero
  servicios de pago para video.

El aprovisionamiento completo de Cloudflare y Supabase está en [SETUP.md](./SETUP.md).

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Guía de aprovisionamiento (`SETUP.md`) | Lista |
| 1 | Base de datos, RLS, clientes de Supabase, middleware y login | Lista |
| 2 | Sitio público | Lista |
| 3 | `scripts/transcode.mjs` | Lista |
| 4 | Panel de administración | Lista |

## Requisitos

- Node.js 20 o superior
- Una cuenta de Supabase y una de Cloudflare, aprovisionadas según `SETUP.md`
- ffmpeg y rclone (solo para la Fase 3)

## Puesta en marcha

```bash
npm install
```

Copia las variables de entorno y rellénalas siguiendo `SETUP.md`, Parte C:

```bash
cp .env.example .env.local
```

En Windows con PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Levanta el servidor:

```bash
npm run dev
```

- `http://localhost:3000` — comprobación de la capa de datos (la Fase 2 la reemplaza).
- `http://localhost:3000/admin` — panel. Sin sesión redirige a `/admin/login`.

## Migraciones

Los archivos SQL viven en `supabase/migrations/` y se ejecutan **en orden numérico**
desde el SQL Editor de Supabase. El procedimiento detallado está en `SETUP.md`, paso B3.

```text
0001_schema.sql     tablas, restricciones y comentarios
0002_indexes.sql    índices
0003_triggers.sql   updated_at automático
0004_rls.sql        Row Level Security y políticas
0005_seed.sql       datos de ejemplo (reejecutable)
```

Después de `0005`, ejecuta `supabase/tests/rls_checks.sql` bloque por bloque para
comprobar que la llave anónima no puede ver borradores ni escribir nada. No es una
migración: no modifica datos.

## Transcodificación

Todo el video se prepara en tu equipo con ffmpeg y se sube a R2 con rclone. El panel
nunca transcodifica: solo guarda las rutas que imprime este script.

Requisitos: `ffmpeg` (incluye `ffprobe`) y `rclone` con el remoto `r2` configurado
(`SETUP.md`, pasos A6 y F).

### Ejemplo horizontal

Un comercial 16:9, con el fotograma de portada tomado en el segundo 24:

```bash
npm run transcode -- --input ./masters/culto-iii.mov --slug culto-iii --format horizontal --poster 00:00:24
```

Genera y sube:

```text
/projects/culto-iii/
  hls/master.m3u8        escalera de 3 niveles: 1080p 8000k · 720p 4000k · 480p 1800k
  hls/v0|v1|v2/          segmentos .ts de 6 s
  poster.webp            fotograma del 00:00:24
  loop.mp4               6 s, mudo, 720p, +faststart
```

Y termina imprimiendo el JSON listo para pegar en el panel:

```json
{
  "hls_url": "https://media.byframe.co/projects/culto-iii/hls/master.m3u8",
  "poster_url": "https://media.byframe.co/projects/culto-iii/poster.webp",
  "loop_url": "https://media.byframe.co/projects/culto-iii/loop.mp4",
  "duration": 142
}
```

### Ejemplo vertical

Una pieza 9:16 para redes. Con `--format vertical` la escalera se invierte: 1080 pasa a
ser el **ancho**, no el alto, y salen 1080×1920, 720×1280 y 480×854.

```bash
npm run transcode -- --input ./masters/pulso.mov --slug pulso --format vertical --poster 00:00:03
```

### Trabajar sin Cloudflare (modo local)

Mientras no exista el bucket ni el dominio, el material se puede servir desde el propio
Next.js. Añade `--local` y el script escribe en `public/media` en vez de subir:

```bash
npm run transcode -- --input ./master.mov --slug demo-culto-iii --format horizontal --poster 00:00:05 --local
```

Requiere una línea en `.env.local`:

```text
NEXT_PUBLIC_MEDIA_BASE_URL=/media
```

El slug debe coincidir con el del proyecto en la base de datos: `lib/media.ts` traduce la
ruta canónica guardada (`https://media.byframe.co/projects/…`) al origen configurado, así
que **no hay que tocar ni una fila** al cambiar de local a R2 o a producción. Se cambia
esa variable y ya.

`public/media/` está en `.gitignore`: el material no se sube al repositorio. Esto es solo
para desarrollo — en producción el video nunca se sirve desde el sitio.


### Banderas

| Bandera | Por defecto | Para qué |
|---|---|---|
| `--input` | — | Archivo maestro. Obligatorio |
| `--slug` | — | Debe coincidir con el slug del proyecto: es la carpeta en el bucket |
| `--format` | `horizontal` | `horizontal` o `vertical` |
| `--poster` | `00:00:02` | Timecode `HH:MM:SS` del fotograma de portada y del inicio del loop |
| `--bucket` | `byframe-media` | Bucket de destino |
| `--remoto` | `r2` | Nombre del remoto de rclone |
| `--base` | `NEXT_PUBLIC_MEDIA_BASE_URL` | Dominio público de los medios |
| `--dry-run` | — | Imprime los comandos sin ejecutar nada |
| `--no-subir` | — | Transcodifica en local y no sube |
| `--local` | — | Escribe en `public/media` y sirve el video desde el propio Next.js |

### Detalles que no son arbitrarios

- **8000 kb/s en la capa superior**, muy por encima de lo habitual para 1080p, porque el
  material es oscuro y con grano: las dos cosas que más castigan al códec. Con 5000 las
  sombras se rompen en bloques.
- **La subida va en dos pasadas.** rclone no reconoce la extensión `.m3u8` y le asigna
  `application/octet-stream`, con lo que el reproductor no arranca. Los manifiestos se
  suben aparte con su `Content-Type` correcto y caché corta; los segmentos, que son
  inmutables, con caché de un año.
- **El script verifica el resultado** con una petición HEAD al manifiesto publicado y
  avisa si el estado o el `Content-Type` no son los esperados.


## Panel de administración

En `/admin`, protegido por el middleware y por una segunda comprobación en cada
página. Interfaz sobria: aquí se trabaja, no se exhibe.

| Pantalla | Qué hace |
|---|---|
| Resumen | Lista con miniatura, buscador por título/cliente/slug, filtro por formato, publicar y despublicar, papelera |
| Proyecto | Alta y edición, slug autogenerado y editable, créditos reordenables, **Pegar JSON del script**, vista previa con el reproductor real |
| Orden | Dos listas con arrastrar y soltar (dnd-kit), guardado optimista, accesible por teclado |
| Portada | Selector del hero entre los proyectos, o pieza propia con póster de respaldo |
| Equipo | Alta, edición y orden de perfiles |
| Ajustes | Contacto, redes, texto de Nosotros y metadatos por defecto |

### Cómo se guardan las cosas

- **Validación con Zod**, con el mismo esquema en cliente y servidor
  (`lib/admin/esquemas.ts`). Si divergieran, el formulario dejaría pasar algo que
  el servidor rechaza y el usuario no podría corregirlo.
- **Cada guardado revalida** las etiquetas de caché afectadas, así que el cambio
  se ve en el sitio sin volver a desplegar.
- **Eliminación lógica**: `deleted_at`, con confirmación previa y papelera para
  restaurar. Nunca se borra una fila de `projects`.
- Las escrituras usan la **sesión del socio**, no `service_role`: RLS sigue
  actuando como última red de seguridad.

### Subidas

Las subidas de póster, loop y fotos van directas del navegador a R2 mediante una
**URL prefirmada** que emite `/api/admin/upload-url`. Ese endpoint valida la
sesión **antes** de firmar, comprueba tipo MIME y tamaño en el servidor, y
construye la ruta del objeto él mismo a partir del slug — si la enviara el
cliente, un `../` bien puesto sobrescribiría el manifiesto de otro proyecto.

La URL se pide en el momento del envío, no al abrir el formulario: las firmas
caducan en diez minutos.

**La carpeta HLS no se sube nunca desde el panel.** Va siempre por
`scripts/transcode.mjs`, porque el manifiesto y sus segmentos tienen que subir
juntos y con los `Content-Type` correctos.


## Estructura

```text
app/
  layout.tsx                      tipografías y metadatos; sin colores
  (public)/                       sitio público, negro absoluto
    layout.tsx                    navegación + pie
    page.tsx                      hero + trabajo
    nosotros/page.tsx
    contacto/page.tsx
    proyecto/[slug]/page.tsx      ficha con URL propia (enlaces y SEO)
  admin/
    layout.tsx                    paleta clara, independiente del sitio
    page.tsx                      panel provisional
    login/
      page.tsx                    pantalla de acceso
      formulario-login.tsx        formulario (componente de cliente)
      actions.ts                  Server Actions de sesión
components/
  VideoPlayer.tsx                 reproductor HLS con controles propios
  site/
    Navegacion.tsx                fija; menú a pantalla completa en móvil
    Hero.tsx                      portada 100dvh, muda, en bucle
    Trabajo.tsx                   pestañas Comerciales / Social
    TarjetaProyecto.tsx           poster + loop en la rejilla 16:9
    Social.tsx                    carrusel en escritorio, feed en móvil
    FichaProyecto.tsx             cuerpo compartido por modal y página
    ModalProyecto.tsx             ficha a pantalla completa
    PieDePagina.tsx
    usar-loop.ts                  gestor central: máximo tres loops a la vez
lib/
  env.ts                          lectura de variables de entorno
  cache-tags.ts                   etiquetas de revalidación
  queries.ts                      consultas de lectura del sitio público
  supabase/
    client.ts                     cliente de navegador
    public.ts                     cliente anónimo sin cookies (ISR)
    server.ts                     cliente de servidor y cliente administrativo
    middleware.ts                 refresco de sesión y guardia de /admin
types/
  database.ts                     tipos del esquema
scripts/
  transcode.mjs                   ffmpeg + rclone: escalera HLS, poster y loop
supabase/
  migrations/                     SQL numerado
  tests/rls_checks.sql            pruebas de RLS
middleware.ts                     punto de entrada del middleware
```

## Comandos

```bash
npm run dev         # servidor de desarrollo
npm run build       # compilación de producción
npm run typecheck   # tsc --noEmit
npm run transcode   # prepara y sube una pieza (ver arriba)
```

## Notas de seguridad

- `SUPABASE_SERVICE_ROLE_KEY` y las credenciales de R2 son de servidor. Ninguna lleva ni
  puede llevar el prefijo `NEXT_PUBLIC_`: ese prefijo incrusta el valor en el JavaScript
  que se envía al navegador.
- La sesión se valida siempre con `getUser()`, nunca con `getSession()`. La segunda lee
  la cookie sin verificarla contra el servidor de autenticación.
- El registro público de usuarios está desactivado. Las cuentas se crean a mano desde el
  panel de Supabase.
