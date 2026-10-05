"use client";

import { useEffect, useState } from "react";
import { AtSign, Building2, CalendarCheck2, Flag, Layers, MapPin, Settings, ShieldCheck, Tags, Truck, UsersRound, Wrench, Briefcase, ListChecks } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useCatalogosStore } from "@/store/catalogos-store";
import styles from "@/styles/dashboard.module.css";
import { CatalogList } from "./CatalogList";
import { UbicacionesSection } from "./UbicacionesSection";
import { EstadosProyectoSection } from "./EstadosProyectoSection";
import { EtapasClienteSection } from "./EtapasClienteSection";
import { RolesSection } from "./RolesSection";
import { UsuariosSection } from "./UsuariosSection";
import { DominiosSection } from "./DominiosSection";
import { ListasProyectoSection } from "./ListasProyectoSection";
import { useConfigStore } from "@/store/config-store";
import type { ListaConfigurable } from "@/types/api";

type Seccion =
  | "roles" | "usuarios" | "dominios"
  | "ubicaciones" | "categorias-proveedor" | "servicios" | "estados-proveedor" | "estados-proyecto" | "etapas-cliente"
  | `lista:${ListaConfigurable}`;
type Grupo = "acceso" | "ubicacion" | "proveedores" | "proyectos-clientes";

/**
 * Configuración (2026-09-09, debajo de Usuarios en el riel): así como admin/super_admin pueden
 * agregar/editar países, categorías de proveedor, estados de proyecto, etc. -- Alicia: "podemos
 * agregar más estados... más categorías o editarlas, podemos agregar más países... es de acuerdo
 * para poder agregar más etapas, como más etapas de proceso comercial". Es una pantalla de solo
 * catálogos: nada de esto toca clientes/proveedores/proyectos directamente, solo las listas de
 * las que esos formularios sacan sus opciones (mismo `catalogosApi` que ya usa el resto de la app).
 *
 * Rediseño 2026-09-18 (Alicia, tajante: "el diseño de configuración no me gusta, no me convence...
 * es muy mediocre... investiga sobre diseños de verdad"): investigué paneles de settings reales
 * (Notion, Linear -- ver fuentes en el mensaje) y de ahí saqué tres cambios de fondo sobre el
 * riel plano de la v2 (2026-09-10), que solo tenía 6 botones sueltos sin ninguna jerarquía:
 *
 * 1. Riel agrupado por tema (Ubicación / Proveedores / Proyectos y clientes), con un rótulo de
 *    grupo -- así como Notion separa "Cuenta" de "Espacio de trabajo" -- en vez de 6 ítems sueltos
 *    que no dicen nada sobre cómo se relacionan entre sí.
 * 2. Cada grupo tiene su propio color de acento (de la paleta que YA existe en la app -- azul,
 *    ámbar, verde -- nada inventado) que se repite en el ícono de cada catálogo de ese grupo, en
 *    el estado activo del riel y en el encabezado de la derecha -- así un vistazo rápido ya dice
 *    "esto es de Proveedores" antes de leer una sola palabra, como el acento de color por sección
 *    de Linear.
 * 3. El estado activo del riel dejó de ser un bloque negro sólido (que no decía nada del tema) --
 *    ahora es un tinte suave del color del grupo + una barra de acento a la izquierda, que es como
 *    Linear marca el ítem activo (fondo más claro, no un bloque opaco).
 */
const GRUPOS: Record<Grupo, { label: string; color: string; light: string }> = {
  acceso: { label: "Personas y acceso", color: "var(--text)", light: "var(--gray-light)" },
  ubicacion: { label: "Ubicación", color: "var(--blue)", light: "var(--blue-light)" },
  proveedores: { label: "Proveedores", color: "var(--amber)", light: "var(--amber-light)" },
  "proyectos-clientes": { label: "Proyectos y clientes", color: "var(--success)", light: "var(--success-light)" },
};

