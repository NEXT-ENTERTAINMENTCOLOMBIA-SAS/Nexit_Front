"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/ui/AuthShell";
import { Button } from "@/components/ui/primitives";
import { Field, Input, PasswordInput } from "@/components/ui/form";
import { inicialesPersona } from "@/lib/format";
import { Spinner } from "@/components/ui/Spinner";
import { ApiError } from "@/lib/api-client";
import { getLastSection } from "@/lib/last-section";
import { supabase } from "@/lib/supabase-client";
import { validatePassword } from "@/lib/password-policy";
import { authApi } from "@/services/api";
import { invitacionesApi } from "@/services/api/invitaciones-service";
import { useAuthStore } from "@/store/auth-store";
import { useUiStore } from "@/store/ui-store";
import { ROL_LABELS } from "@/lib/constants";
import type { Invitacion } from "@/types/api";

/**
 * Registro obligatorio: el paso que le falta a HU-11 (docs/25 de Nexit_Back, "la persona invitada
 * ve la invitación y decide"). Hasta ahora los endpoints existían pero no los llamaba nadie, así
 * que quien era invitado entraba al dashboard sin perfil y sin poder hacer nada.
 *
 * A dónde llega quien ve esta pantalla: ya se autenticó en Supabase Auth (aceptó el correo de
 * invitación), pero todavía no tiene fila en `usuarios` NI contraseña propia -- el enlace del
 * correo la deja con una sesión temporal, nada más. Ese es el estado "sin-perfil" del auth-store,
 * y es también lo que Nexit_Back bloquea de verdad con PerfilRequeridoFilter -- o sea, esto no es
 * un adorno del frontend: sin completar este paso, la API le responde 403 a todo lo demás. Nombre
 * y apellido los escribe ella misma, no quien invita (decisión de docs/25).
 *
 * Dos pasos, no uno (2026-09-09, docs/42, pedido de Alicia): primero el perfil (nombre/apellido),
 * y solo DESPUÉS la contraseña -- antes se entraba al dashboard con la sesión temporal de la
 * invitación, sin contraseña propia todavía, y había que crearla más adelante por el flujo de
 * código de un solo uso de `/login` (docs/30). Ahora, al aceptar, se crea todo de una vez: el
 * perfil primero (para no perder nombre/apellido si algo falla después) y la contraseña enseguida,
 * antes de dejarla entrar.
 */
type Estado = "cargando" | "invitacion" | "sin-invitacion" | "error";
type Paso = "perfil" | "contrasena";

