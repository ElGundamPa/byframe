# ByFrame — Guía de aprovisionamiento

Esta guía es para ejecutarse **antes** de escribir código. Al terminarla tendrás:

- Un bucket de Cloudflare R2 sirviendo video por un dominio propio.
- Un proyecto de Supabase con base de datos, autenticación y dos usuarios administradores.
- Un archivo `.env.local` completo y verificado.

No necesitas experiencia previa con ninguna de las dos plataformas. Cada paso indica
exactamente dónde hacer clic, qué escribir y cómo comprobar que quedó bien.

**Supuestos de esta guía** (corrígeme antes de la Fase 1 si alguno no aplica):

- Dominio del sitio público: `byframe.co` y `www.byframe.co`.
- Dominio de medios: `media.byframe.co`.
- Desarrollo local en `http://localhost:3000`.
- El dominio `byframe.co` está —o va a estar— administrado por Cloudflare (nameservers
  apuntando a Cloudflare). Esto es obligatorio para el paso A3.

---

## PARTE A · CLOUDFLARE R2

### A1. Crear la cuenta y ubicar el Account ID

1. Entra a `https://dash.cloudflare.com/sign-up` y crea la cuenta con un correo de
   trabajo de ByFrame, no con uno personal: este acceso lo van a compartir dos socios.
2. Confirma el correo desde el enlace que llega a la bandeja.
3. Activa la verificación en dos pasos en **My Profile → Authentication → Two-Factor
   Authentication**. No es opcional: esta cuenta tendrá llaves de escritura sobre todos
   los medios del sitio.
4. En el menú lateral entra a **R2 Object Storage**. La primera vez pedirá un método de
   pago aunque el plan gratuito cubra 10 GB de almacenamiento, 1 000 000 de operaciones
   clase A y 10 000 000 clase B al mes. **R2 no cobra por egreso**, que es justamente la
   razón por la que se eligió: un portafolio de video servido desde S3 costaría en ancho
   de banda lo que aquí cuesta cero.
5. El **Account ID** aparece en el panel derecho de la página de R2, bajo *Account
   details*. También está en la URL:
   `https://dash.cloudflare.com/<ACCOUNT_ID>/r2/overview`.

Anótalo en un archivo de notas temporal:

```text
CLOUDFLARE_ACCOUNT_ID = 32 caracteres hexadecimales
ejemplo: 8f2c1a9b4d7e6f3a0b5c8d1e2f4a6b90
```

### A2. Crear el bucket `byframe-media`

1. En **R2 Object Storage → Overview**, botón **Create bucket**.
2. Nombre exacto: `byframe-media`. En minúsculas y con guion; el nombre viaja en las URLs
   internas y no se puede renombrar después.
3. **Location**: deja `Automatic`. Cloudflare ubica los datos cerca de donde se escriben;
   como vas a subir desde Colombia, quedará en un centro de datos de la región.
4. **Default storage class**: `Standard`. La clase *Infrequent Access* cobra por
   recuperación y tus videos se leen todo el tiempo.
5. **Create bucket**.

**Por qué NO se usa el subdominio `r2.dev` en producción**

Cloudflare permite exponer un bucket en una URL tipo `https://pub-<hash>.r2.dev/...`.
Sirve para probar en cinco minutos y para nada más:

- Está **limitado por tasa deliberadamente** por Cloudflare y no tiene ningún acuerdo de
  servicio. Con varios visitantes viendo video al tiempo empiezan los cortes.
- **No pasa por la caché de la CDN**, así que cada segmento `.ts` se sirve desde el
  origen. En HLS eso son cientos de peticiones por reproducción.
- **No admite Cache Rules ni Transform Rules**, que es como se corrige el `Content-Type`
  de los manifiestos y se fija el `Cache-Control` largo de los segmentos.
- Es una URL ajena que quedaría incrustada en cada fila de `projects`. El día que cambies
  de proveedor tendrías que reescribir la base de datos entera.

Con dominio propio obtienes caché de CDN, reglas, y URLs estables que sobreviven a
cualquier migración futura.

### A3. Conectar el dominio `media.byframe.co`

**Requisito previo**: `byframe.co` debe existir como zona en la misma cuenta de
Cloudflare. Si aún no está:

1. **Websites → Add a site**, escribe `byframe.co`, elige el plan **Free**.
2. Cloudflare escanea los registros DNS actuales y te muestra dos nameservers, del estilo
   `dana.ns.cloudflare.com` y `rob.ns.cloudflare.com`.
3. Entra al panel de tu registrador (GoDaddy, Namecheap, Hostinger, etc.), busca
   *Nameservers* / *Servidores de nombres*, elige *Custom* y reemplaza los existentes por
   los dos de Cloudflare.
4. La propagación tarda entre 5 minutos y 24 horas. En Cloudflare la zona pasa de
   *Pending Nameserver Update* a **Active**. No sigas hasta ver **Active**.

Con la zona activa:

1. **R2 → byframe-media → Settings → Public access → Custom Domains → Connect Domain**.
2. Escribe `media.byframe.co` y confirma.
3. Cloudflare **crea solo** el registro DNS necesario: un `CNAME` en `media` apuntando al
   endpoint público del bucket, con el proxy naranja activado. No lo crees a mano y no
   desactives la nube naranja: sin proxy no hay caché ni certificado.
4. El estado pasa por *Initializing* → *Pending* → **Active**. El certificado TLS se
   emite automáticamente, entre 1 y 15 minutos.

