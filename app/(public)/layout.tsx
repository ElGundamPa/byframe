import { Navegacion } from '@/components/site/Navegacion'
import { PieDePagina } from '@/components/site/PieDePagina'
import { getAjustes } from '@/lib/queries'

/**
 * Envoltorio del sitio público: negro absoluto, navegación fija arriba y pie
 * abajo. El panel vive fuera de este grupo de rutas y tiene su propia paleta.
 */
export default async function LayoutPublico({
  children,
}: {
  children: React.ReactNode
}) {
  const ajustes = await getAjustes()

  return (
    <div className="min-h-dvh bg-black font-[family-name:var(--fuente-sans)] text-white">
      <Navegacion />
      {children}
      <PieDePagina ajustes={ajustes} />
    </div>
  )
}
