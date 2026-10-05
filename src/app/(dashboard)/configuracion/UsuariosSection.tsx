"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { RowAction } from "@/components/ui/Table";
import { Avatar, Badge } from "@/components/ui/primitives";
import { CUENTA_ACTIVA_COLOR, CUENTA_INACTIVA_COLOR, ROL_COLORS } from "@/lib/constants";
import { usuariosApi } from "@/services/api/usuarios-service";
import { useAuthStore } from "@/store/auth-store";
import { useRolLabels } from "@/store/config-store";
import { useUiStore } from "@/store/ui-store";
import type { Usuario, UsuarioUpdateInput } from "@/types/api";
import { UsuarioFormModal } from "../usuarios/UsuarioFormModal";

/** Editar nombre, apellido, rol y estado de cada persona sin salir de Configuración (solo super_admin edita). */
export function UsuariosSection() {
  const me = useAuthStore((s) => s.user);
  const labels = useRolLabels();
  const pushToast = useUiStore((s) => s.pushToast);
  const puedeEditar = me?.rol === "super_admin";
  const [items, setItems] = useState<Usuario[] | null>(null);
  const [editing, setEditing] = useState<Usuario | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await usuariosApi.list());
    } catch (err) {
      setItems([]);
      pushToast(err instanceof Error ? err.message : "No se pudieron cargar los usuarios", "danger");
    }
  }, [pushToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    load();
  }, [load]);

  async function guardar(id: string, input: UsuarioUpdateInput) {
    try {
      const u = await usuariosApi.update(id, input);
      setItems((p) => (p ?? []).map((x) => (x.id === id ? u : x)));
      pushToast("Usuario actualizado", "success");
      setEditing(null);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo actualizar el usuario", "danger");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[0_1px_3px_rgba(12,12,12,.04)]">
        {items === null && <div className="px-4 py-3.5 text-sm text-text-3">Cargando…</div>}
        {items?.length === 0 && <div className="px-4 py-3.5 text-sm text-text-3">Sin usuarios.</div>}
        <div className="max-h-[480px] overflow-y-auto">
          {items?.map((u, i) => {
            const estado = u.activo ? CUENTA_ACTIVA_COLOR : CUENTA_INACTIVA_COLOR;
            return (
              <div key={u.id} className={`flex items-center gap-3 px-4 py-2.5 ${i !== items.length - 1 ? "border-b border-[#EFEDE7]" : ""}`}>
                <Avatar nombre={`${u.nombre} ${u.apellido}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{`${u.nombre} ${u.apellido}`.trim()}</div>
                  <div className="truncate text-[11.5px] text-text-3">{u.email}</div>
                </div>
                <Badge bg={ROL_COLORS[u.rol].bg} color={ROL_COLORS[u.rol].c}>{labels[u.rol] ?? u.rol}</Badge>
                <Badge bg={estado.bg} color={estado.c}>{u.activo ? "Activa" : "Desactivada"}</Badge>
                {puedeEditar && (
                  <RowAction label="Editar" onClick={() => setEditing(u)}><Pencil size={13} strokeWidth={1.8} /></RowAction>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="px-0.5 text-xs text-text-3">
        Invitar, registrar o dar de baja personas se sigue haciendo en <Link href="/usuarios" className="underline">Usuarios</Link>.
        {!puedeEditar && " Editar personas es exclusivo del super administrador."}
      </p>
      <UsuarioFormModal open={!!editing} onClose={() => setEditing(null)} onSave={guardar} editing={editing} esMiPropiaCuenta={editing?.id === me?.id} />
    </div>
  );
}