const SECCIONES: { id: Seccion; grupo: Grupo; label: string; icon: typeof MapPin; descripcion: string; soloSuper?: boolean }[] = [
  { id: "roles", grupo: "acceso", label: "Roles", icon: ShieldCheck, descripcion: "Cambia el nombre y la descripción de cada rol; se refleja en toda la app. Los permisos de cada uno no cambian." },
  { id: "usuarios", grupo: "acceso", label: "Usuarios", icon: UsersRound, descripcion: "Edita nombre, apellido, rol y estado de cada persona del equipo." },
  { id: "dominios", grupo: "acceso", label: "Dominios de correo", icon: AtSign, descripcion: "Dominios con los que se permite crear cuentas nuevas.", soloSuper: true },
  { id: "ubicaciones", grupo: "ubicacion", label: "Ubicaciones", icon: MapPin, descripcion: "Países, regiones y ciudades -- alimentan los selectores de ubicación de Clientes y Proveedores." },
  { id: "categorias-proveedor", grupo: "proveedores", label: "Categorías de proveedor", icon: Tags, descripcion: "Aparecen en el desplegable “Categoría” del formulario de Proveedor." },
  { id: "servicios", grupo: "proveedores", label: "Servicios", icon: Wrench, descripcion: "El catálogo de servicios que puede ofrecer un proveedor." },
  { id: "estados-proveedor", grupo: "proveedores", label: "Estados de proveedor", icon: Truck, descripcion: "Aparecen en el desplegable “Estado” del formulario de Proveedor." },
  { id: "estados-proyecto", grupo: "proyectos-clientes", label: "Fases y estados de proyecto", icon: CalendarCheck2, descripcion: "El recorrido completo de un proyecto, agrupado en fases -- alimenta “Estado del proyecto”." },
  { id: "etapas-cliente", grupo: "proyectos-clientes", label: "Etapas de proceso comercial", icon: Building2, descripcion: "Las etapas previas a que exista un brief -- distintas del estado del cliente (Activo/Prospecto/Inactivo)." },
];

const LISTAS_PROYECTO: { id: ListaConfigurable; label: string; icon: typeof MapPin; descripcion: string }[] = [
  { id: "tipo-proyecto", label: "Tipos de proyecto", icon: Briefcase, descripcion: "Opciones del campo “Tipo” del proyecto. Renombrar actualiza los proyectos que ya lo usan." },
  { id: "prioridad", label: "Prioridades", icon: Flag, descripcion: "Opciones de prioridad. “Alta” y “Media” están fijas: el cálculo automático de prioridad las necesita." },
  { id: "sede-next", label: "Sedes de Next", icon: MapPin, descripcion: "Sedes de la agencia que se pueden asignar a un proyecto." },
  { id: "estado-propuesta", label: "Estados de la propuesta", icon: ListChecks, descripcion: "Estado de la propuesta comercial. “No enviada” está fija." },
  { id: "area-seguimiento", label: "Áreas de seguimiento", icon: Layers, descripcion: "Áreas para clasificar las notas de seguimiento. “General” está fija." },
];
for (const l of LISTAS_PROYECTO) SECCIONES.push({ id: `lista:${l.id}`, grupo: "proyectos-clientes", label: l.label, icon: l.icon, descripcion: l.descripcion });

const GRUPOS_ORDEN: Grupo[] = ["acceso", "ubicacion", "proveedores", "proyectos-clientes"];

