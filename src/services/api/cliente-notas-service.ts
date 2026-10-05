import { apiClient } from "@/lib/api-client";
import type { ClienteNota, ClienteNotaInput } from "@/types/api";

/** Notas internas de un cliente -- /api/clientes/{id}/notas (más reciente primero). */
export const clienteNotasApi = {
  list: (clienteId: string) => apiClient.get<ClienteNota[]>(`/api/clientes/${clienteId}/notas`),
  create: (clienteId: string, input: ClienteNotaInput) => apiClient.post<ClienteNota>(`/api/clientes/${clienteId}/notas`, input),
  remove: (clienteId: string, id: string) => apiClient.delete<void>(`/api/clientes/${clienteId}/notas/${id}`),
};
