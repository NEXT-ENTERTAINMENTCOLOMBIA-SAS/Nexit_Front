"use client";

import { useEffect, useState } from "react";
import { ExternalLink, MessageCircle, Pencil } from "lucide-react";
import { Avatar, Badge, CountryBadge } from "@/components/ui/primitives";
import {
  DetailBox,
  DetailRow,
  Drawer,
  DrawerCloseButton,
  DrawerExpandButton,
  DrawerFooter,
  DrawerHeader,
  DrawerIconButton,
} from "@/components/ui/Drawer";
import { EntityAttachments } from "@/components/ui/EntityAttachments";
import { HistorialTimeline } from "@/components/ui/HistorialTimeline";
import { CLIENT_STATUS_COLORS, statusColor } from "@/lib/constants";
import { clienteAdjuntosApi } from "@/services/api/cliente-adjuntos-service";
import { historialApi } from "@/services/api/historial-service";
import { useCatalogosStore } from "@/store/catalogos-store";
import { useUiStore } from "@/store/ui-store";
import { toSafeHref } from "@/lib/url-safety";
import type { Cliente, HistorialCambio, Proyecto } from "@/types/api";

/**
 * Sin botón de eliminar: aquí solo se mira y se puede editar. Eliminar (o
 * pedirlo, si no eres admin) vive dentro del formulario de edición -- ver
 * ClienteFormModal -- para que no sea un clic accidental desde la vista de
 * solo lectura.
 */
