import { apiClient } from "@/lib/api-client";
import type { Notificacion } from "@/types/api";

/** Conecta contra NotificacionesController real (Nexit_Back) -- siempre la bandeja propia. */
export const notificacionesApi = {
  misNotificaciones: () => apiClient.get<Notificacion[]>("/api/notificaciones"),
  marcarLeida: (id: string) => apiClient.put<void>(`/api/notificaciones/${id}/marcar-leida`),
  /** Ícono de X del panel: descarta (borra) una notificación ya vista de la bandeja propia. */
  descartar: (id: string) => apiClient.delete<void>(`/api/notificaciones/${id}`),
};
