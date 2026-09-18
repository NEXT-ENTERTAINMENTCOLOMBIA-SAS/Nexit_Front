"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Link2, Upload, X } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { fileIcon, fmtSize } from "@/lib/format";
import { toSafeHref } from "@/lib/url-safety";
import { useUiStore } from "@/store/ui-store";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Forma mínima que necesita este componente de un adjunto real -- ClienteAdjunto,
 * ProveedorAdjunto y ProyectoAdjunto la cumplen los tres (mismo contrato, ver docs/28). */
export interface AttachmentLike {
  id: string;
  tipo: string; // "link" | "archivo"
  nombre: string;
  url?: string | null;
  meta?: string | null;
  tamanoBytes?: number | null;
}

/**
 * Un archivo/link "en espera" en un formulario de REGISTRO todavía sin guardar -- Alicia
 * 2026-09-10: "apenas abro el formulario, me tenía que haber salido esto [ya poder agregar]",
 * no solo apenas se registra. Como todavía no hay un id real de la entidad, esto vive
 * completamente en memoria del formulario (levantado por el `page.tsx` de cada módulo, no acá
 * adentro, para que sobreviva aunque este componente se vuelva a montar) hasta que la entidad
 * se guarda de verdad -- ahí `handleSave` sube cada archivo y crea cada link uno por uno con el
 * id ya real, y recién ahí deja de ser "pendiente".
 */
export interface PendingAttachment extends AttachmentLike {
  /** Solo para tipo "file": el archivo real todavía sin subir. */
  file?: File;
}

/** Las 5 operaciones que cada *-adjuntos-service.ts expone, todas colgadas del mismo id de
 * entidad (proveedorId, clienteId o proyectoId según el caso). */
export interface AttachmentsApi<T extends AttachmentLike> {
  list: (entityId: string) => Promise<T[]>;
  crearLink: (entityId: string, input: { tipo: string; nombre: string; url: string }) => Promise<T>;
  subirArchivo: (entityId: string, archivo: File) => Promise<T>;
  obtenerUrlDescarga: (entityId: string, adjuntoId: string) => Promise<{ url: string }>;
  remove: (entityId: string, adjuntoId: string) => Promise<void>;
}

/**
 * "Archivos y enlaces" genérico -- generalizado 2026-09-03 desde el que ya existía solo para
 * proveedores (ver docs/28, HU-13) para poder reutilizarlo también en Cliente y Proyecto, que
 * comparten exactamente el mismo contrato de adjuntos del lado del backend.
 *
 * Rediseñado 2026-09-08 (Alicia: "el diseño de archivos y enlaces... muy feo, mejora este
 * diseño") -- la zona de arrastre y las filas de la lista eran muy planas y apretadas
 * comparadas con el resto de la app; ahora usan el mismo lenguaje visual que ya se estableció
 * en otras pantallas.
 *
 * Modo "en espera" agregado 2026-09-10 (Alicia, tras varias vueltas: "apenas abro el
 * formulario, me tenía que haber salido esto... no tenía que haberle yo escribir el nombre...
 * y darle registrar"). Antes de esto, `entityId` siempre era un id real (o el formulario ni
 * mostraba esta sección) -- ahora `entityId` puede ser `null` (registro nuevo, sin guardar
 * todavía), y en ese caso el componente NO llama a la API para nada: arrastrar un archivo o
 * agregar un link solo los guarda en la lista `pending` que vive en el `page.tsx` del módulo
 * (subida por props, junto con `onPendingChange`), exactamente con la misma UI de siempre. El
 * `page.tsx` es quien de verdad sube/crea cada uno, uno por uno, apenas el registro se guarda.
 */
