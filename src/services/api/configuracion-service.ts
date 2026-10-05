import { apiClient } from "@/lib/api-client";
import type { DominioCorreo, ListaConfigurable, OpcionConfig, OpcionesConfig, Rol, RolConfig } from "@/types/api";

/**
 * Conecta contra ConfiguracionController real (Nexit_Back). Leer roles y listas: cualquier
 * autenticado con perfil. Cambiarlos: admin/super_admin. Dominios de correo: solo super_admin.
 */
export const configuracionApi = {
  roles: {
    list: () => apiClient.get<RolConfig[]>("/api/configuracion/roles"),
    update: (rol: Rol, input: { etiqueta: string; descripcion: string }) => apiClient.put<RolConfig>(`/api/configuracion/roles/${rol}`, input),
  },
  opciones: {
    list: () => apiClient.get<OpcionesConfig>("/api/configuracion/opciones"),
    create: (lista: ListaConfigurable, valor: string) => apiClient.post<OpcionConfig>(`/api/configuracion/opciones/${lista}`, { valor }),
    update: (lista: ListaConfigurable, id: string, valor: string) => apiClient.put<OpcionConfig>(`/api/configuracion/opciones/${lista}/${id}`, { valor }),
    remove: (lista: ListaConfigurable, id: string) => apiClient.delete<void>(`/api/configuracion/opciones/${lista}/${id}`),
  },
  dominiosCorreo: {
    list: () => apiClient.get<DominioCorreo[]>("/api/configuracion/dominios-correo"),
    create: (dominio: string) => apiClient.post<DominioCorreo>("/api/configuracion/dominios-correo", { dominio }),
    remove: (id: string) => apiClient.delete<void>(`/api/configuracion/dominios-correo/${id}`),
  },
};
