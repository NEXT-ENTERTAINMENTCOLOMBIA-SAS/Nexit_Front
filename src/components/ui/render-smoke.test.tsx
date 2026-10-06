import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { SkeletonCards, SkeletonRows } from "./Skeleton";
import { MoneyInput } from "./MoneyInput";
import { SavedViews } from "./SavedViews";
import { ProyectosKanban } from "@/app/(dashboard)/proyectos/ProyectosKanban";
import type { Proyecto } from "@/types/api";

const p = (id: string, estadoId: string): Proyecto => ({
  id, nombre: `Proyecto ${id}`, estadoId, porcentajeAvance: 0, propuestaEstado: "No enviada", pagado: false, equipo: [], proveedorIds: [], createdAt: "2026-01-01",
});

describe("render básico de componentes nuevos", () => {
  it("esqueletos", () => {
    expect(renderToString(<SkeletonCards count={2} columns={2} />)).toContain("role=\"status\"");
    expect(renderToString(<SkeletonRows rows={2} />)).toContain("animate-pulse");
  });
  it("campo de dinero muestra miles", () => {
    expect(renderToString(<MoneyInput valor="1500000" moneda="USD" onChange={() => {}} />)).toContain("1.500.000");
  });
  it("vistas guardadas", () => {
    expect(renderToString(<SavedViews clave="t" actual={{}} hayFiltros={false} onApply={() => {}} />)).toContain("Vistas");
  });
  it("tablero agrupa por estado", () => {
    const html = renderToString(
      <ProyectosKanban
        proyectos={[p("1", "a"), p("2", "b"), p("3", "a")]}
        estados={[{ id: "a", nombre: "En curso", fase: 1, orden: 1 }, { id: "b", nombre: "Finalizado", fase: 2, orden: 1 }]}
        clienteNombre={() => "Cliente X"}
        pmNombre={() => undefined}
        onOpen={() => {}}
        onMover={() => {}}
      />,
    );
    expect(html).toContain("En curso");
    expect(html).toContain("Proyecto 3");
    expect(html).toContain("Sin PM");
  });
});
