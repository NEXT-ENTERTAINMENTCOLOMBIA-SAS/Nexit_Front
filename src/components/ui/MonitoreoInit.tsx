"use client";

import { useEffect } from "react";
import { iniciarMonitoreo } from "@/lib/monitoring";

/** Arranca el monitoreo de errores del navegador (no hace nada si no hay DSN configurado). */
export function MonitoreoInit() {
  useEffect(() => iniciarMonitoreo(), []);
  return null;
}