export function EntityAttachments<T extends AttachmentLike>({
  entityId,
  api,
  pending,
  onPendingChange,
}: {
  entityId: string | null;
  api: AttachmentsApi<T>;
  /** Solo se usa cuando `entityId` es `null`. */
  pending?: PendingAttachment[];
  onPendingChange?: (next: PendingAttachment[]) => void;
}) {
  const pushToast = useUiStore((s) => s.pushToast);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [adjuntos, setAdjuntos] = useState<T[]>([]);
  const [loading, setLoading] = useState(entityId !== null);
  const [uploading, setUploading] = useState(false);
  // id del adjunto que se está descargando ahora mismo (pidiendo la URL firmada) --
  // por id y no un booleano global, porque puede haber varios adjuntos en la lista.
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (entityId === null) return; // nada que cargar -- la lista viene de `pending` (ver arriba)
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial adjuntos load on mount/entityId change
    setLoading(true);
    api
      .list(entityId)
      .then((items) => {
        if (!cancelled) setAdjuntos(items);
      })
      .catch(() => {
        if (!cancelled) setAdjuntos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `api` es un objeto de funciones estable (el módulo del servicio), no necesita entrar a las deps
  }, [entityId]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (entityId === null) {
      const next = [...(pending ?? [])];
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_BYTES) {
          pushToast(`"${file.name}" supera el máximo de 20 MB`, "danger");
          continue;
        }
        next.push({ id: crypto.randomUUID(), tipo: "file", nombre: file.name, tamanoBytes: file.size, file });
      }
      onPendingChange?.(next);
      return;
    }
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) {
        pushToast(`"${file.name}" supera el máximo de 20 MB`, "danger");
        continue;
      }
      setUploading(true);
      try {
        const created = await api.subirArchivo(entityId, file);
        setAdjuntos((prev) => [...prev, created]);
      } catch (err) {
        pushToast(err instanceof Error ? err.message : `No se pudo subir "${file.name}"`, "danger");
      } finally {
        setUploading(false);
      }
    }
  }

  async function addLink() {
    const url = linkUrl.trim();
    const nombre = linkName.trim() || url;
    if (!url) return;
    const safeUrl = toSafeHref(url);
    if (!safeUrl) {
      // No es http(s) -- ej. alguien pegó algo tipo "javascript:...". Se
      // rechaza acá para que ni siquiera llegue a guardarse (ver
      // src/lib/url-safety.ts): abrir ese link más adelante con
      // window.open() lo ejecutaría.
      pushToast("Ese link no es una URL válida (debe empezar con http:// o https://).", "danger");
      return;
    }
    if (entityId === null) {
      onPendingChange?.([...(pending ?? []), { id: crypto.randomUUID(), tipo: "link", nombre, url: safeUrl }]);
      setLinkName("");
      setLinkUrl("");
      return;
    }
    try {
      const created = await api.crearLink(entityId, { tipo: "link", nombre, url: safeUrl });
      setAdjuntos((prev) => [...prev, created]);
      setLinkName("");
      setLinkUrl("");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo agregar el link", "danger");
    }
  }

  async function removeAdjunto(id: string) {
    if (entityId === null) {
      onPendingChange?.((pending ?? []).filter((a) => a.id !== id));
      return;
    }
    try {
      await api.remove(entityId, id);
      setAdjuntos((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo eliminar", "danger");
    }
  }

  async function openAdjunto(a: AttachmentLike) {
    if (entityId === null) {
      if (a.tipo === "link") {
        const safeUrl = a.url ? toSafeHref(a.url) : null;
        if (!safeUrl) {
          pushToast("Este link no es una URL http(s) válida.", "danger");
          return;
        }
        window.open(safeUrl, "_blank", "noreferrer");
        return;
      }
      // Archivo todavía sin subir -- se abre una vista previa local (nunca tocó el servidor).
      const file = (a as PendingAttachment).file;
      if (!file) return;
      const objectUrl = URL.createObjectURL(file);
      window.open(objectUrl, "_blank", "noreferrer");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      return;
    }
    if (a.tipo === "link") {
      // Segunda validación acá (además de la de addLink) -- por si el
      // adjunto se guardó antes de este arreglo, o se creó llamando a la
      // API directo sin pasar por este formulario.
      const safeUrl = a.url ? toSafeHref(a.url) : null;
      if (!safeUrl) {
        pushToast("Este link no es una URL http(s) válida.", "danger");
        return;
      }
      window.open(safeUrl, "_blank", "noreferrer");
      return;
    }
    setDownloadingId(a.id);
    try {
      const { url } = await api.obtenerUrlDescarga(entityId, a.id);
      const safeUrl = toSafeHref(url);
      if (!safeUrl) {
        pushToast("No se pudo generar un enlace de descarga válido.", "danger");
        return;
      }
      window.open(safeUrl, "_blank", "noreferrer");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo generar el enlace de descarga", "danger");
    } finally {
      setDownloadingId(null);
    }
  }

  const list: AttachmentLike[] = entityId === null ? (pending ?? []) : adjuntos;

  return (
    <div>
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!uploading) handleFiles(e.dataTransfer.files);
        }}
        aria-busy={uploading}
        className={`mb-3 flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border-[1.5px] border-dashed px-4 py-6 text-center transition-colors ${uploading ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        style={{
          borderColor: dragOver ? "var(--teal-mid)" : "var(--border-strong)",
          // Alicia 2026-09-09: la zona de arrastre se veía "un poquito oscurito" -- un
          // relleno tenue (en vez de transparente) hace que destaque sobre el blanco del
          // panel sin perder el patrón de "zona de arrastre" ya establecido.
          background: dragOver ? "var(--teal-light)" : "var(--gray-light)",
        }}
      >
        {uploading ? (
          <Spinner label="Subiendo…" />
        ) : (
          <>
            <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "var(--teal-light)" }}>
              <Upload size={16} strokeWidth={1.75} style={{ color: "var(--teal-mid)" }} />
            </div>
            <div className="pointer-events-none">
              <div className="text-[13px] font-medium text-text">Arrastra un archivo aquí</div>
              <div className="mt-0.5 text-[11px] text-text-3">o haz clic para subir · PDF o Excel, máx. 20 MB</div>
            </div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.xls,.xlsx"
          multiple
          hidden
          disabled={uploading}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Alicia 2026-09-09: en el panel angosto del detalle (520px) este renglón se salía del
          contenedor -- el motivo es un gotcha clásico de flexbox: un <input> sin `min-w-0` no
          encoge por debajo de su ancho de contenido por defecto (~20 caracteres) aunque tenga
          `flex-1`, así que el renglón entero se desbordaba en vez de repartirse. Con `min-w-0`
          los dos campos sí encogen para caber, y el botón (que no encoge) queda siempre visible
          completo -- mismo ancho relativo entre los tres, ya no se corta "Agregar". */}
      <div className="mb-3 flex gap-2">
        <input
          value={linkName}
          onChange={(e) => setLinkName(e.target.value)}
          placeholder="Nombre del link"
          className="h-10 min-w-0 flex-1 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-[13px] text-text outline-none transition-colors focus:border-teal-mid"
        />
        <input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://…"
          onKeyDown={(e) => e.key === "Enter" && addLink()}
          className="h-10 min-w-0 flex-1 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-[13px] text-text outline-none transition-colors focus:border-teal-mid"
        />
        <button
          type="button"
          onClick={addLink}
          className="flex h-10 flex-shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] bg-teal-mid px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-green hover:text-text"
        >
          <Link2 size={14} strokeWidth={2} />
          Agregar
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {loading && <div className="py-2 text-center text-xs text-text-3">Cargando…</div>}
        {!loading && list.length === 0 && (
          <div className="py-2 text-center text-xs text-text-3">Sin archivos ni links aún</div>
        )}
        {list.map((a) => {
          const Icon = fileIcon(a.nombre, a.tipo === "link" ? "link" : "file");
          return (
            <div
              key={a.id}
              className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[#EFEDE7] bg-[#FBFAF7] px-3 py-2.5 transition-colors hover:border-border"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-gray-light">
                <Icon size={15} strokeWidth={1.75} className="text-text-2" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{a.nombre}</div>
                <div className="mt-0.5 truncate text-[11px] text-text-3">
                  {a.tipo === "link" ? a.meta || a.url : fmtSize(a.tamanoBytes ?? 0)}
                </div>
              </div>
              <div className="flex flex-shrink-0 gap-1">
                <button
                  onClick={() => openAdjunto(a)}
                  disabled={downloadingId === a.id}
                  className="flex cursor-pointer items-center rounded-[var(--radius-md)] border-none bg-transparent p-1.5 text-text-2 hover:bg-border disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={a.tipo === "link" ? "Abrir link" : "Descargar"}
                >
                  {downloadingId === a.id ? (
                    <Spinner />
                  ) : a.tipo === "link" ? (
                    <ExternalLink size={14} strokeWidth={2} />
                  ) : (
                    <Download size={14} strokeWidth={2} />
                  )}
                </button>
                <button
                  onClick={() => removeAdjunto(a.id)}
                  className="flex cursor-pointer items-center rounded-[var(--radius-md)] border-none bg-transparent p-1.5 text-red hover:bg-border"
                  aria-label="Eliminar"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
