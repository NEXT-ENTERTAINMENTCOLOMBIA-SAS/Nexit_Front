"use client";

import type {
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cloneElement, isValidElement, useState } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import clsx from "clsx";

/** bg-surface (blanco), no bg-bg -- ported 2026-08-28: en el mockup los campos
 * son blancos sobre el fondo crema de la página, no del mismo tono que la página. */
const controlClass =
  "w-full rounded-[var(--radius-md)] border border-border bg-surface px-2.5 py-2 text-[13px] text-text outline-none transition-colors focus:border-teal-mid font-sans";

/** Borde rojo cuando el campo quedó marcado inválido (ported 2026-09-01 del
 * mockup: el patrón real es un borde que cambia a --red en vez de solo un
 * texto de error debajo -- ver p.ej. `nombreBorder` en el HTML aprobado,
 * usado ya en ClienteFormModal/ProjectFormModal; antes /login solo mostraba
 * el texto y dejaba el borde del input sin cambiar). */
const invalidClass = "border-red focus:border-red";

export function Field({
  label,
  icon: Icon,
  error,
  required,
  children,
  hint,
}: {
  label: string;
  /**
   * Ícono al lado de la etiqueta (Alicia, 2026-09-08: "utiliza íconos para lo de rol, mensaje,
   * porque es más lindo en los formularios"). Opcional a propósito: los formularios largos de
   * clientes/proveedores/proyectos se leen mejor sin un ícono por campo, así que se pone solo donde
   * el campo tiene una identidad clara (un rol, un correo, un mensaje) y no en cada casilla.
   */
  icon?: LucideIcon;
  error?: string;
  required?: boolean;
  children: ReactNode;
  hint?: ReactNode;
}) {
  // Mantiene la validación junto al control, como en el HTML aprobado: el
  // mensaje explica el error y el borde rojo identifica de inmediato el campo
  // que requiere atención. `children` puede ser un contenedor (por ejemplo,
  // la lista de teléfonos), por lo que solo se inyecta la prop en controles
  // que acepten `invalid`.
  const control =
    error && isValidElement(children)
      ? cloneElement(children as ReactElement<{ invalid?: boolean; "aria-invalid"?: boolean }>, {
          invalid: true,
          "aria-invalid": true,
        })
      : children;

  return (
    <div className="mb-3.5">
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-2">
        {Icon && <Icon size={13} strokeWidth={1.9} className="text-text-3" aria-hidden />}
        <span>
          {label} {required && <span className="text-red">*</span>}
        </span>
      </label>
      {control}
      {hint}
      {error && <div className="mt-1 text-xs text-red">{error}</div>}
    </div>
  );
}

export function Input({
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={clsx(controlClass, invalid && invalidClass, className)} {...props} />;
}

/** Input tipo contraseña con botón de mostrar/ocultar (ojo) -- ported 2026-08-28 del
 * mockup. Usado solo en /login (a diferencia de Input/Field, que se comparten con el
 * resto de la app), así que aquí sí puede llevar el tamaño exacto del mockup (48px de
 * alto, texto 16px) en vez del tamaño compacto de los formularios internos. */
export function PasswordInput({
  className,
  style,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        className={clsx(controlClass, invalid && invalidClass, className)}
        style={{ height: 48, paddingLeft: 14, paddingRight: 48, fontSize: 16, ...style }}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-[5px] top-[5px] flex h-[38px] w-[38px] items-center justify-center rounded-[3px] border border-border bg-bg text-text transition-colors hover:border-text hover:bg-ink hover:text-green"
      >
        {visible ? <EyeOff size={17} strokeWidth={1.7} /> : <Eye size={17} strokeWidth={1.7} />}
      </button>
    </div>
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx(controlClass, "cursor-pointer", className)} {...props} />;
}

export function Textarea({
  className,
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={clsx(controlClass, "min-h-[72px] resize-y", invalid && invalidClass, className)} {...props} />;
}

export function Row({ cols = 2, children }: { cols?: 2 | 3; children: ReactNode }) {
  return (
    <div
      className={clsx(
        "grid grid-cols-1 gap-3",
        cols === 2 ? "min-[1001px]:grid-cols-2" : "min-[1001px]:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}

/**
 * Encabezado de sección numerado ("01 Quién es", "02 Dónde está"...) usado
 * en los drawers de registro (Cliente/Proveedor/Proyecto) -- ported
 * 2026-09-02 del HTML aprobado. Medidas con getComputedStyle: número 12px
 * IBM Plex Mono en #00a85a, título 19px/600 Archivo, borde inferior
 * var(--border) con 11px de padding.
 */
export function FormSection({ n, title }: { n: string; title: string }) {
  return (
    <div className="mb-3.5 flex items-baseline gap-2 border-b border-border pb-2.5">
      <span className="font-mono text-xs text-[#00a85a]">{n}</span>
      <h3 className="text-[19px] font-semibold leading-tight tracking-[-0.025em] text-text">{title}</h3>
    </div>
  );
}

export function FieldGroup({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-3.5 rounded-[var(--radius-md)] bg-gray-light p-3.5 pb-1">
      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">{title}</div>
      {children}
    </div>
  );
}
