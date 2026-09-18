"use client";

import { useEffect, useState } from "react";
import { ExternalLink, MessageCircle, Pencil, UserMinus, UserPlus } from "lucide-react";
import { Avatar, Badge, CountryBadge, Stars, Tag } from "@/components/ui/primitives";
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
import { PROVIDER_STATUS_COLORS, statusColor } from "@/lib/constants";
import { toSafeHref } from "@/lib/url-safety";
import { proveedorAdjuntosApi } from "@/services/api/proveedor-adjuntos-service";
import { historialApi } from "@/services/api/historial-service";
import { useAuthStore } from "@/store/auth-store";
import { useCatalogosStore } from "@/store/catalogos-store";
import { useProvidersStore } from "@/store/providers-store";
import { useUiStore } from "@/store/ui-store";
import type { HistorialCambio, Proveedor } from "@/types/api";

/**
 * Sin botón de eliminar: aquí solo se mira y se puede editar. Eliminar (o
 * pedirlo) vive dentro del formulario de edición -- ver ProviderFormModal --
 * mismo patrón que ClienteDetail/ProjectDetail, para que no sea un clic
 * accidental desde la vista de solo lectura.
 */
export function ProviderDetail({
  provider,
  onClose,
  onEdit,
}: {
  provider: Proveedor | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  const pushToast = useUiStore((s) => s.pushToast);
  const user = useAuthStore((s) => s.user);
  const { marcarColaborador, quitarColaborador } = useProvidersStore();
  const { paises, categoriasProveedor, regionesPorPais, ciudadesPorRegion, fetchBase, fetchRegiones, fetchCiudades } = useCatalogosStore();

  const [historial, setHistorial] = useState<HistorialCambio[]>([]);
  const [historialCargando, setHistorialCargando] = useState(false);
  // Alicia 2026-09-08: "que lo pueda agrandar un poquito" -- el panel de
  // detalle empieza angosto (520px) y se puede agrandar con un clic.
  const [wide, setWide] = useState(false);

  useEffect(() => {
    if (!provider) return;
    fetchBase();
    if (provider.paisId) fetchRegiones(provider.paisId);
    if (provider.regionId) fetchCiudades(provider.regionId);
  }, [provider, fetchBase, fetchRegiones, fetchCiudades]);

  // Historial de cambios (docs/19/20) -- mismo patrón que ClienteDetail, la pantalla
  // que lo estrenó; a Proveedores y Proyectos nunca les había llegado esta sección
  // aunque el backend ya registra los cambios de las 3 entidades por igual.
  useEffect(() => {
    if (!provider) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpia el historial del proveedor anterior al cerrar el drawer
      setHistorial([]);
      return;
    }
    let cancelado = false;
    setHistorialCargando(true);
    historialApi
      .porEntidad("proveedor", provider.id)
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
  }, [provider]);

  if (!provider) return <Drawer open={false} onClose={onClose} size="detail"><></></Drawer>;

  const sc = statusColor(PROVIDER_STATUS_COLORS, provider.estado);
  const paisNombre = paises.find((p) => p.id === provider.paisId)?.nombre;
  const regionNombre = regionesPorPais[provider.paisId ?? ""]?.find((r) => r.id === provider.regionId)?.nombre;
  const ciudadNombre = ciudadesPorRegion[provider.regionId ?? ""]?.find((c) => c.id === provider.ciudadId)?.nombre;
  const yoSoyColaborador = Boolean(user && provider.colaboradores.some((c) => c.usuarioId === user.id));

  /** Número para WhatsApp (solo dígitos, con código de país incluido si el
   * proveedor lo guardó así) -- prefiere un teléfono etiquetado "WhatsApp"
   * o "Celular"; si no hay ninguno etiquetado así, usa el primero de la
   * lista. Devuelve null si no hay ningún teléfono registrado. */
  const numeroWhatsApp = (() => {
    if (provider.telefonos.length === 0) return null;
    const preferido =
      provider.telefonos.find((t) => /whatsapp/i.test(t.etiqueta || "")) ??
      provider.telefonos.find((t) => /celular|m[oó]vil/i.test(t.etiqueta || "")) ??
      provider.telefonos[0];
    const digitos = preferido.telefono.replace(/\D/g, "");
    return digitos || null;
  })();

  const whatsappHref = numeroWhatsApp ? `https://wa.me/${numeroWhatsApp}` : null;
  // El botón de acción del pie usa el primer correo de la lista -- ver DetailBox "Contacto" para el
  // resto (ese sí lista todos).
  const primerEmail = provider.emails[0]?.email;
  const correoHref = primerEmail ? `mailto:${primerEmail}` : null;

  function copyContact() {
    if (!provider) return;
    const telefonos = provider.telefonos.map((t) => t.telefono).join(", ");
    const emails = provider.emails.map((e) => e.email).join(", ");
    const txt = `${provider.nombre}\n${provider.contacto ?? ""}\n${telefonos}\n${emails}`;
    navigator.clipboard?.writeText(txt).then(() => pushToast("Contacto copiado", "info"));
  }

  async function toggleColaborador() {
    try {
      if (yoSoyColaborador) {
        await quitarColaborador(provider!.id);
      } else {
        await marcarColaborador(provider!.id);
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo actualizar", "danger");
    }
  }

  return (
    <Drawer open={Boolean(provider)} onClose={onClose} size="detail" wide={wide}>
      <DrawerHeader>
        <Avatar nombre={provider.nombre} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold leading-tight tracking-[-0.025em]">{provider.nombre}</div>
          <div className="mt-[3px] text-[13px] text-text-3">
            {categoriasProveedor.find((c) => c.id === provider.categoriaId)?.nombre ?? "Sin categoría"}
          </div>
        </div>
        <div className="flex flex-shrink-0 gap-1.5">
          <DrawerExpandButton wide={wide} onToggle={() => setWide((w) => !w)} />
          <DrawerIconButton label="Editar proveedor" onClick={onEdit}>
            <Pencil size={15} strokeWidth={1.8} />
          </DrawerIconButton>
          <DrawerCloseButton onClose={onClose} />
        </div>
      </DrawerHeader>

      <div className="flex flex-1 flex-col gap-[18px] p-[22px]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge bg={sc.bg} color={sc.c}>
            {provider.estado}
          </Badge>
          {typeof provider.score === "number" && (
            <Badge bg="#F1EFE8" color="#0C0C0C" className="flex items-center gap-1">
              <Stars n={provider.score} size={11} /> {provider.score}/5
            </Badge>
          )}
          {provider.cobertura && (
            <Badge bg="#F1EFE8" color="#0C0C0C">
              Cobertura: {provider.cobertura}
            </Badge>
          )}
          {provider.presupuesto && (
            <Badge bg="#F1EFE8" color="#0C0C0C">
              Presupuesto: {provider.presupuesto}
            </Badge>
          )}
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
          <DetailRow k="Persona" v={provider.contacto || "—"} />
          <DetailRow k="Cargo" v={provider.cargoContacto || "—"} />
          {provider.telefonos.length > 0 ? (
            provider.telefonos.map((t, i) => (
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
          {provider.emails.length > 0 ? (
            provider.emails.map((e, i) => (
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
          <DetailRow k="Dirección" v={provider.direccion || "—"} />
          <DetailRow
            k="Sitio web"
            v={
              provider.web ? (
                (() => {
                  const href = toSafeHref(provider.web);
                  return href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-teal-mid hover:underline"
                    >
                      {provider.web} <ExternalLink size={11} strokeWidth={2} />
                    </a>
                  ) : (
                    provider.web
                  );
                })()
              ) : (
                "—"
              )
            }
          />
        </DetailBox>

        {(provider.aforo != null || provider.costoReferencia) && (
          <DetailBox title="Detalles adicionales">
            {provider.aforo != null && <DetailRow k="Aforo" v={String(provider.aforo)} />}
            {provider.costoReferencia && <DetailRow k="Costo de referencia" v={provider.costoReferencia} />}
          </DetailBox>
        )}

        {/* Alicia 2026-09-19: "servicios que presta no son todos los servicios... quítalo" --
            era una lista incompleta armada a mano que daba la impresión de ser el catálogo
            completo. Para eso quedan las notas internas (ver ProviderFormModal.tsx). */}

        <DetailBox title={`Trabajando con este proveedor (${provider.colaboradores.length})`}>
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            {provider.colaboradores.map((c) => (
              <Tag key={c.usuarioId}>{c.nombre}</Tag>
            ))}
            {provider.colaboradores.length === 0 && <span className="text-sm text-text-3">Nadie se ha marcado todavía</span>}
          </div>
          <button
            type="button"
            onClick={toggleColaborador}
            className="flex h-9 w-fit cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] border border-border bg-surface px-3 text-[13px] font-medium text-text transition-colors hover:border-text hover:bg-bg"
          >
            {yoSoyColaborador ? <UserMinus size={14} strokeWidth={1.8} /> : <UserPlus size={14} strokeWidth={1.8} />}
            {yoSoyColaborador ? "Ya no trabajo con este proveedor" : "Estoy trabajando con este proveedor"}
          </button>
        </DetailBox>

        {provider.notas && (
          <DetailBox title="Notas internas">
            <p className="border-l-2 border-green pl-3 text-sm leading-relaxed text-text-2">{provider.notas}</p>
          </DetailBox>
        )}

        <DetailBox title="Archivos y enlaces" tone="plain">
          <EntityAttachments entityId={provider.id} api={proveedorAdjuntosApi} />
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
