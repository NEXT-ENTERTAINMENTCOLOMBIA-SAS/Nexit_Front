"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, LogOut, Network, Plus, Search } from "lucide-react";
import { presenciaApi } from "@/services/api/presencia-service";
import { useAuthStore } from "@/store/auth-store";
import { usePageToolbarStore, type SearchSuggestion } from "@/store/page-toolbar-store";
import { NAV } from "@/lib/nav-items";
import { rememberSection } from "@/lib/last-section";
import { Button } from "@/components/ui/primitives";
import { ImportExportBar } from "@/components/ui/ImportExportBar";
import { MobileNav } from "@/components/ui/MobileNav";
import { NotificationsBell } from "@/components/ui/NotificationsBell";
import styles from "@/styles/shell.module.css";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const estadoPerfil = useAuthStore((s) => s.estadoPerfil);
  const logout = useAuthStore((s) => s.logout);
  const toolbar = usePageToolbarStore((s) => s.config);

  const [menuOpen, setMenuOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  // Desplegable de sugerencias del buscador global (Alicia 2026-09-18): cada página aporta su
  // propia lógica de "qué es una sugerencia" vía toolbar.getSuggestions (ver page-toolbar-store.ts).
  const [suggestOpen, setSuggestOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  /**
   * Guard de sesión Y de registro. Tener sesión en Supabase Auth no alcanza para usar Nexit:
   * hace falta además un perfil en `usuarios`. Alguien recién invitado tiene lo primero y no lo
   * segundo, y hasta ahora caía acá dentro con el rol "miembro" por defecto que le pone el Auth
   * Hook -- veía el dashboard sin ser nadie todavía. Ahora se le manda a /registro, que es donde
   * acepta su invitación y crea su perfil (el bloqueo de verdad lo hace Nexit_Back con
   * PerfilRequeridoFilter; esto solo evita que vea una pantalla que no va a funcionarle).
   */
  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (estadoPerfil === "sin-perfil") router.replace("/registro");
  }, [hydrated, user, estadoPerfil, router]);

  // Cuenta desactivada mientras la persona estaba adentro: se le cierra la sesión en vez de
  // dejarla dando vueltas por una interfaz donde todas las llamadas responden 403.
  useEffect(() => {
    if (estadoPerfil !== "inactivo") return;
    void (async () => {
      await logout();
      router.replace("/login");
    })();
  }, [estadoPerfil, logout, router]);

  // Recuerda la última sección visitada (Alicia 2026-09-07) -- ver
  // src/lib/last-section.ts: así "/" y el login después de entrar saben a
  // dónde llevarte en vez de mandar siempre a Proveedores.
  useEffect(() => {
    rememberSection(pathname);
  }, [pathname]);

  /**
   * Heartbeat de presencia en vivo (HU-12, docs/29) -- ping cada 50s mientras
   * la pestaña esté visible, para que "conectados ahora" en Usuarios sea
   * real. No pinguea con la pestaña en segundo plano (Page Visibility API),
   * tal cual pide el comentario del propio presencia-service.ts.
   */
  useEffect(() => {
    // Solo con perfil completo: sin fila en `usuarios` el ping responde 403, y no tiene sentido
    // anunciar como "conectada" a una cuenta que todavía no terminó de registrarse.
    if (!user || estadoPerfil !== "completo") return;
    let interval: ReturnType<typeof setInterval> | null = null;

    function pingIfVisible() {
      if (document.visibilityState === "visible") presenciaApi.ping().catch(() => {});
    }

    pingIfVisible();
    interval = setInterval(pingIfVisible, 50_000);
    document.addEventListener("visibilitychange", pingIfVisible);

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", pingIfVisible);
    };
  }, [user, estadoPerfil]);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSuggestOpen(false);
    }
    // Mismo criterio que el resto de overlays (Drawer, Modal, DeleteAction,
    // la hoja "Más" de móvil): Escape también cierra, no solo el click afuera.
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setSuggestOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Buscador inteligente (2026-09-18): este useMemo tiene que quedar ANTES del "return null" de
  // abajo -- React exige llamar los mismos Hooks, en el mismo orden, en cada render (Rules of
  // Hooks). Antes vivía después del early return, así que en el primer render (todavía sin
  // `hydrated`/`user`) este Hook ni se llamaba, y en el siguiente render sí -- React lo detecta
  // como "el Hook #36 cambió de useMemo a undefined" y tira el warning/error de la consola.
  const suggestions = useMemo(
    () => (toolbar?.getSuggestions && globalSearch.trim() ? toolbar.getSuggestions(globalSearch.trim()) : []),
    [toolbar, globalSearch],
  );

  // "cargando" incluido a propósito: hasta saber si tiene perfil no se pinta el dashboard, para
  // no mostrar medio segundo de interfaz a alguien que en realidad va camino a /registro.
  if (!hydrated || !user || estadoPerfil === "cargando" || estadoPerfil === "sin-perfil" || estadoPerfil === "inactivo") return null;

  function handleGlobalSearch(value: string) {
    setGlobalSearch(value);
    setSuggestOpen(value.trim().length > 0);
    window.dispatchEvent(new CustomEvent("nexit:search", { detail: value }));
  }

  function handleSelectSuggestion(s: SearchSuggestion) {
    setSuggestOpen(false);
    toolbar?.onSelectSuggestion?.(s);
  }

  return (
    <div className={clsx(styles.shell, railExpanded && styles.expanded)}>
      <aside
        className={clsx(
          styles.rail,
          "relative z-40 flex-col bg-[#0c0c0c] py-5 transition-[padding] duration-150",
          railExpanded ? "items-stretch px-3.5" : "items-center",
        )}
      >
        <Link
          href="/clientes"
          aria-label="Nexit"
          className={clsx("mb-9 flex items-center gap-2.5 overflow-hidden", railExpanded ? "px-1" : "justify-center")}
        >
          <span
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[4px] bg-green text-text"
            aria-hidden
          >
            <Network size={16} strokeWidth={2.1} />
          </span>
          {railExpanded && <span className="truncate text-[15px] font-semibold text-[#f4f3ef]">Nexit</span>}
        </Link>

        <nav className={clsx("flex flex-col gap-1", railExpanded ? "items-stretch" : "items-center")}>
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={railExpanded ? undefined : item.label}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative flex items-center rounded-[3px] text-white/65 transition-colors hover:bg-white/10 hover:text-white",
                  railExpanded
                    ? "h-[42px] gap-[13px] px-3 text-[14px] font-medium"
                    : "h-9 w-9 justify-center",
                  active && "bg-white/10 text-[#f4f3ef]",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className={clsx(
                      "absolute h-4 w-[2px] rounded-full bg-green",
                      railExpanded ? "left-0" : "-left-2.5",
                    )}
                  />
                )}
                <Icon size={18} strokeWidth={1.75} className="flex-shrink-0" />
                {railExpanded && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={clsx("mt-auto flex flex-col gap-4", railExpanded ? "items-stretch" : "items-center")}>
          <button
            type="button"
            onClick={() => setRailExpanded((v) => !v)}
            className={clsx(
              "flex h-6 w-6 items-center justify-center rounded-[3px] text-white/40 transition-colors hover:bg-white/10 hover:text-white",
              railExpanded ? "self-end" : "self-center",
            )}
            aria-label={railExpanded ? "Contraer menú" : "Expandir menú"}
          >
            {railExpanded ? <ChevronLeft size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
          </button>

          {railExpanded ? (
            <div className="flex items-center gap-2.5 border-t border-white/10 pt-3.5">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green text-[12px] font-semibold text-text">
                {user.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-[#f4f3ef]">{user.displayName}</div>
                <div className="truncate text-[11px] text-white/45">{user.rol}</div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  router.replace("/login");
                }}
                aria-label="Cerrar sesión"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[3px] text-white/45 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut size={15} strokeWidth={1.8} />
              </button>
            </div>
          ) : (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Cuenta"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-green text-[12px] font-semibold text-text"
              >
                {user.initials}
              </button>
              {menuOpen && (
                <div className="absolute bottom-0 left-[calc(100%+8px)] z-50 w-52 rounded-[var(--radius-lg)] border border-border bg-surface p-1.5 shadow-lg">
                  <div className="truncate px-2.5 py-1.5 text-[13px] font-medium text-text">{user.displayName}</div>
                  <div className="truncate px-2.5 pb-1.5 text-xs text-text-3">{user.email}</div>
                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      await logout();
                      router.replace("/login");
                    }}
                    className="flex w-full items-center gap-2 rounded-[3px] px-2.5 py-1.5 text-left text-[13px] text-text hover:bg-gray-light"
                  >
                    <LogOut size={14} strokeWidth={2} />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      <div className={styles.mobileHeader}>
        <Link href="/clientes" aria-label="Nexit" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[4px] bg-green text-text" aria-hidden>
            <Network size={16} strokeWidth={2.1} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-text">Nexit</span>
        </Link>
        <div className="ml-auto">
          <NotificationsBell />
        </div>
      </div>

      <header className={styles.desktopTopbar}>
        <div className={styles.desktopSearch} ref={searchRef}>
          <label>
            <span className="sr-only">Buscar en la vista actual</span>
            <Search size={16} strokeWidth={1.8} />
            <input
              type="search"
              value={globalSearch}
              onChange={(event) => handleGlobalSearch(event.target.value)}
              onFocus={() => setSuggestOpen(globalSearch.trim().length > 0)}
              placeholder={toolbar?.searchPlaceholder ?? "Buscar cliente, contacto o ciudad…"}
              role="combobox"
              aria-expanded={suggestOpen && suggestions.length > 0}
              aria-autocomplete="list"
            />
          </label>
          {suggestOpen && suggestions.length > 0 && (
            <div
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-[var(--radius-lg)] border border-text bg-surface shadow-[0_16px_44px_rgba(12,12,12,0.18)]"
            >
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  onClick={() => handleSelectSuggestion(s)}
                  className="flex w-full flex-col gap-0.5 border-b border-[#EFEDE7] px-3.5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[#F4F3EF]"
                >
                  <span className="text-[13px] font-medium text-text">{s.label}</span>
                  {s.sublabel && <span className="text-[11.5px] text-text-2">{s.sublabel}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="ml-auto flex flex-shrink-0 items-center gap-2.5">
          <NotificationsBell />
          {toolbar && (
            <>
              <ImportExportBar
                entidad={toolbar.entidad}
                puedeImportar={toolbar.puedeImportar}
                onExport={toolbar.onExport}
                onImport={toolbar.onImport}
                onImported={toolbar.onImported}
                textos={toolbar.textos}
              />
              {toolbar.addLabel && toolbar.onAdd && (
                <Button variant="primary" icon={toolbar.addIcon ?? Plus} onClick={toolbar.onAdd}>
                  {toolbar.addLabel}
                </Button>
              )}
            </>
          )}
        </div>
      </header>

      <main className={styles.main}>{children}</main>

      <MobileNav />
    </div>
  );
}
