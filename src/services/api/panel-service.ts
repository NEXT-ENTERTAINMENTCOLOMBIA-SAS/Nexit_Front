import { apiClient } from "@/lib/api-client";
import type { PanelPm } from "@/types/api";

/** Conecta contra PanelController real (Nexit_Back). Solo admin/super_admin. Reemplaza a informesApi. */
export const panelApi = {
  projectManagers: () => apiClient.get<PanelPm>("/api/panel/project-managers"),
};
