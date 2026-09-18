"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type InputHTMLAttributes } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { AuthShell } from "@/components/ui/AuthShell";
import { Field, Input, PasswordInput } from "@/components/ui/form";
import { Spinner } from "@/components/ui/Spinner";
import { Intro } from "@/components/ui/Intro";
import { useUiStore } from "@/store/ui-store";
import { authApi } from "@/services/api";
import { ApiError } from "@/lib/api-client";
import { supabase } from "@/lib/supabase-client";
import { validatePassword } from "@/lib/password-policy";
import { esDominioPermitido, mensajeDominioNoPermitido } from "@/lib/dominios-correo";
import { getLastSection } from "@/lib/last-section";
import styles from "@/styles/login.module.css";

/** Recuerda el último correo usado para iniciar sesión, en este navegador
 * -- ported 2026-09-01, según Nexit_Back/docs/10 §2.2: "el correo puede
 * quedar recordado del ingreso anterior para prellenar el campo" (la
 * pantalla no decide "primera vez o no" por adelantado -- eso es a
 * propósito, ver docs/10 -- pero sí puede ahorrarle escribirlo de nuevo). */
const LAST_EMAIL_KEY = "nexit_last_email";

function rememberEmail(value: string) {
  try {
    localStorage.setItem(LAST_EMAIL_KEY, value);
  } catch {
    // localStorage no disponible -- no es crítico, solo se pierde el prellenado.
  }
}

/**
 * Login real contra Supabase Auth (Nexit_Back/docs/10, sección 2.2 y 2.3 -- ver
 * también HU-01/HU-02/HU-04 en docs/12). Nunca habla con Nexit_Back: el
 * intercambio de credenciales es 100% frontend <-> Supabase.
 *
 *  - "Iniciar con código": para quien todavía no tiene contraseña (primera vez) --
 *    signInWithOtp -> verifyOtp(type: "email") -> crea su contraseña con updateUser.
 *  - "Iniciar con contraseña": para quien ya la tiene -- signInWithPassword.
 *  - "¿Olvidaste tu contraseña?": resetPasswordForEmail -> verifyOtp(type: "recovery")
 *    -> updateUser con la nueva contraseña (HU-04).
 *
 * Layout de dos paneles ported 2026-08-28 del mockup aprobado (Claude Diseño) --
 * el panel oscuro de la izquierda es solo presentación; toda la lógica de
 * arriba vive intacta en el panel derecho, paso a paso como antes.
 */

type Step =
  | "email"
  | "otp"
  | "create-password"
  | "password"
  | "recover-request"
  | "recover-code"
  | "recover-password";

