import { Building2, CalendarCheck2, Settings, Truck, UserRoundCog, Users, type LucideIcon } from "lucide-react";

/**
 * Navegación del dashboard -- una sola fuente de verdad compartida por el
 * riel de escritorio (layout.tsx) y la barra/hoja "Más" de móvil
 * (MobileNav.tsx), para no repetir el mismo arreglo en dos archivos.
 * Orden y set de iconos confirmados 1:1 contra el HTML aprobado.
 */
export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV: NavItem[] = [
  { href: "/clientes", label: "Clientes", icon: Building2 },
  { href: "/proyectos", label: "Proyectos", icon: CalendarCheck2 },
  { href: "/proveedores", label: "Proveedores", icon: Truck },
  // 2026-10-05: reemplaza a "Informes" -- ya no se guardan capturas ni se exporta a Excel; interesa ver
  // cuántos proyectos, personas, clientes y proveedores tiene cada Project Manager.
  { href: "/project-managers", label: "Project Managers", icon: UserRoundCog },
  { href: "/usuarios", label: "Usuarios", icon: Users },
  // 2026-09-09: Alicia pidió que quede "abajo de usuarios" -- va al final a propósito. Igual que
  // Project Managers/Usuarios, se ve en el riel para cualquiera pero la página misma bloquea a quien no
  // es admin/super_admin (ver ConfiguracionPage).
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

/** Los primeros 3 items van en la barra inferior de móvil; el resto (Project Managers,
 *  Usuarios, Configuración) se ve solo en la hoja "Más" -- mismo criterio que el
 *  <nav class="nx-mobile"> del mockup (Clientes / Proyectos / Proveedores / Más). */
export const MOBILE_NAV_PRIMARY = NAV.slice(0, 3);
export const MOBILE_NAV_MORE = NAV.slice(3);
