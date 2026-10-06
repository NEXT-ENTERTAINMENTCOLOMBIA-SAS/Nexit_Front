/**
 * Esqueletos de carga (2026-10-05): en vez de un spinner que deja la pantalla vacía, se dibuja
 * la forma de lo que va a aparecer. Respeta "reducir movimiento" (la animación se apaga sola).
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-[var(--radius-md)] bg-gray-light motion-reduce:animate-none ${className}`} />;
}

/** Rejilla de tarjetas esqueleto (Proyectos, Clientes, Proveedores en vista de tarjetas). */
export function SkeletonCards({ count = 6, columns = 3 }: { count?: number; columns?: number }) {
  return (
    <div role="status" aria-label="Cargando" className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="mt-1 h-3 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="mt-2 h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Filas esqueleto para tablas. */
export function SkeletonRows({ rows = 8 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Cargando" className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-border bg-surface p-4">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}