export default function RegistroPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const estadoPerfil = useAuthStore((s) => s.estadoPerfil);
  const recargarPerfil = useAuthStore((s) => s.recargarPerfil);
  const logout = useAuthStore((s) => s.logout);
  const pushToast = useUiStore((s) => s.pushToast);

  const [estado, setEstado] = useState<Estado>("cargando");
  const [invitacion, setInvitacion] = useState<Invitacion | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  const [paso, setPaso] = useState<Paso>("perfil");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Quien ya tiene perfil no tiene nada que hacer acá (por ejemplo, si vuelve con el botón
  // "atrás" del navegador justo después de registrarse).
  useEffect(() => {
    if (!hydrated) return;
    if (!user) router.replace("/login");
    else if (estadoPerfil === "completo") router.replace(getLastSection());
  }, [hydrated, user, estadoPerfil, router]);

  const cargarInvitacion = useCallback(async () => {
    setEstado("cargando");
    try {
      setInvitacion(await invitacionesApi.mia());
      setEstado("invitacion");
    } catch (error) {
      // 404 es el caso esperado de "no hay ninguna pendiente para tu correo" -- no un fallo.
      if (error instanceof ApiError && error.statusCode === 404) {
        setEstado("sin-invitacion");
        return;
      }
      setMensajeError(error instanceof Error ? error.message : "No se pudo consultar tu invitación.");
      setEstado("error");
    }
  }, []);

  useEffect(() => {
    if (!hydrated || !user || estadoPerfil === "completo") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de la invitación pendiente
    cargarInvitacion();
  }, [hydrated, user, estadoPerfil, cargarInvitacion]);

  /** Paso 1: crea el perfil (nombre/apellido). Todavía no entra a ningún lado -- pasa al paso de
   * la contraseña, que es lo que de verdad la deja usar el sistema. */
  async function aceptar() {
    if (!invitacion) return;
    if (!nombre.trim() || !apellido.trim()) {
      setErrorFormulario("Escribe tu nombre y tu apellido para crear tu perfil.");
      return;
    }
    setEnviando(true);
    setErrorFormulario(null);
    try {
      await invitacionesApi.aceptar(invitacion.id, {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
      });
      setPaso("contrasena");
    } catch (error) {
      setErrorFormulario(error instanceof Error ? error.message : "No se pudo crear tu perfil.");
    } finally {
      setEnviando(false);
    }
  }

  /** Paso 2: crea la contraseña de verdad (hasta acá, la sesión era la temporal del enlace del
   * correo) y solo entonces entra al sistema. */
  async function crearContrasenaYEntrar() {
    const validationError = validatePassword(password, confirmPassword);
    if (validationError) {
      setErrorFormulario(validationError);
      return;
    }
    setEnviando(true);
    setErrorFormulario(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setErrorFormulario(err.message);
        return;
      }
      try {
        // Best-effort (docs/30): marca la cuenta como "recurrente" para la próxima vez. Si falla,
        // no bloquea la entrada -- el enlace manual de respaldo en /login sigue disponible.
        await authApi.confirmarContrasena();
      } catch {
        // Silencioso a propósito -- ver comentario de arriba.
      }
      // El rol viaja en el JWT, y lo pone el Auth Hook de Supabase leyendo `usuarios` (ver
      // docs/schema/03_auth_hook_custom_claims.sql). El token que esta persona tiene en la mano
      // se emitió ANTES de que existiera su fila, así que todavía dice "miembro" sin importar el
      // rol que le hayan propuesto. Refrescar la sesión vuelve a correr el hook y trae el rol
      // real -- sin esto entraría con permisos de miembro hasta que su token venciera solo.
      await supabase.auth.refreshSession();
      await recargarPerfil();
      pushToast("Listo, tu cuenta quedó creada", "success");
      router.replace(getLastSection());
    } catch (error) {
      setErrorFormulario(error instanceof Error ? error.message : "No se pudo crear tu contraseña.");
    } finally {
      setEnviando(false);
    }
  }

  async function rechazar() {
    if (!invitacion) return;
    if (!window.confirm("¿Rechazar la invitación? No se creará tu perfil y saldrás del sistema.")) return;
    setEnviando(true);
    try {
      await invitacionesApi.rechazar(invitacion.id);
      await logout();
      router.replace("/login");
    } catch (error) {
      setErrorFormulario(error instanceof Error ? error.message : "No se pudo rechazar la invitación.");
      setEnviando(false);
    }
  }

  async function salir() {
    await logout();
    router.replace("/login");
  }

  if (!hydrated || !user) return null;

  return (
    <AuthShell>
      {estado === "cargando" && (
        <div className="py-8 text-[13px] text-text-3">
          <Spinner label="Buscando tu invitación…" />
        </div>
      )}

      {estado === "error" && (
        <>
          <div className="mb-1.5 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em]">Algo falló</div>
          <div className="mb-6 text-[15px] text-text-3">{mensajeError}</div>
          <Button variant="primary" className="w-full justify-center h-[50px] !text-[15px]" onClick={cargarInvitacion}>
            Reintentar
          </Button>
          <a className="mt-3.5 block cursor-pointer text-center text-xs text-text-3 hover:underline" onClick={salir}>
            Cerrar sesión
          </a>
        </>
      )}

      {estado === "sin-invitacion" && (
        <>
          <div className="mb-1.5 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em]">Tu cuenta aún no tiene acceso</div>
          <div className="mb-6 text-[15px] leading-[1.55] text-text-3">
            Entraste con {user.email}, pero no hay ninguna invitación pendiente para ese correo, así que todavía no
            tienes un perfil en Nexit. Pídele a la administradora del sistema que te invite.
          </div>
          <Button variant="primary" className="w-full justify-center h-[50px] !text-[15px]" onClick={salir}>
            Cerrar sesión
          </Button>
        </>
      )}

      {estado === "invitacion" && invitacion && paso === "perfil" && (
        <>
          <div className="mb-1.5 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em]">Completa tu registro</div>
          <div className="mb-6 text-[15px] leading-[1.55] text-text-3">
            {invitacion.invitadoPorNombre ? `${invitacion.invitadoPorNombre} te invitó` : "Te invitaron"} a Nexit como{" "}
            <span className="font-medium text-text">{ROL_LABELS[invitacion.rol] ?? invitacion.rol}</span>. Escribe tu
            nombre y tu apellido para crear tu perfil.
          </div>

          {invitacion.mensaje && (
            <div className="mb-5 rounded-[var(--radius-md)] border border-border bg-surface px-3.5 py-3 text-[13px] leading-[1.5] text-text-2">
              “{invitacion.mensaje}”
            </div>
          )}

          <Field label="Nombre" required error={errorFormulario ?? undefined}>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre"
              autoComplete="given-name"
              style={{ height: 48, padding: "0 14px", fontSize: 16 }}
            />
          </Field>
          <Field label="Apellido" required>
            <Input
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              placeholder="Tu apellido"
              autoComplete="family-name"
              style={{ height: 48, padding: "0 14px", fontSize: 16 }}
              onKeyDown={(e) => e.key === "Enter" && aceptar()}
            />
          </Field>
          {/* Cómo se va a ver en la lista de usuarios: el avatar con las iniciales armadas solas
              a partir del nombre y el apellido (nunca hay un campo para escribirlas a mano). */}
          {(nombre.trim() || apellido.trim()) && (
            <div className="mb-5 flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-bg px-3.5 py-3">
              <span
                aria-hidden
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-ink text-[12px] font-semibold text-green"
              >
                {inicialesPersona(nombre, apellido)}
              </span>
              <div className="min-w-0 text-[12.5px] leading-[1.45]">
                <div className="truncate font-medium text-text">{`${nombre} ${apellido}`.trim()}</div>
                <div className="truncate text-text-2">Así te van a ver los demás</div>
              </div>
            </div>
          )}

          <Button
            variant="primary"
            className="w-full justify-center h-[50px] !text-[15px]"
            onClick={aceptar}
            disabled={enviando}
          >
            {enviando ? (
              <Spinner label="Creando tu perfil…" />
            ) : (
              <>
                Aceptar y continuar
                <ArrowRight size={15} strokeWidth={2} />
              </>
            )}
          </Button>

          <a
            className="mt-3.5 block cursor-pointer text-center text-xs text-text-3 hover:underline"
            onClick={() => !enviando && rechazar()}
          >
            Rechazar la invitación
          </a>
        </>
      )}

      {estado === "invitacion" && invitacion && paso === "contrasena" && (
        <>
          <div className="mb-1.5 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em]">Crea tu contraseña</div>
          <div className="mb-6 text-[15px] text-text-3">
            Mínimo 10 caracteres, con mayúscula, minúscula, número y símbolo
          </div>
          <Field label="Contraseña">
            <PasswordInput
              invalid={!!errorFormulario}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu nueva contraseña"
            />
          </Field>
          <Field label="Repite tu contraseña" error={errorFormulario ?? undefined}>
            <PasswordInput
              invalid={!!errorFormulario}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite tu nueva contraseña"
              onKeyDown={(e) => e.key === "Enter" && crearContrasenaYEntrar()}
            />
          </Field>
          <Button
            variant="primary"
            className="w-full justify-center h-[50px] !text-[15px]"
            onClick={crearContrasenaYEntrar}
            disabled={enviando}
          >
            {enviando ? (
              <Spinner label="Guardando…" />
            ) : (
              <>
                Crear contraseña y entrar
                <ArrowRight size={15} strokeWidth={2} />
              </>
            )}
          </Button>
        </>
      )}
    </AuthShell>
  );
}