export default function ConfiguracionPage() {
  const user = useAuthStore((s) => s.user);
  const puedeVer = user?.rol === "admin" || user?.rol === "super_admin";
  const {
    paises,
    categoriasProveedor,
    servicios,
    estadosProveedor,
    estadosProyecto,
    etapasCliente,
    fetchBase,
    addCategoria,
    updateCategoria,
    addServicio,
    updateServicio,
    addEstadoProveedor,
    updateEstadoProveedor,
    removeCatalogo,
  } = useCatalogosStore();
  const esSuper = user?.rol === "super_admin";
  const fetchConfig = useConfigStore((st) => st.fetchConfig);
  const secciones = SECCIONES.filter((x) => !x.soloSuper || esSuper);
  const [seccion, setSeccion] = useState<Seccion>("roles");

  useEffect(() => {
    if (puedeVer) {
      fetchBase();
      fetchConfig({ force: true });
    }
  }, [puedeVer, fetchBase, fetchConfig]);

  if (!puedeVer) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-center text-text-2">
        <Settings size={28} strokeWidth={1.5} className="text-text-3" />
        <div className="text-[13px]">La configuración está disponible solo para administradores.</div>
      </div>
    );
  }

  const conteos: Partial<Record<Seccion, number>> = {
    ubicaciones: paises.length,
    "categorias-proveedor": categoriasProveedor.length,
    servicios: servicios.length,
    "estados-proveedor": estadosProveedor.length,
    "estados-proyecto": estadosProyecto.length,
    "etapas-cliente": etapasCliente.length,
  };
  const activa = secciones.find((s) => s.id === seccion) ?? secciones[0];
  const grupoActivo = GRUPOS[activa.grupo];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-text-3">Sistema</div>
        <h1 className={styles.h1}>Configuración</h1>
        <p className="mt-1 max-w-[640px] text-[13px] text-text-2">
          Todo lo que se puede ajustar en Nexit: nombres de roles, personas, listas y catálogos. Lo que cambies acá se refleja de inmediato en el resto de la app.
        </p>
      </div>

      <div className="flex flex-col gap-5 min-[1001px]:flex-row min-[1001px]:items-start">
        <nav className="flex flex-shrink-0 flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-2.5 shadow-[0_1px_3px_rgba(12,12,12,.04)] min-[1001px]:w-[280px]">
          {GRUPOS_ORDEN.map((g) => {
            const grupo = GRUPOS[g];
            const items = secciones.filter((s) => s.grupo === g);
            return (
              <div key={g} className="flex flex-col gap-0.5">
                <div className="px-2 pb-1 pt-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-text-3">{grupo.label}</div>
                {items.map((s) => {
                  const isActive = seccion === s.id;
                  const conteo = conteos[s.id];
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSeccion(s.id)}
                      style={isActive ? { background: grupo.light, borderLeftColor: grupo.color } : undefined}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] border-l-[3px] border-l-transparent py-2 pl-2.5 pr-2 text-left text-[13px] font-medium transition-colors ${
                        isActive ? "" : "text-text-2 hover:bg-bg"
                      }`}
                    >
                      <span
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] transition-colors"
                        style={isActive ? { background: grupo.color, color: "#fff" } : { background: grupo.light, color: grupo.color }}
                      >
                        <s.icon size={14} strokeWidth={1.8} />
                      </span>
                      <span className={`min-w-0 flex-1 leading-snug ${isActive ? "font-semibold text-text" : ""}`}>{s.label}</span>
                      {conteo !== undefined && (
                        <span
                          className="flex-shrink-0 rounded-full px-1.5 py-[1px] font-mono text-[10.5px]"
                          style={isActive ? { background: "rgba(255,255,255,.6)", color: grupo.color } : { background: "var(--gray-light)", color: "var(--text-3)" }}
                        >
                          {conteo}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">
          {/* Encabezado de sección: ícono grande con el color del grupo, título y para qué sirve
              este catálogo -- antes el panel de la derecha caía directo en la lista sin ningún
              contexto. Una franja superior del color del grupo conecta visualmente este encabezado
              con el ítem activo del riel de la izquierda. */}
          <div
            className="mb-3.5 flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-[0_1px_3px_rgba(12,12,12,.04)]"
            style={{ borderTop: `3px solid ${grupoActivo.color}` }}
          >
            <span
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)]"
              style={{ background: grupoActivo.light, color: grupoActivo.color }}
            >
              <activa.icon size={18} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">{activa.label}</div>
              <p className="mt-0.5 text-[12.5px] text-text-3">{activa.descripcion}</p>
            </div>
          </div>

          {seccion === "roles" && <RolesSection />}
          {seccion === "usuarios" && <UsuariosSection />}
          {seccion === "dominios" && esSuper && <DominiosSection />}
          {seccion.startsWith("lista:") && <ListasProyectoSection lista={seccion.slice(6) as ListaConfigurable} />}

          {seccion === "ubicaciones" && <UbicacionesSection />}

          {seccion === "categorias-proveedor" && (
            <CatalogList
              items={categoriasProveedor}
              itemLabel={categoriasProveedor.length === 1 ? "categoría" : "categorías"}
              placeholder="Nueva categoría…"
              emptyLabel="Sin categorías todavía."
              onAdd={addCategoria}
              onUpdate={updateCategoria}
              onRemove={(id) => removeCatalogo("categorias-proveedor", id)}
              accent="var(--amber)"
              accentLight="var(--amber-light)"
            />
          )}

          {seccion === "servicios" && (
            <CatalogList
              items={servicios}
              itemLabel={servicios.length === 1 ? "servicio" : "servicios"}
              placeholder="Nuevo servicio…"
              emptyLabel="Sin servicios todavía."
              onAdd={addServicio}
              onUpdate={updateServicio}
              onRemove={(id) => removeCatalogo("servicios", id)}
              accent="var(--amber)"
              accentLight="var(--amber-light)"
            />
          )}

          {/* 2026-09-10 (Alicia: "hazlo"): ya es un catálogo real del backend (antes vivía fijo en
              el código -- ver EstadoProveedor.cs/docs/schema/28). `proveedores.estado` sigue siendo
              texto libre, así que agregar/renombrar acá cambia lo que aparece en el desplegable de
              "Estado" del formulario de Proveedor de inmediato, igual que categorías o servicios. */}
          {seccion === "estados-proveedor" && (
            <CatalogList
              items={estadosProveedor}
              itemLabel={estadosProveedor.length === 1 ? "estado" : "estados"}
              placeholder="Nuevo estado…"
              emptyLabel="Sin estados todavía."
              onAdd={addEstadoProveedor}
              onUpdate={updateEstadoProveedor}
              onRemove={(id) => removeCatalogo("estados-proveedor", id)}
              accent="var(--amber)"
              accentLight="var(--amber-light)"
            />
          )}

          {seccion === "estados-proyecto" && <EstadosProyectoSection />}

          {seccion === "etapas-cliente" && <EtapasClienteSection />}
        </div>
      </div>
    </div>
  );
}
