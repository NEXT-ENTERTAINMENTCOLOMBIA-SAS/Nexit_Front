"use client";

import { useEffect, useState } from "react";
import { Building2, CalendarCheck2, MapPin, Settings, Tags, Truck, Wrench } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useCatalogosStore } from "@/store/catalogos-store";
import styles from "@/styles/dashboard.module.css";
import { CatalogList } from "./CatalogList";
import { UbicacionesSection } from "./UbicacionesSection";
import { EstadosProyectoSection } from "./EstadosProyectoSection";
import { EtapasClienteSection } from "./EtapasClienteSection";

type Seccion = "ubicaciones" | "categorias-proveedor" | "servicios" | "estados-proveedor" | "estados-proyecto" | "etapas-cliente";

/**
 * Configuración (2026-09-09, debajo de Usuarios en el riel): así como admin/super_admin pueden
 * agregar/editar países, categorías de proveedor, estados de proyecto, etc. -- Alicia: "podemos
 * agregar más estados... más categorías o editarlas, podemos agregar más países... es de acuerdo
 * para poder agregar más etapas, como más etapas de proceso comercial". Es una pantalla de solo
 * catálogos: nada de esto toca clientes/proveedores/proyectos directamente, solo las listas de
 * las que esos formularios sacan sus opciones (mismo `catalogosApi` que ya usa el resto de la app).
 *
 * Rediseño 2026-09-10 (Alicia: "mejorar ese diseño... que sea flexible y uno pueda trabajar
 * superfácil y rápido ahí, sin problema e inconveniente"). Tres cambios de estructura sobre la v1:
 *
 * 1. Las 4 pestañas horizontales pasaron a un riel vertical de 6 secciones (categorías de
 *    proveedor y servicios ya no comparten pestaña con la nota de "estados de proveedor" -- cada
 *    catálogo es su propia sección, con su propio contador, así se ve de un vistazo cuánto hay en
 *    cada uno sin entrar). Un riel vertical también dice de entrada TODO lo que hay para
 *    administrar, en vez de esconder 3 de 4 detrás de un clic (una pestaña activa no insinúa que
 *    existan las otras tres tanto como una lista completa siempre visible).
 * 2. Cada lista (`CatalogList`) ahora agrega arriba y busca cuando hay muchos ítems -- ver ese
 *    archivo.
 * 3. Ubicaciones pasó de apilar país->región->ciudad verticalmente (cada clic empujaba todo hacia
 *    abajo) a un panel de dos columnas que no crece -- ver `UbicacionesSection`.
 */
const SECCIONES: { id: Seccion; label: string; icon: typeof MapPin; descripcion: string }[] = [
  { id: "ubicaciones", label: "Ubicaciones", icon: MapPin, descripcion: "Países, regiones y ciudades -- alimentan los selectores de ubicación de Clientes y Proveedores." },
  { id: "categorias-proveedor", label: "Categorías de proveedor", icon: Tags, descripcion: "Aparecen en el desplegable \u201cCategoría\u201d del formulario de Proveedor." },
  { id: "servicios", label: "Servicios", icon: Wrench, descripcion: "El catálogo de servicios que puede ofrecer un proveedor." },
  { id: "estados-proveedor", label: "Estados de proveedor", icon: Truck, descripcion: "Aparecen en el desplegable \u201cEstado\u201d del formulario de Proveedor." },
  { id: "estados-proyecto", label: "Fases y estados de proyecto", icon: CalendarCheck2, descripcion: "El recorrido completo de un proyecto, agrupado en fases -- alimenta \u201cEstado del proyecto\u201d." },
  { id: "etapas-cliente", label: "Etapas de proceso comercial", icon: Building2, descripcion: "Las etapas previas a que exista un brief -- distintas del estado del cliente (Activo/Prospecto/Inactivo)." },
];

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
  const [seccion, setSeccion] = useState<Seccion>("ubicaciones");

  useEffect(() => {
    if (puedeVer) fetchBase();
  }, [puedeVer, fetchBase]);

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
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-text-3">Catálogos</div>
        <h1 className={styles.h1}>Configuración</h1>
        <p className="mt-1 max-w-[640px] text-[13px] text-text-2">
          Los catálogos que usan los formularios de Clientes, Proveedores y Proyectos -- agregar o editar acá se refleja de inmediato en esas pantallas.
        </p>
      </div>

      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <nav className="flex flex-shrink-0 flex-row flex-wrap gap-1 rounded-[var(--radius-lg)] border border-border bg-surface p-1.5 shadow-[0_1px_3px_rgba(12,12,12,.04)] md:w-[272px] md:flex-col md:flex-nowrap">
          {SECCIONES.map((s) => {
            const activa = seccion === s.id;
            const conteo = conteos[s.id];
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSeccion(s.id)}
                className={`flex cursor-pointer items-start gap-2 rounded-[var(--radius-md)] px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                  activa ? "bg-text text-white" : "text-text-2 hover:bg-bg"
                }`}
              >
                <s.icon size={14} strokeWidth={1.8} className="mt-0.5 flex-shrink-0" />
                <span className="min-w-0 flex-1 leading-snug">{s.label}</span>
                {conteo !== undefined && (
                  <span className={`flex-shrink-0 font-mono text-[11px] ${activa ? "text-white/70" : "text-text-3"}`}>{conteo}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">
          {/* Encabezado de sección (2026-09-18, Alicia: "que mires bien todos los diseños... que
              todo quede súper chévere"): antes el panel de la derecha caía directo en la lista, sin
              decir para qué sirve ese catálogo -- ahora repite el nombre y explica en una línea
              dónde se usa, como cualquier guía de settings recomienda ("group by task, one-line
              helper text"), así uno no tiene que adivinarlo mirando el riel de la izquierda. */}
          {(() => {
            const activa = SECCIONES.find((s) => s.id === seccion)!;
            return (
              <div className="mb-3.5">
                <div className="flex items-center gap-2 text-[15px] font-semibold">
                  <activa.icon size={15} strokeWidth={1.8} className="text-text-3" />
                  {activa.label}
                </div>
                <p className="mt-1 text-[12.5px] text-text-3">{activa.descripcion}</p>
              </div>
            );
          })()}

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
            />
          )}

          {seccion === "estados-proyecto" && <EstadosProyectoSection />}

          {seccion === "etapas-cliente" && <EtapasClienteSection />}
        </div>
      </div>
    </div>
  );
}