Verifica en **Websites → byframe.co → DNS → Records** que exista:

```text
Tipo    Nombre    Contenido                          Proxy
CNAME   media     (destino que escribió Cloudflare)  Proxied (naranja)
```

Prueba desde la terminal. Todavía no hay archivos, así que un 404 aquí es éxito:

```bash
curl -I https://media.byframe.co/prueba.txt
```

Respuesta esperada: `HTTP/2 404` con encabezados `server: cloudflare` y `cf-ray: ...`.
Si obtienes error de certificado o *SSL handshake failed*, el certificado aún no termina
de emitirse: espera y reintenta.

### A4. Política CORS

Sin CORS, `hls.js` no puede leer el manifiesto ni los segmentos desde el navegador y la
consola muestra `No 'Access-Control-Allow-Origin' header is present`. Safari con HLS
nativo a veces funciona igual, lo que vuelve el error más confuso todavía: se ve bien en
el iPhone y roto en Chrome de escritorio.

1. **R2 → byframe-media → Settings → CORS Policy → Add CORS policy** (o *Edit*).
2. Pega exactamente este JSON:

```json
[
  {
    "AllowedOrigins": [
      "https://byframe.co",
      "https://www.byframe.co",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Sobre cada campo:

- `PUT` es indispensable para las subidas del panel con URL prefirmada (Fase 4). Sin él,
  la subida falla con error de CORS justo al soltar el archivo.
- `ExposeHeaders` con `Content-Range` y `Content-Length` permite peticiones por rango de
  `hls.js` y que el reproductor conozca la duración real.
- No uses `"AllowedOrigins": ["*"]`. Con comodín, cualquier sitio puede incrustar tus
  videos y gastarte las operaciones de lectura.
- Cuando exista el dominio de vista previa del despliegue (por ejemplo
  `https://byframe.pages.dev`), agrégalo a la lista o las vistas previas se verán rotas.

3. **Save**. Los cambios de CORS aplican en menos de un minuto.

### A5. Token de API con permisos limitados al bucket

1. **R2 Object Storage → API → Manage API tokens → Create API token**. En algunas
   versiones del panel el acceso está en **R2 → Overview → botón «{} API»**.
2. **Token name**: `byframe-media-rw`.
3. **Permissions**: **Object Read & Write**. No elijas *Admin Read & Write*: ese permiso
   puede crear y borrar buckets enteros.
4. **Specify bucket(s)**: **Apply to specific buckets only** y marca únicamente
   `byframe-media`.
5. **TTL**: `Forever` sirve para uso interno; si prefieres rotarlo, pon 1 año y agenda el
   recordatorio.
6. **Client IP Address Filtering**: déjalo vacío. Vas a subir desde una IP doméstica
   variable y desde el panel desplegado.
7. **Create API Token**.

La pantalla siguiente muestra los valores **una sola vez**. Copia estos tres:

