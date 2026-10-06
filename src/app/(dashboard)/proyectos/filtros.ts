import type { AlertaProyecto } from "@/types/api";

/** Filtros de la pantalla de Proyectos. Viajan en el enlace (?q=…&estado=…) para poder compartirlos. */
export interface FiltrosProyecto {
  search: string;
  estadoId: string;
  clienteId: string;
  tipo: string;
  pmId: string;
  alerta: AlertaProyecto | "";
  vista: "cards" | "table" | "board";
}

export const FILTROS_VACIOS: FiltrosProyecto = { search: "", estadoId: "", clienteId: "", tipo: "", pmId: "", alerta: "", vista: "cards" };

const ALERTAS: AlertaProyecto[] = ["sinPm", "sinProveedor", "proximos7", "proximos30"];
const VISTAS: FiltrosProyecto["vista"][] = ["cards", "table", "board"];

/** Enlace → filtros (null si el enlace no trae ninguno de los parámetros de filtro). */
export function filtrosDesdeUrl(params: URLSearchParams): Partial<FiltrosProyecto> | null {
  const f: Partial<FiltrosProyecto> = {};
  const q = params.get("q");
  if (q) f.search = q;
  const estado = params.get("estado");
  if (estado) f.estadoId = estado;
  const cliente = params.get("cliente");
  if (cliente) f.clienteId = cliente;
  const tipo = params.get("tipo");
  if (tipo) f.tipo = tipo;
  const pm = params.get("pm");
  if (pm) f.pmId = pm;
  const alerta = params.get("alerta") as AlertaProyecto | null;
  if (alerta && ALERTAS.includes(alerta)) f.alerta = alerta;
  const vista = params.get("vista") as FiltrosProyecto["vista"] | null;
  if (vista && VISTAS.includes(vista)) f.vista = vista;
  return Object.keys(f).length > 0 ? f : null;
}

/** Filtros → texto de enlace (solo lo que no está vacío; la vista por defecto "cards" tampoco se escribe). */
export function filtrosAUrl(f: FiltrosProyecto): string {
  const p = new URLSearchParams();
  if (f.search.trim()) p.set("q", f.search.trim());
  if (f.estadoId) p.set("estado", f.estadoId);
  if (f.clienteId) p.set("cliente", f.clienteId);
  if (f.tipo) p.set("tipo", f.tipo);
  if (f.pmId) p.set("pm", f.pmId);
  if (f.alerta) p.set("alerta", f.alerta);
  if (f.vista !== "cards") p.set("vista", f.vista);
  return p.toString();
}
