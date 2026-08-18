/**
 * Layout del panel.
 *
 * Paleta propia y deliberadamente sobria: gris claro, texto oscuro, cero
 * cinematografía. El panel es una herramienta de trabajo, no una pieza de
 * diseño; se optimiza para leer y editar rápido.
 *
 * Fijar aquí color de fondo Y color de texto evita que un campo herede el
 * blanco del sitio público y quede escribiendo en blanco sobre blanco.
 */
export default function LayoutPanel({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-neutral-100 font-[family-name:var(--fuente-sans)] text-neutral-900">
      {children}
    </div>
  )
}