```text
1. Access Key ID              ~32 caracteres hexadecimales
2. Secret Access Key          ~64 caracteres hexadecimales
3. Endpoint para clientes S3  https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Si cierras la pestaña sin copiarlos no hay forma de recuperarlos: borra el token y crea
otro. Guárdalos en el gestor de contraseñas compartido de los dos socios. Nunca en
WhatsApp ni en un archivo del repositorio.

### A6. Instalar y configurar rclone

`rclone` es la herramienta que usa el script de transcodificación (Fase 3) para subir las
carpetas HLS. Se eligió sobre `aws-cli` porque sincroniza directorios completos con
control fino de `Content-Type` y `Cache-Control` por patrón de archivo.

**Instalación**

Windows (PowerShell):

```powershell
winget install Rclone.Rclone
```

macOS:

```bash
brew install rclone
```

Linux:

```bash
curl https://rclone.org/install.sh | sudo bash
```

Cierra y vuelve a abrir la terminal, y confirma:

```bash
rclone version
```

Debe imprimir `rclone v1.6x.x` o superior. Las versiones anteriores a la 1.59 no traen el
proveedor `Cloudflare` y habría que configurarlo a mano.

**Configuración — diálogo exacto**

Ejecuta:

```bash
rclone config
```

Responde en este orden. A la izquierda lo que pregunta rclone, a la derecha lo que
escribes seguido de Enter:

```text
e/n/d/r/c/s/q>                        n
name>                                 r2
Storage>                              s3
     (del listado largo; también sirve el número junto a "Amazon S3 Compliant
      Storage Providers including AWS, Alibaba, Cloudflare, ...")
provider>                             Cloudflare
     (o el número junto a "Cloudflare R2 Storage")
env_auth>                             1
     ("Enter AWS credentials in the next step")
access_key_id>                        <Access Key ID del paso A5>
secret_access_key>                    <Secret Access Key del paso A5>
region>                               auto
     (si no aparece en el listado, escríbelo literalmente)
endpoint>                             https://<ACCOUNT_ID>.r2.cloudflarestorage.com
Edit advanced config? y/n>            n
Keep this "r2" remote? y/e/d>         y
e/n/d/r/c/s/q>                        q
```

El nombre del remoto **debe ser `r2`**: el script de la Fase 3 lo usa literalmente como
`r2:byframe-media/...`.

El archivo de configuración queda en:

- Windows: `C:\Users\<usuario>\AppData\Roaming\rclone\rclone.conf`
- macOS y Linux: `~/.config/rclone/rclone.conf`

Contiene el secreto ofuscado, no cifrado. **No lo copies al repositorio.**

### A7. Verificación de la Parte A

```bash
rclone lsd r2:
```

Éxito: imprime una línea con `byframe-media`. Un listado vacío o un error `AccessDenied`
significa que el token no tiene alcance sobre ese bucket; repite el paso A5.

Prueba de escritura y de lectura pública de punta a punta:

```bash
echo ok > prueba.txt
rclone copy prueba.txt r2:byframe-media/ --s3-no-check-bucket
curl https://media.byframe.co/prueba.txt
```

Debe imprimir `ok`. Limpia después:

```bash
rclone delete r2:byframe-media/prueba.txt
```

> `--s3-no-check-bucket` evita que rclone intente un `HeadBucket`, operación que un token
> restringido a un solo bucket no siempre tiene permitida. Si lo omites puedes ver un 403
> aunque la subida sea perfectamente válida.

#### ✅ Casilla de verificación · Parte A

- [ ] `rclone lsd r2:` lista `byframe-media`.
- [ ] `curl -I https://media.byframe.co/prueba.txt` responde `200` con `server: cloudflare`.
- [ ] La política CORS está guardada con los tres orígenes y el método `PUT`.
- [ ] Los tres valores del token están en el gestor de contraseñas.
- [ ] El Account ID está anotado.

---

## PARTE B · SUPABASE

### B1. Crear la cuenta y el proyecto

1. Entra a `https://supabase.com/dashboard/sign-up`. Puedes registrarte con GitHub, que
   además simplifica el despliegue después.
2. **New project**. Si es tu primera vez, primero te pedirá crear una *Organization*:
   nombre `ByFrame`, tipo *Personal*, plan **Free**.
3. Datos del proyecto:
   - **Name**: `byframe`
   - **Database Password**: usa el botón **Generate a password** y guárdala de inmediato
     en el gestor de contraseñas. Es la contraseña del usuario `postgres`; se muestra una
     sola vez y la necesitarás para conexiones directas y respaldos. La aplicación **no**
     la usa.
   - **Region**: **East US (North Virginia)**. Es la región disponible con menor latencia
     desde Colombia —el tráfico de Bogotá sale por Miami hacia Ashburn—, típicamente
     entre 60 y 90 ms. *South America (São Paulo)* suena más cercana geográficamente pero
     el enrutamiento la deja entre 130 y 180 ms.
   - **Pricing plan**: Free.
4. **Create new project** y espera 2 o 3 minutos mientras se aprovisiona la base.

> El plan Free pausa los proyectos tras una semana sin actividad. Un sitio en producción
> recibe visitas y no se pausa, pero durante el desarrollo puede ocurrir: se reactiva con
> un clic desde el panel, sin pérdida de datos.

### B2. Dónde están las llaves

**Project URL y llave anónima**: **Project Settings → API** (algunos paneles lo muestran
como **Project Settings → API Keys**).

```text
Project URL   https://abcdefghijklmnop.supabase.co
anon public   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....   (JWT largo)
service_role  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....   (JWT largo, oculto tras
                                                          el botón "Reveal")
```

En proyectos creados recientemente estas dos llaves pueden aparecer con la nomenclatura
nueva: **Publishable key** (`sb_publishable_...`) equivale a la anónima y **Secret key**
(`sb_secret_...`) equivale a service_role. Usa las que muestre tu panel; el rol que
cumplen es el mismo.

**La diferencia, en una frase**: la llave anónima actúa con el rol `anon` y queda sujeta a
las políticas de Row Level Security, mientras que `service_role` **ignora RLS por
completo** y puede leer, modificar y borrar cualquier fila de cualquier tabla.

Por eso la `service_role` jamás puede salir del servidor: si la incluyes en un componente
de cliente, en una variable con prefijo `NEXT_PUBLIC_`, o incluso en un archivo que el
bundler arrastre al navegador, queda en el JavaScript que cualquiera puede leer con
Ctrl+U, y con ella un tercero borra la base de datos completa. En este proyecto la
`service_role` solo se usa dentro de Route Handlers y Server Actions.

Si sospechas que se filtró: **Project Settings → API → JWT Settings → Generate new JWT
secret** rota todas las llaves de inmediato.

### B3. Ejecutar las migraciones desde el SQL Editor

Los archivos SQL los entrego en la Fase 1, en `supabase/migrations/`, numerados así:

```text
supabase/migrations/
  0001_schema.sql        tablas, tipos y restricciones
  0002_indexes.sql       índices
  0003_triggers.sql      trigger de updated_at
  0004_rls.sql           activación de RLS y políticas
  0005_seed.sql          datos de ejemplo
```

Para cada archivo, **en orden numérico estricto**:

1. En el panel de Supabase, menú lateral → **SQL Editor** → **New query**.
2. Abre el archivo `.sql` en tu editor, selecciona todo (`Ctrl+A`), copia (`Ctrl+C`) y
   pega en el editor de Supabase.
3. **Run** (o `Ctrl+Enter`).
4. Éxito: abajo aparece `Success. No rows returned`. Si aparece un error en rojo, **no
   sigas con el siguiente archivo**: los `.sql` posteriores dependen de los anteriores y
   los errores se encadenan. Cópiame el mensaje completo.
5. Repite con el siguiente número.

El orden importa porque `0002` indexa columnas que crea `0001`, `0004` define políticas
sobre tablas que crea `0001`, y `0005` inserta filas que dependen de todas las
restricciones anteriores.

**Cómo confirmar que corrieron todas**, en una consulta nueva:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Debe listar exactamente: `home_hero`, `project_credits`, `projects`, `site_settings`,
`team_members`.

### B4. Verificar tablas y políticas RLS

1. Menú lateral → **Table Editor**. Deben aparecer las cinco tablas. Entra a `projects` y
   confirma que existen las columnas `slug`, `format`, `hls_url`, `published` y
   `deleted_at`.
2. Menú lateral → **Authentication → Policies** (en algunos paneles, **Database →
   Policies**). Cada una de las cinco tablas debe mostrar el rótulo **RLS enabled** y al
   menos dos políticas: una de lectura pública y una de escritura autenticada.
3. Si alguna tabla muestra **RLS disabled** en rojo, la migración `0004` no corrió
   completa. Vuelve a ejecutarla.

Prueba negativa, la que de verdad importa. En **SQL Editor**:

```sql
-- Simula una petición hecha con la llave anónima
begin;
  set local role anon;
  select slug, published from public.projects;
rollback;
```

El bloque `begin` / `rollback` no es decorativo: `set local` fuera de una transacción
emite una advertencia y **no cambia el rol**, así que la prueba pasaría siempre y no
probaría nada.

El resultado debe incluir **únicamente** filas con `published = true`. Si aparece algún
borrador, las políticas están mal y hay que corregirlas antes de continuar. La Fase 1
incluye este juego de consultas de prueba de forma completa.

### B5. Desactivar el registro público

Sin esto, cualquiera que descubra la URL del proyecto puede crearse una cuenta y quedar
autenticado; y como las políticas de escritura dependen del rol `authenticated`, tendría
acceso de edición al portafolio.

1. **Authentication → Sign In / Providers** (o **Authentication → Providers**).
2. Abre el proveedor **Email**.
3. Desactiva **Allow new users to sign up** / *Enable sign ups*.
4. Deja activado **Confirm email** aunque no vayas a usar registro; no estorba.
5. Desactiva cualquier otro proveedor que esté encendido (Google, GitHub, Anonymous).
6. **Save**.

Verificación: en **Authentication → Providers**, el proveedor Email debe indicar que el
registro está deshabilitado. Con esto, la única forma de crear usuarios es manualmente
desde el panel, que es lo que haces en el paso siguiente.

### B6. Crear los dos usuarios administradores

1. **Authentication → Users → Add user → Create new user**.
2. Para el primer socio:
   - **Email**: el correo real del socio.
   - **Password**: genera una de al menos 16 caracteres en el gestor de contraseñas.
   - Marca **Auto Confirm User**. Sin esta casilla el usuario queda con el correo sin
     confirmar y no podrá iniciar sesión.
3. **Create user**.
4. Repite para el segundo socio.
5. En la lista deben aparecer dos usuarios con la columna *Last sign in* vacía y sin
   ninguna advertencia de correo pendiente.

Entrega cada contraseña por el gestor compartido, no por chat. El panel no distingue
jerarquías: los dos usuarios tienen exactamente los mismos permisos.

### B7. Datos de ejemplo y cómo borrarlos

La migración `0005_seed.sql` inserta 6 proyectos horizontales, 4 verticales, 2 miembros
de equipo, los ajustes del sitio y un hero, todos con URLs de marcador de posición que
apuntan a `https://media.byframe.co/projects/<slug>/...`. Esos archivos no existen
todavía, así que en el sitio verás las tarjetas maquetadas con posters rotos hasta que
subas material real en la Fase 3. Es el comportamiento esperado.

Para borrarlos cuando ya tengas proyectos reales, ejecuta en **SQL Editor**:

```sql
-- Borra únicamente las filas de ejemplo (todas llevan slug con prefijo 'demo-')
delete from public.home_hero;
delete from public.projects where slug like 'demo-%';
delete from public.team_members where name like 'Nombre Apellido%';
```

Las filas de `project_credits` desaparecen solas por el `on delete cascade`. **No borres
`site_settings`**: contiene el correo, WhatsApp y redes que consume la página de
contacto; edítalo en lugar de vaciarlo.

Si prefieres empezar de cero por completo, el archivo `0005_seed.sql` se puede volver a
ejecutar: es idempotente gracias a `on conflict (slug) do nothing`.

#### ✅ Casilla de verificación · Parte B

- [ ] Las cinco tablas aparecen en Table Editor.
- [ ] Las cinco tablas muestran **RLS enabled**.
- [ ] La consulta con `set local role anon` no devuelve borradores.
- [ ] El registro público está desactivado.
- [ ] Existen dos usuarios con el correo confirmado.
- [ ] Project URL, llave anónima y service_role están anotadas.

---

## PARTE C · VARIABLES DE ENTORNO

### Tabla de variables

| Variable | De dónde sale | Ámbito | Valor de ejemplo |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Parte B, paso B2 → *Project URL* | Pública (navegador) | `https://abcdefghijklmnop.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Parte B, paso B2 → *anon public* | Pública (navegador) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.xxxxx` |
| `SUPABASE_SERVICE_ROLE_KEY` | Parte B, paso B2 → *service_role* (botón Reveal) | **Solo servidor** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.xxxxx` |
| `R2_ACCOUNT_ID` | Parte A, paso A1 | **Solo servidor** | `8f2c1a9b4d7e6f3a0b5c8d1e2f4a6b90` |
| `R2_ACCESS_KEY_ID` | Parte A, paso A5, valor 1 | **Solo servidor** | `a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6` |
| `R2_SECRET_ACCESS_KEY` | Parte A, paso A5, valor 2 | **Solo servidor** | `9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0` |
| `R2_BUCKET_NAME` | Parte A, paso A2 | **Solo servidor** | `byframe-media` |
| `R2_ENDPOINT` | Parte A, paso A5, valor 3 | **Solo servidor** | `https://8f2c1a9b4d7e6f3a0b5c8d1e2f4a6b90.r2.cloudflarestorage.com` |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | Parte A, paso A3 | Pública (navegador) | `https://media.byframe.co` |
| `NEXT_PUBLIC_SITE_URL` | Tu dominio | Pública (navegador) | `https://byframe.co` |
| `REVALIDATE_SECRET` | Invéntala tú (ver abajo) | **Solo servidor** | `k7Jx2pQm9vRt4NwZ8bHy3LcE6sAf1DgU` |

Genera `REVALIDATE_SECRET` con:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

### Advertencia sobre el prefijo `NEXT_PUBLIC_`

En Next.js, **toda variable que empieza por `NEXT_PUBLIC_` se incrusta literalmente en el
JavaScript que se envía al navegador**. No es una convención de estilo: es una sustitución
en tiempo de compilación. Cualquiera puede leerlas abriendo las herramientas de
desarrollador.

**Estas cinco NUNCA pueden llevar el prefijo `NEXT_PUBLIC_`:**

```text
SUPABASE_SERVICE_ROLE_KEY     → con ella se borra la base de datos entera
R2_ACCESS_KEY_ID              → con ella se escribe y borra en el bucket
R2_SECRET_ACCESS_KEY          → idem
R2_ENDPOINT                   → expone el Account ID en la superficie de ataque
REVALIDATE_SECRET             → permitiría invalidar la caché a voluntad de terceros
```

Si en algún momento ves un error del tipo *"variable de entorno indefinida"* en un
componente de cliente y la tentación es agregarle `NEXT_PUBLIC_` para que funcione: ese
es exactamente el error. La solución correcta es mover la lógica al servidor.

`NEXT_PUBLIC_SUPABASE_ANON_KEY` sí es pública por diseño. Está pensada para vivir en el
navegador y su poder está acotado por las políticas RLS que configuraste en B4. Por eso la
prueba negativa del paso B4 no es opcional.

### `.env.example`

Este archivo va versionado en el repositorio, con valores vacíos. El que lleva valores
reales es `.env.local`, que **debe estar en `.gitignore`**.

```bash
# ─────────────────────────────────────────────────────────────
# ByFrame — variables de entorno
# Copia este archivo como .env.local y rellena los valores.
#   cp .env.example .env.local
# .env.local NUNCA se sube al repositorio.
# ─────────────────────────────────────────────────────────────

# ── SUPABASE ────────────────────────────────────────────────
# Panel de Supabase → Project Settings → API

# URL del proyecto. Pública: viaja al navegador.
NEXT_PUBLIC_SUPABASE_URL=

# Llave anónima (o "publishable"). Pública por diseño.
# Su alcance está limitado por las políticas RLS.
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Llave service_role (o "secret"). IGNORA RLS POR COMPLETO.
# Solo servidor. Jamás con prefijo NEXT_PUBLIC_.
SUPABASE_SERVICE_ROLE_KEY=

# ── CLOUDFLARE R2 ───────────────────────────────────────────
# Todas son de servidor. Se usan solo para firmar URLs de subida
# en /api/admin/upload-url, después de validar la sesión.

# Account ID: panel de Cloudflare → R2 → Account details.
R2_ACCOUNT_ID=

# Token de API con permiso "Object Read & Write" sobre byframe-media.
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=

# Nombre del bucket.
R2_BUCKET_NAME=byframe-media

# Endpoint S3: https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ENDPOINT=

# ── DOMINIOS ────────────────────────────────────────────────
# Base pública de los medios, sin barra final.
# Es el dominio personalizado del bucket, no el subdominio r2.dev.
NEXT_PUBLIC_MEDIA_BASE_URL=https://media.byframe.co

# URL canónica del sitio. Se usa en metadatos, sitemap y Open Graph.
NEXT_PUBLIC_SITE_URL=https://byframe.co

# ── REVALIDACIÓN ────────────────────────────────────────────
# Cadena aleatoria propia. Protege el endpoint que invalida la caché.
# Genérala con:
#   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
REVALIDATE_SECRET=
```

Confirma que `.gitignore` contiene:

```text
.env
.env.local
.env*.local
```

#### ✅ Casilla de verificación · Parte C

- [ ] `.env.local` existe y tiene las once variables con valor.
- [ ] Ninguna llave secreta lleva el prefijo `NEXT_PUBLIC_`.
- [ ] `.env.local` está ignorado por git (`git check-ignore .env.local` responde con la ruta).
- [ ] `.env.example` está versionado y sin valores reales.

---

## PARTE D · EJECUCIÓN LOCAL

Esta parte se ejecuta **después de la Fase 1**, cuando ya exista el código. La incluyo
aquí para que la guía quede completa de principio a fin.

### D1. Requisitos

```bash
node -v    # 20.x o superior
npm -v     # 10.x o superior
```

Next.js 15 requiere Node 18.18 como mínimo; usa 20 LTS o superior.

### D2. Instalar y levantar

```bash
npm install
cp .env.example .env.local     # y rellena los valores de la Parte C
npm run dev
```

En Windows con PowerShell, en lugar de `cp` usa:

```powershell
Copy-Item .env.example .env.local
```

La terminal debe mostrar:

```text
▲ Next.js 15.x
- Local:   http://localhost:3000
✓ Ready in 1.8s
```

### D3. Primer inicio de sesión

1. Abre `http://localhost:3000/admin`.
2. Al no haber sesión, el middleware te redirige a `/admin/login`.
3. Escribe el correo y la contraseña de uno de los usuarios del paso B6.
4. Debes aterrizar en `/admin` con la lista de proyectos de ejemplo.

### D4. Qué debes ver si todo quedó bien

- `http://localhost:3000` carga el sitio público con los 10 proyectos de ejemplo. Los
  posters aparecen rotos: es lo esperado, todavía no hay archivos en R2.
- `http://localhost:3000/admin` sin sesión redirige a `/admin/login`.
- Con sesión iniciada, `/admin` lista los proyectos, incluidos los borradores.
- Abrir el sitio público en una ventana de incógnito **no** muestra los borradores. Si los
  muestra, RLS está mal configurado: vuelve al paso B4.
- La consola del navegador no tiene errores en rojo, salvo los 404 de los posters.

### D5. Errores frecuentes en este punto

| Síntoma | Causa | Arreglo |
|---|---|---|
| `Invalid API key` | La llave anónima quedó cortada al copiarla | Vuelve a copiarla completa; es un JWT de varios cientos de caracteres |
| `fetch failed` al arrancar | `NEXT_PUBLIC_SUPABASE_URL` con barra final | Quita la `/` del final |
| La sesión se pierde al recargar | Cambios en `.env.local` sin reiniciar el servidor | Detén con `Ctrl+C` y vuelve a `npm run dev`; Next.js no recarga variables en caliente |

#### ✅ Casilla de verificación · Parte D

- [ ] `npm run dev` arranca sin errores.
- [ ] `/admin` sin sesión redirige a `/admin/login`.
- [ ] El inicio de sesión funciona con los dos usuarios.
- [ ] El sitio público en incógnito no muestra borradores.

---

## PARTE E · DESPLIEGUE

### E0. Advertencia técnica que debes conocer antes de desplegar

La Fase 2 exige **ISR con revalidación bajo demanda por etiquetas** (`revalidateTag`).
Aquí hay una decisión real que tomar, y prefiero decírtela ahora y no cuando falle el
despliegue:

- **`@cloudflare/next-on-pages`** es el adaptador clásico de Cloudflare Pages. Obliga a
  que todas las rutas dinámicas corran en el runtime *edge* y **no soporta ISR ni
  `revalidateTag`**: las páginas quedan estáticas hasta el siguiente despliegue. Con ese
  adaptador, el punto de control de la Fase 4 —«publicas y aparece en el sitio sin
  redesplegar»— no se cumple.
- **`@opennextjs/cloudflare`** es el adaptador que Cloudflare recomienda hoy para Next.js
  15. Corre sobre Workers con `nodejs_compat`, soporta ISR con caché incremental en R2 o
  KV, `revalidateTag`, y permite usar librerías de Node como el SDK de S3 para firmar las
  URLs de subida.

**Mi recomendación es `@opennextjs/cloudflare`.** Sigue siendo Cloudflare y sigue
costando cero, pero cumple los requisitos que tú mismo definiste. Confírmame cuál usar
antes de la Fase 2: la elección cambia cómo se escriben las rutas del panel y la estrategia
de caché del sitio público. Los pasos E1–E5 asumen esa recomendación.

### E1. Subir el repositorio

```bash
git init
git add .
git commit -m "ByFrame: sitio y panel"
git branch -M main
git remote add origin git@github.com:<usuario>/byframe.git
git push -u origin main
```

Antes de este `push`, verifica una vez más que `.env.local` **no** está incluido:

```bash
git ls-files | grep env
```

Solo debe aparecer `.env.example`.

### E2. Crear el proyecto en Cloudflare

1. Panel de Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**.
2. Autoriza GitHub y elige el repositorio `byframe`.
3. Configuración de compilación:
   - **Framework preset**: `Next.js`
   - **Build command**: `npx opennextjs-cloudflare build`
   - **Build output directory**: `.open-next/assets`
   - **Root directory**: vacío
4. **Environment variables (Production)**: agrega **las once** de la Parte C, con los
   mismos nombres exactos. Marca como **Encrypt** las cinco secretas.
5. Repite las variables para el entorno **Preview**, cambiando `NEXT_PUBLIC_SITE_URL` por
   la URL `.pages.dev`.
6. Agrega también la variable de compatibilidad de Node:
   - **Settings → Functions → Compatibility flags**: `nodejs_compat`
   - **Compatibility date**: la fecha de hoy o posterior.
7. **Save and Deploy**.

### E3. Apuntar el dominio

1. En el proyecto de Pages: **Custom domains → Set up a custom domain**.
2. Agrega `byframe.co` y luego `www.byframe.co`.
3. Como la zona ya vive en Cloudflare, los registros DNS se crean solos.
4. En **Websites → byframe.co → Rules → Redirect Rules**, crea una regla que redirija
   `www.byframe.co/*` a `https://byframe.co/$1` con código 301, para tener una sola URL
   canónica.

### E4. Ajustes de caché para el bucket de medios

En **Websites → byframe.co → Caching → Cache Rules → Create rule**:

- **Nombre**: `Manifiestos HLS sin caché larga`
- **Si**: `Hostname equals media.byframe.co` **AND** `URI Path ends with .m3u8`
- **Entonces**: *Edge TTL* → `Ignore cache-control header and use this TTL` → **2
  minutos**.

Segunda regla:

- **Nombre**: `Segmentos y posters con caché larga`
- **Si**: `Hostname equals media.byframe.co` **AND** `URI Path ends with .ts` (agrega
  `.webp`, `.jpg`, `.mp4` con el operador *is in*)
- **Entonces**: *Edge TTL* → **1 mes**, *Browser TTL* → **1 mes**.

Esto funciona porque los segmentos son inmutables —nunca cambian una vez subidos— y los
manifiestos podrían reemplazarse al reprocesar un video.

### E5. Qué revisar tras el primer despliegue

1. Abre `https://byframe.co` y confirma que carga el hero.
2. En las herramientas de desarrollador, pestaña **Network**, filtra por `m3u8`: el
   manifiesto debe responder `200` con `content-type: application/vnd.apple.mpegurl`.
3. Filtra por `.ts`: los segmentos deben mostrar `cf-cache-status: HIT` a partir de la
   segunda reproducción.
4. Ve a **View Source** (`Ctrl+U`) y busca `service_role`, `R2_SECRET` y `sb_secret`. **No
   debe aparecer ninguno.** Si aparece alguno, detente, rota la llave en Supabase o en
   Cloudflare, y corrige la variable antes de seguir.
5. Inicia sesión en `https://byframe.co/admin` y publica un cambio menor. Recarga el sitio
   público: el cambio debe verse sin redesplegar.
6. Ejecuta Lighthouse en modo móvil sobre la portada. Objetivo: rendimiento por encima de
   90 y LCP bajo 2.5 s.

#### ✅ Casilla de verificación · Parte E

- [ ] El despliegue termina sin errores de compilación.
- [ ] `https://byframe.co` carga con dominio y certificado propios.
- [ ] El código fuente del navegador no contiene ninguna llave secreta.
- [ ] Los `.m3u8` responden con el `Content-Type` correcto.
- [ ] Publicar desde el panel se refleja en el sitio sin redesplegar.

---

## PARTE F · SOLUCIÓN DE PROBLEMAS

### F1. El video no carga y la consola muestra un error de CORS

**Síntoma**: `Access to XMLHttpRequest at 'https://media.byframe.co/...' has been blocked
by CORS policy`. En Safari o en iPhone funciona; en Chrome de escritorio no.

**Causa**: la política CORS del bucket no incluye el origen desde el que estás mirando.
Safari usa HLS nativo dentro del elemento `<video>`, que no está sujeto a CORS; `hls.js`
descarga por `fetch` y sí lo está. De ahí la asimetría.

**Arreglo**: R2 → byframe-media → Settings → CORS Policy. Verifica que el origen exacto
esté en `AllowedOrigins`, **con protocolo y sin barra final**. `https://byframe.co` y
`https://www.byframe.co` son orígenes distintos y ambos deben estar. Agrega también el
dominio `.pages.dev` de las vistas previas. Los cambios aplican en menos de un minuto;
recarga con `Ctrl+Shift+R`.

### F2. El manifiesto `.m3u8` se sirve con `Content-Type` incorrecto

**Síntoma**: el reproductor no arranca; en Network el `.m3u8` responde `200` pero con
`content-type: application/octet-stream` o `binary/octet-stream`. En algunos navegadores
el archivo se descarga en lugar de reproducirse.

**Causa**: rclone infiere el tipo MIME por extensión y no conoce `.m3u8`, así que asigna
el genérico. Por eso el script de la Fase 3 sube en dos pasadas.

**Arreglo inmediato sobre lo ya subido**:

```bash
rclone copy ./hls r2:byframe-media/projects/<slug>/ \
  --include "*.m3u8" \
  --header-upload "Content-Type: application/vnd.apple.mpegurl" \
  --header-upload "Cache-Control: public, max-age=120" \
  --s3-no-check-bucket
```

Si el archivo ya estaba cacheado en la CDN, purga: **Websites → byframe.co → Caching →
Configuration → Purge Everything**.

### F3. La sesión no persiste: iniciás sesión y al recargar vuelve al login

**Causa habitual**: el cliente de Supabase para el servidor no está escribiendo las
cookies de vuelta, o el middleware no está refrescando el token. Con `@supabase/ssr` la
sesión vive en cookies, no en `localStorage`, y **el middleware debe devolver la misma
respuesta a la que el cliente escribió las cookies**. Si creas una `NextResponse` nueva
después de leer la sesión, pierdes las cookies actualizadas.

**Otras causas frecuentes**:

- Cambiaste `.env.local` sin reiniciar `npm run dev`.
- Estás mezclando `localhost` y `127.0.0.1`: son dominios distintos para las cookies. Usa
  siempre `localhost:3000`.
- El navegador bloquea cookies de terceros y estás dentro de un iframe de vista previa.

**Comprobación**: en DevTools → Application → Cookies debe existir una cookie
`sb-<ref>-auth-token`. Si no está, el problema es de escritura; si está pero el servidor
no la ve, el problema es de lectura en el middleware.

### F4. RLS bloquea las lecturas públicas: el sitio sale vacío en incógnito

**Síntoma**: con sesión ves todo; en incógnito el portafolio aparece sin proyectos, sin
ningún error visible. Las consultas devuelven un arreglo vacío, no un error, porque RLS no
falla: simplemente filtra todas las filas.

**Causa**: falta la política de `select` para el rol `anon`, o la política existe pero la
condición no se cumple. Recuerda que la fila debe tener `published = true` **y**
`deleted_at is null`. Un proyecto con `deleted_at` puesto por accidente desaparece.

**Diagnóstico** en SQL Editor:

```sql
select tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public'
order by tablename;
```

Debe existir, para `projects`, una política con `cmd = 'SELECT'`, `roles = {anon}` y una
condición `qual` que incluya `published` y `deleted_at`.

Y para ver qué está filtrando:

```sql
select slug, published, deleted_at from public.projects order by sort_order;
```

### F5. La subida falla: la URL prefirmada venció

**Síntoma**: en el panel, al subir un poster o un loop, la petición `PUT` responde `403`
con un cuerpo XML que contiene `Request has expired` o `SignatureDoesNotMatch`.

**Causas y arreglos**:

- **Vencimiento**: las URLs prefirmadas se generan con un TTL corto. Si el usuario abre el
  formulario, se distrae media hora y luego suelta el archivo, la firma ya venció. Arreglo:
  pedir la URL en el momento del `PUT`, no al montar el formulario. Así queda implementado
  en la Fase 4.
- **Reloj desincronizado**: si el reloj de tu equipo se desvía más de 15 minutos del real,
  cualquier firma nace inválida. En Windows: Configuración → Hora e idioma → **Sincronizar
  ahora**.
- **Encabezados que no coinciden**: si firmas incluyendo `Content-Type` y el navegador
  envía otro, la firma no coincide. El `Content-Type` del `PUT` debe ser idéntico al que
  se usó al firmar.
- **`PUT` ausente en CORS**: revisa el paso A4.

### F6. `npm run dev` arranca pero `/admin` entra en un ciclo de redirecciones

**Síntoma**: el navegador reporta `ERR_TOO_MANY_REDIRECTS` entre `/admin` y `/admin/login`.

**Causa**: el `matcher` del middleware incluye `/admin/login`, así que la propia página de
login se protege a sí misma y se redirige en bucle.

**Arreglo**: el matcher debe excluir explícitamente la ruta de login y los archivos
estáticos. La Fase 1 lo entrega ya excluido; si lo modificaste, revísalo.

### F7. Error de compilación en Cloudflare: `Node.js API is not supported`

**Síntoma**: el despliegue falla con mensajes sobre `crypto`, `stream` o `buffer` no
disponibles.

**Causa**: falta la bandera de compatibilidad, o alguna dependencia usa APIs de Node no
soportadas en Workers.

**Arreglo**:

1. **Workers & Pages → tu proyecto → Settings → Functions → Compatibility flags**: agrega
   `nodejs_compat` en Production y en Preview.
2. **Compatibility date**: fíjala en la fecha actual o posterior.
3. Vuelve a desplegar. Cambiar banderas no redespliega solo.

Si persiste, la dependencia culpable suele ser el SDK de S3. La alternativa ligera para
firmar URLs en Workers es `aws4fetch`, que usa solo APIs web estándar. Dímelo si aparece y
lo cambiamos en la Fase 4.

### F8. El sitio no refleja los cambios publicados desde el panel

**Síntoma**: guardas y publicas un proyecto, el panel confirma el guardado, pero el sitio
público sigue mostrando el estado anterior incluso tras recargar.

**Causas posibles, en orden de probabilidad**:

1. **El adaptador de despliegue no soporta ISR** (ver E0). Es la causa más probable si
   estás sobre `@cloudflare/next-on-pages`. Solución: cambiar de adaptador.
2. **La etiqueta de revalidación no coincide.** El `revalidateTag('...')` que dispara el
   guardado debe usar exactamente la misma cadena que el `fetch` de la página consumió.
   Un `projects` contra un `project` no coinciden y fallan en silencio.
3. **Caché de la CDN por delante.** Purga desde **Caching → Configuration → Purge
   Everything** y recarga con `Ctrl+Shift+R`.
4. **Estás mirando `www.` y publicaste en el ápice**, o al revés. Confirma la URL.

**Diagnóstico rápido**: abre la ruta en incógnito con un parámetro cualquiera
(`?v=2`) para saltarte la caché del navegador. Si con el parámetro se ve el cambio, el
problema es de caché; si no, el problema es de revalidación o de datos.

#### ✅ Casilla de verificación · Parte F

- [ ] Sabes dónde está la política CORS y cómo agregar un origen.
- [ ] Sabes reparar el `Content-Type` de un `.m3u8` ya subido.
- [ ] Sabes consultar `pg_policies` para diagnosticar RLS.
- [ ] Sabes purgar la caché de la CDN.

---

## Resumen del orden de ejecución

```text
A1 → A2 → A3 → A4 → A5 → A6 → A7        Cloudflare R2 listo
B1 → B2 ─────────────────────────────    Llaves de Supabase anotadas
                                          ↓
                            [ FASE 1: genero las migraciones ]
                                          ↓
B3 → B4 → B5 → B6 → B7                   Base de datos y usuarios listos
C                                        .env.local completo
D                                        Ejecución local verificada
                                          ↓
                            [ FASE 2, 3 y 4 ]
                                          ↓
E                                        Producción
```

Los pasos **B3 a B7 dependen de la Fase 1**, porque necesitan los archivos SQL. Ejecuta
ahora todo lo demás: A completo y B1–B2. Cuando tengas el bucket respondiendo y las llaves
de Supabase anotadas, pídeme la Fase 1.