/** Input de correo con ícono -- usado en los 3 pasos que piden el correo. */
function EmailInput({
  style,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <Mail
        size={17}
        strokeWidth={1.7}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3"
      />
      <Input
        type="email"
        autoComplete="email"
        invalid={invalid}
        style={{ height: 48, padding: "0 14px 0 40px", fontSize: 16, ...style }}
        {...props}
      />
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const pushToast = useUiStore((s) => s.pushToast);

  const [step, setStep] = useState<Step>("email");
  // Arranca vacío tanto en el servidor como en el primer render del cliente
  // -- a propósito. Antes se leía localStorage en el inicializador de
  // useState, pero ese inicializador también corre durante el renderizado
  // en el servidor (Next.js SSR), donde localStorage no existe: el
  // servidor siempre renderizaba el campo vacío y, si el navegador SÍ tenía
  // un correo recordado, el cliente lo mostraba apenas hidrataba -- server
  // y cliente no coincidían y React tiraba "Hydration failed" (mismo
  // problema que tenía Intro.tsx). El correo recordado se carga abajo, en
  // el efecto que ya existía para la autodetección "recurrente" (docs/30) --
  // así no hay dos lugares leyendo la misma llave de localStorage.
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Autodetección "recurrente" al cargar la pantalla (docs/30): si el correo
  // recordado ya tiene contraseña configurada, salta directo al paso de
  // contraseña sin que la persona tenga que escribir nada. Si falla (backend
  // caído, cuenta sin marca aún, etc.) o dice que no tiene, se queda en el
  // paso de correo como siempre -- por eso el catch no hace nada: se degrada
  // con gracia al comportamiento manual que ya existía (docs/10 §2.2).
  useEffect(() => {
    let correoRecordado = "";
    try {
      correoRecordado = localStorage.getItem(LAST_EMAIL_KEY)?.trim() ?? "";
    } catch {
      // localStorage no disponible -- no es crítico, solo se pierde el prellenado.
    }
    if (!correoRecordado) return;
    // Deliberado: mismo motivo que en Intro.tsx -- el correo recordado solo
    // se puede leer después de montar (ver comentario junto a useState de
    // arriba), así que llenarlo implica un setState acá.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmail(correoRecordado);
    authApi
      .estadoCuenta(correoRecordado)
      .then((estado) => {
        if (estado.tieneContrasena) setStep("password");
      })
      .catch(() => {
        // Silencioso a propósito -- ver comentario de arriba.
      });
    // Solo debe correr una vez al montar; no queremos repetir la consulta
    // cada vez que la persona escribe.
  }, []);

  function goToDashboard() {
    // Antes mandaba siempre a "/proveedores" -- ahora vuelve a la última
    // sección visitada (o Clientes, si es la primera vez). Ver
    // src/lib/last-section.ts.
    router.replace(getLastSection());
  }

  /**
   * Maneja el submit del paso de correo (botón "Enviar código" / Enter):
   * primero le pregunta a Nexit_Back si ese correo ya tiene contraseña
   * configurada (docs/30) y, si es así, salta directo al paso de contraseña
   * en vez de mandar un código -- sin que la persona tenga que saber de
   * antemano cuál de los dos botones usar. Si la consulta falla (backend
   * caído, sin red, etc.) sigue con el envío de código de siempre: ese flujo
   * no depende de Nexit_Back y nunca debe quedar bloqueado por él.
   */
  async function manejarContinuarConCorreo() {
    setError(null);
    if (!email.trim()) return setError("Escribe tu correo.");
    if (!esDominioPermitido(email)) return setError(mensajeDominioNoPermitido());
    setSubmitting(true);
    let tieneContrasena = false;
    try {
      tieneContrasena = (await authApi.estadoCuenta(email.trim())).tieneContrasena;
    } catch (err) {
      // Si no se pudo confirmar porque se agoto el limite de peticiones (mucha gente de la
      // misma oficina consultando "estado-cuenta" a la vez, ver docs/30 y appsettings.Production),
      // NO seguimos con el camino de "primera vez": eso terminaria en la pantalla de crear
      // contrasena y le pisaria la que ya tiene a alguien que sí la configuro antes -- justo el
      // bug reportado 2026-09-18. Se le avisa y se la manda al enlace manual de abajo en vez de
      // adivinar. Cualquier otra falla (backend caido, sin red) sigue degradandose con gracia al
      // envio de codigo, como antes -- ese caso no arriesga pisarle la contrasena a nadie.
      if (err instanceof ApiError && err.statusCode === 429) {
        setSubmitting(false);
        setError(
          "Hay mucha gente entrando a la vez y no pudimos confirmar tu cuenta. Si ya tienes contraseña, usa \"¿Ya tienes contraseña?\" abajo, o espera un momento y vuelve a intentar.",
        );
        return;
      }
    }
    if (tieneContrasena) {
      setSubmitting(false);
      setStep("password");
      return;
    }
    await enviarCodigo();
  }

  async function enviarCodigo() {
    setError(null);
    if (!email.trim()) return setError("Escribe tu correo.");
    if (!esDominioPermitido(email)) return setError(mensajeDominioNoPermitido());
    setSubmitting(true);
    const { error: err } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setSubmitting(false);
    if (err) return setError(err.message);
    pushToast("Te enviamos un código de 6 dígitos a tu correo", "info");
    setStep("otp");
  }

  async function verificarCodigo() {
    setError(null);
    if (!code.trim()) return setError("Escribe el código que te llegó por correo.");
    setSubmitting(true);
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setSubmitting(false);
    if (err) return setError(err.message);
    setCode("");
    setStep("create-password");
  }

  async function crearContrasena() {
    setError(null);
    const validationError = validatePassword(password, confirmPassword);
    if (validationError) return setError(validationError);
    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (err) return setError(err.message);
    rememberEmail(email.trim());
    try {
      // Best-effort (docs/30): marca la cuenta como "recurrente" para la
      // próxima vez. Si falla, no bloquea el login -- el enlace manual de
      // respaldo sigue disponible.
      await authApi.confirmarContrasena();
    } catch {
      // Silencioso a propósito -- ver comentario de arriba.
    }
    pushToast("Contraseña creada", "success");
    goToDashboard();
  }

  async function iniciarConContrasena() {
    setError(null);
    if (!email.trim()) return setError("Escribe tu correo.");
    if (!password) return setError("Escribe tu contraseña.");
    setSubmitting(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (err) return setError(err.message);
    rememberEmail(email.trim());
    goToDashboard();
  }

  async function solicitarRecuperacion() {
    setError(null);
    if (!email.trim()) return setError("Escribe tu correo.");
    if (!esDominioPermitido(email)) return setError(mensajeDominioNoPermitido());
    setSubmitting(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
    setSubmitting(false);
    if (err) return setError(err.message);
    pushToast("Te enviamos un código de recuperación a tu correo", "info");
    setStep("recover-code");
  }

  async function verificarCodigoRecuperacion() {
    setError(null);
    if (!code.trim()) return setError("Escribe el código que te llegó por correo.");
    setSubmitting(true);
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "recovery" });
    setSubmitting(false);
    if (err) return setError(err.message);
    setCode("");
    setStep("recover-password");
  }

  async function guardarNuevaContrasena() {
    setError(null);
    const validationError = validatePassword(password, confirmPassword);
    if (validationError) return setError(validationError);
    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (err) return setError(err.message);
    try {
      // Best-effort (docs/30) -- ver comentario de crearContrasena().
      await authApi.confirmarContrasena();
    } catch {
      // Silencioso a propósito.
    }
    pushToast("Contraseña actualizada", "success");
    goToDashboard();
  }

  return (
    <>
      <Intro />
      <AuthShell>
          {step === "email" && (
            <>
              <div className="mb-1.5 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em]">Bienvenido</div>
              <div className="mb-6 text-[15px] text-text-3">Inicia sesión en el sistema con tu cuenta corporativa.</div>
              <Field label="Correo" error={error ?? undefined}>
                <EmailInput
                  invalid={!!error}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@agencianextmkt.com"
                  onKeyDown={(e) => e.key === "Enter" && manejarContinuarConCorreo()}
                />
              </Field>
              <Button
                variant="primary"
                className="w-full justify-center h-[50px] !text-[15px]"
                onClick={manejarContinuarConCorreo}
                disabled={submitting}
              >
                {submitting ? (
                  <Spinner label="Enviando…" />
                ) : (
                  <>
                    Enviar código
                    <ArrowRight size={15} strokeWidth={2} className={styles.arrowIcon} />
                  </>
                )}
              </Button>
              <a
                className="mt-4 block cursor-pointer text-center text-[13px] text-text-3 hover:underline"
                onClick={() => {
                  setError(null);
                  setStep("password");
                }}
              >
                ¿Ya tienes contraseña? <span className="font-medium text-text">Inicia sesión</span>
              </a>
            </>
          )}

          {step === "otp" && (
            <>
              <div className="mb-1.5 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em]">Escribe tu código</div>
              <div className="mb-6 text-[15px] text-text-3">Te llegó un código de 6 dígitos a {email}</div>
              <Field label="Código" error={error ?? undefined}>
                <Input
                  invalid={!!error}
                  style={{ height: 48, padding: "0 14px", fontSize: 16 }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  onKeyDown={(e) => e.key === "Enter" && verificarCodigo()}
                />
              </Field>
              <Button
                variant="primary"
                className="w-full justify-center h-[50px] !text-[15px]"
                onClick={verificarCodigo}
                disabled={submitting}
              >
                {submitting ? (
                  <Spinner label="Verificando…" />
                ) : (
                  <>
                    Verificar código
                    <ArrowRight size={15} strokeWidth={2} className={styles.arrowIcon} />
                  </>
                )}
              </Button>
              <a className="mt-3.5 block cursor-pointer text-center text-xs text-teal-mid hover:underline" onClick={enviarCodigo}>
                Reenviar código
              </a>
              <a
                className="mt-1.5 block cursor-pointer text-center text-xs text-text-3 hover:underline"
                onClick={() => {
                  setError(null);
                  setStep("email");
                }}
              >
                Volver
              </a>
            </>
          )}

          {(step === "create-password" || step === "recover-password") && (
            <>
              <div className="mb-1.5 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em]">
                {step === "create-password" ? "Crea tu contraseña" : "Elige tu nueva contraseña"}
              </div>
              <div className="mb-6 text-[15px] text-text-3">
                Mínimo 10 caracteres, con mayúscula, minúscula, número y símbolo
              </div>
              <Field label="Contraseña">
                <PasswordInput
                  invalid={!!error}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu nueva contraseña"
                />
              </Field>
              <Field label="Repite tu contraseña" error={error ?? undefined}>
                <PasswordInput
                  invalid={!!error}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu nueva contraseña"
                  onKeyDown={(e) =>
                    e.key === "Enter" && (step === "create-password" ? crearContrasena() : guardarNuevaContrasena())
                  }
                />
              </Field>
              <Button
                variant="primary"
                className="w-full justify-center h-[50px] !text-[15px]"
                onClick={step === "create-password" ? crearContrasena : guardarNuevaContrasena}
                disabled={submitting}
              >
                {submitting ? (
                  <Spinner label="Guardando…" />
                ) : (
                  <>
                    Guardar contraseña
                    <ArrowRight size={15} strokeWidth={2} className={styles.arrowIcon} />
                  </>
                )}
              </Button>
            </>
          )}

          {step === "password" && (
            <>
              <div className="mb-1.5 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em]">Bienvenido de nuevo</div>
              <div className="mb-6 text-[15px] text-text-3">Inicia sesión en el sistema con tu cuenta corporativa.</div>
              <Field label="Correo">
                <EmailInput
                  invalid={!!error}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@agencianextmkt.com"
                />
              </Field>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium text-text-2">Contraseña</label>
                <a
                  className="cursor-pointer text-xs text-teal-mid hover:underline"
                  onClick={() => {
                    setError(null);
                    setPassword("");
                    setStep("recover-request");
                  }}
                >
                  ¿La olvidaste?
                </a>
              </div>
              <div className="mb-3.5">
                <PasswordInput
                  invalid={!!error}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  onKeyDown={(e) => e.key === "Enter" && iniciarConContrasena()}
                />
                {error && <div className="mt-1 text-xs text-red">{error}</div>}
              </div>
              <Button
                variant="primary"
                className="w-full justify-center h-[50px] !text-[15px]"
                onClick={iniciarConContrasena}
                disabled={submitting}
              >
                {submitting ? (
                  <Spinner label="Ingresando…" />
                ) : (
                  <>
                    Iniciar sesión
                    <ArrowRight size={15} strokeWidth={2} className={styles.arrowIcon} />
                  </>
                )}
              </Button>
              <a
                className="mt-3.5 block cursor-pointer text-center text-xs text-teal-mid hover:underline"
                onClick={() => {
                  setError(null);
                  setPassword("");
                  setStep("email");
                }}
              >
                ¿Prefieres iniciar con código?
              </a>
            </>
          )}

          {step === "recover-request" && (
            <>
              <div className="mb-1.5 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em]">Recuperar contraseña</div>
              <div className="mb-6 text-[15px] text-text-3">Te mandamos un código para elegir una nueva</div>
              <Field label="Correo" error={error ?? undefined}>
                <EmailInput
                  invalid={!!error}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@agencianextmkt.com"
                  onKeyDown={(e) => e.key === "Enter" && solicitarRecuperacion()}
                />
              </Field>
              <Button
                variant="primary"
                className="w-full justify-center h-[50px] !text-[15px]"
                onClick={solicitarRecuperacion}
                disabled={submitting}
              >
                {submitting ? (
                  <Spinner label="Enviando…" />
                ) : (
                  <>
                    Enviar código de recuperación
                    <ArrowRight size={15} strokeWidth={2} className={styles.arrowIcon} />
                  </>
                )}
              </Button>
              <a
                className="mt-3.5 block cursor-pointer text-center text-xs text-text-3 hover:underline"
                onClick={() => {
                  setError(null);
                  setStep("password");
                }}
              >
                Volver
              </a>
            </>
          )}

          {step === "recover-code" && (
            <>
              <div className="mb-1.5 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em]">Escribe tu código</div>
              <div className="mb-6 text-[15px] text-text-3">Te llegó un código de recuperación a {email}</div>
              <Field label="Código" error={error ?? undefined}>
                <Input
                  invalid={!!error}
                  style={{ height: 48, padding: "0 14px", fontSize: 16 }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  onKeyDown={(e) => e.key === "Enter" && verificarCodigoRecuperacion()}
                />
              </Field>
              <Button
                variant="primary"
                className="w-full justify-center h-[50px] !text-[15px]"
                onClick={verificarCodigoRecuperacion}
                disabled={submitting}
              >
                {submitting ? (
                  <Spinner label="Verificando…" />
                ) : (
                  <>
                    Verificar código
                    <ArrowRight size={15} strokeWidth={2} className={styles.arrowIcon} />
                  </>
                )}
              </Button>
              <a className="mt-3.5 block cursor-pointer text-center text-xs text-teal-mid hover:underline" onClick={solicitarRecuperacion}>
                Reenviar código
              </a>
            </>
          )}
      </AuthShell>
    </>
  );
}