export function ClienteDetail({
  cliente,
  proyectos,
  onClose,
  onEdit,
}: {
  cliente: Cliente | null;
  proyectos: Proyecto[];
  onClose: () => void;
  onEdit: () => void;
}) {
  const pushToast = useUiStore((s) => s.pushToast);
  const { paises, regionesPorPais, ciudadesPorRegion, fetchBase, fetchRegiones, fetchCiudades } = useCatalogosStore();
  const [historial, setHistorial] = useState<HistorialCambio[]>([]);
  const [historialCargando, setHistorialCargando] = useState(false);
  // Alicia 2026-09-08: "que lo pueda agrandar un poquito" -- el panel de
  // detalle empieza angosto (520px) y se puede agrandar con un clic.
  const [wide, setWide] = useState(false);

  useEffect(() => {
    if (!cliente) return;
    fetchBase();
    if (cliente.paisId) fetchRegiones(cliente.paisId);
    if (cliente.regionId) fetchCiudades(cliente.regionId);
  }, [cliente, fetchBase, fetchRegiones, fetchCiudades]);

  useEffect(() => {
    if (!cliente) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpia el historial del cliente anterior al cerrar el drawer
      setHistorial([]);
      return;
    }
    let cancelado = false;
    setHistorialCargando(true);
    historialApi
      .porEntidad("cliente", cliente.id)
      .then((rows) => {
        if (!cancelado) setHistorial(rows);
      })
      .catch(() => {
        if (!cancelado) setHistorial([]);
      })
      .finally(() => {
        if (!cancelado) setHistorialCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [cliente]);

  if (!cliente) return <Drawer open={false} onClose={onClose} size="detail"><></></Drawer>;

  function copyContact() {
    if (!cliente) return;
    const telefonos = cliente.telefonos.map((t) => t.telefono).join(", ");
    const emails = cliente.emails.map((e) => e.email).join(", ");
    const txt = `${cliente.nombre}\n${cliente.contacto ?? ""}\n${telefonos}\n${emails}`;
    navigator.clipboard?.writeText(txt).then(() => pushToast("Contacto copiado", "info"));
  }

  const proyectosDelCliente = proyectos.filter((p) => p.clienteId === cliente.id);
  const primerTelefono = cliente.telefonos[0]?.telefono;
  const whatsappHref = primerTelefono ? `https://wa.me/${primerTelefono.replace(/[^\d]/g, "")}` : null;
  // El botón de acción del pie usa el primer correo de la lista -- ver DetailBox "Contacto" para el
  // resto (ese sí lista todos).
  const primerEmail = cliente.emails[0]?.email;
  const correoHref = primerEmail ? `mailto:${primerEmail}` : null;
  const sc = statusColor(CLIENT_STATUS_COLORS, cliente.estado);
  const paisNombre = paises.find((p) => p.id === cliente.paisId)?.nombre;
  const regionNombre = regionesPorPais[cliente.paisId ?? ""]?.find((r) => r.id === cliente.regionId)?.nombre;
  const ciudadNombre = ciudadesPorRegion[cliente.regionId ?? ""]?.find((c) => c.id === cliente.ciudadId)?.nombre ?? cliente.ciudad;

  return (
    <Drawer open={Boolean(cliente)} onClose={onClose} size="detail" wide={wide}>
      <DrawerHeader>
        <Avatar nombre={cliente.nombre} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold leading-tight tracking-[-0.025em]">{cliente.nombre}</div>
          <div className="mt-[3px] text-[13px] text-text-3">{cliente.sector || "Sin sector"}</div>
        </div>
        <div className="flex flex-shrink-0 gap-1.5">
          <DrawerExpandButton wide={wide} onToggle={() => setWide((w) => !w)} />
          <DrawerIconButton label="Editar cliente" onClick={onEdit}>
            <Pencil size={15} strokeWidth={1.8} />
          </DrawerIconButton>
          <DrawerCloseButton onClose={onClose} />
        </div>
      </DrawerHeader>

      <div className="flex flex-1 flex-col gap-[18px] p-[22px]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge bg={sc.bg} color={sc.c}>
            {cliente.estado}
          </Badge>
          <Badge bg="#F1EFE8" color="#0C0C0C">
            {proyectosDelCliente.length} proyecto{proyectosDelCliente.length === 1 ? "" : "s"}
          </Badge>
        </div>

        <DetailBox
          title="Contacto"
          action={
            <button
              onClick={copyContact}
              className="cursor-pointer border-none bg-transparent text-xs font-medium text-teal-mid hover:underline"
            >
              Copiar
            </button>
          }
        >
          <DetailRow k="Persona" v={cliente.contacto || "—"} />
          <DetailRow k="Cargo" v={cliente.cargoContacto || "—"} />
          {cliente.telefonos.length > 0 ? (
            cliente.telefonos.map((t, i) => (
              <DetailRow
                key={t.id ?? i}
                k={t.etiqueta || "Teléfono"}
                v={
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate">{t.telefono}</span>
                    {i === 0 && whatsappHref && (
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-text-2 hover:border-text hover:text-text"
                        aria-label="Escribir por WhatsApp"
                      >
                        <MessageCircle size={12} strokeWidth={1.8} />
                      </a>
                    )}
                  </span>
                }
              />
            ))
          ) : (
            <DetailRow k="Teléfono" v="—" />
          )}
          {cliente.emails.length > 0 ? (
            cliente.emails.map((e, i) => (
              <DetailRow
                key={e.id ?? i}
                k={e.etiqueta || "Correo"}
                v={
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate">{e.email}</span>
                    <a
                      href={`mailto:${e.email}`}
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-text-2 hover:border-text hover:text-text"
                      aria-label="Escribir correo"
                    >
                      <ExternalLink size={12} strokeWidth={1.8} />
                    </a>
                  </span>
                }
              />
            ))
          ) : (
            <DetailRow k="Correo" v="—" />
          )}
        </DetailBox>

        <DetailBox title="Ubicación">
          <DetailRow
            k="País"
            v={
              paisNombre ? (
                <span className="flex items-center gap-1.5">
                  <CountryBadge pais={paisNombre} /> {paisNombre}
                </span>
              ) : (
                "—"
              )
            }
          />
          <DetailRow k="Departamento" v={regionNombre || "—"} />
          <DetailRow k="Ciudad" v={ciudadNombre || "—"} />
          <DetailRow k="Dirección" v={cliente.direccion || "—"} />
          <DetailRow
            k="Sitio web"
            v={
              cliente.web ? (
                (() => {
                  const href = toSafeHref(cliente.web);
                  // Si no es un http(s) válido (ej. alguien guardó algo tipo
                  // "javascript:...") no se vuelve un link clickeable -- se
                  // muestra el texto tal cual para que se pueda ver y corregir.
                  return href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-teal-mid hover:underline"
                    >
                      {cliente.web} <ExternalLink size={11} strokeWidth={2} />
                    </a>
                  ) : (
                    cliente.web
                  );
                })()
              ) : (
                "—"
              )
            }
          />
        </DetailBox>

        <DetailBox title="Notas internas">
          <p className="border-l-2 border-green pl-3 text-sm leading-relaxed text-text-2">
            {cliente.notas || "Sin notas registradas."}
          </p>
        </DetailBox>

        <DetailBox title="Archivos y enlaces" tone="plain">
          <EntityAttachments entityId={cliente.id} api={clienteAdjuntosApi} />
        </DetailBox>

        <DetailBox title="Historial de cambios" tone="plain">
          <HistorialTimeline cargando={historialCargando} historial={historial} />
        </DetailBox>
      </div>

      <DrawerFooter>
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-w-[130px] flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-teal-mid px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green hover:text-text"
          >
            <MessageCircle size={15} strokeWidth={1.8} />
            WhatsApp
          </a>
        )}
        {correoHref && (
          <a
            href={correoHref}
            className="inline-flex min-w-[130px] flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border bg-transparent px-3.5 py-2.5 text-sm font-medium text-text transition-colors hover:border-text hover:bg-bg"
          >
            <ExternalLink size={15} strokeWidth={1.8} />
            Correo
          </a>
        )}
      </DrawerFooter>
    </Drawer>
  );
}
