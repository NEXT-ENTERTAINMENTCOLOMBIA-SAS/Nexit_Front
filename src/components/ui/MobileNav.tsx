"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LogOut, Menu } from "lucide-react";
import { MOBILE_NAV_MORE, MOBILE_NAV_PRIMARY } from "@/lib/nav-items";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useAuthStore } from "@/store/auth-store";
import styles from "@/styles/shell.module.css";

/**
 * Barra de navegación inferior fija de móvil (< 1000px) -- reemplaza al
 * riel lateral cuando este desaparece (ver src/styles/shell.module.css).
 * Muestra los primeros 3 accesos y agrupa el resto ("Project Managers", "Usuarios")
 * más la cuenta/cerrar sesión detrás de "Más", igual que el
 * <nav class="nx-mobile"> del HTML aprobado (Clientes / Proyectos /
 * Proveedores / Más).
 *
 * "Más" abre una hoja inferior (bottom sheet) anclada al borde de abajo con
 * esquinas superiores redondeadas y un "grab handle" -- no el diálogo
 * centrado genérico (components/ui/Modal.tsx), que el HTML aprobado usa
 * solo para formularios. Medidas (radio 12px, handle 38x4px, ítems de
 * 44px) tomadas con getComputedStyle contra el HTML real en 390px.
 */
export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // La hoja "Más" es un overlay de pantalla completa igual que Drawer/Modal --
  // sin esto el fondo se seguía desplazando detrás de ella (el mismo "se
  // queda pegado" que Alicia reportó, pero este overlay quedó afuera del
  // primer arreglo porque no usa Drawer.tsx ni Modal.tsx).
  useBodyScrollLock(moreOpen);

  useEffect(() => {
    // Portal only mounts on the client to avoid rendering document on SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const moreActive = MOBILE_NAV_MORE.some((item) => pathname.startsWith(item.href));

  return (
    <>
      <nav className={styles.mobileNav} aria-label="Navegación principal">
        {MOBILE_NAV_PRIMARY.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={styles.mobileNavItem}
              aria-current={active ? "page" : undefined}
            >
              {active && <span aria-hidden className={styles.mobileNavActiveBar} />}
              <Icon size={20} strokeWidth={1.7} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className={styles.mobileNavItem}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
        >
          {moreActive && <span aria-hidden className={styles.mobileNavActiveBar} />}
          <Menu size={20} strokeWidth={1.7} />
          <span>Más</span>
        </button>
      </nav>

      {mounted &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Más"
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 transition-opacity"
            style={{ opacity: moreOpen ? 1 : 0, pointerEvents: moreOpen ? "all" : "none" }}
            onClick={() => setMoreOpen(false)}
          >
            <div
              className="w-full max-w-[480px] rounded-t-[12px] bg-surface px-3.5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-2.5 transition-transform"
              style={{ transform: moreOpen ? "translateY(0)" : "translateY(24px)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div aria-hidden className="mx-auto mb-3.5 h-1 w-[38px] rounded-full bg-border-strong" />

              <div className="flex flex-col gap-1">
                {MOBILE_NAV_MORE.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className="flex h-11 items-center gap-[13px] rounded-[4px] px-2.5 text-[15px] font-medium text-text hover:bg-gray-light"
                    >
                      <Icon size={18} strokeWidth={1.7} />
                      {item.label}
                    </Link>
                  );
                })}

                {user && (
                  <>
                    <div className="mt-2.5 flex items-center gap-2.5 border-t border-border pt-3.5">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green text-[12px] font-semibold text-text">
                        {user.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium text-text">{user.displayName}</div>
                        <div className="truncate text-[12px] text-text-3">{user.rol}</div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          setMoreOpen(false);
                          await logout();
                          router.replace("/login");
                        }}
                        className="flex h-11 flex-shrink-0 items-center gap-1.5 rounded-[3px] border border-border px-3.5 text-[13px] font-medium text-text hover:bg-gray-light"
                      >
                        <LogOut size={14} strokeWidth={2} />
                        Salir
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
