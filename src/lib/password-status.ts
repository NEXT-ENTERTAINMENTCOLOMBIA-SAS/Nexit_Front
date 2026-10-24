import type { User } from "@supabase/supabase-js";
import { authApi } from "@/services/api/auth-service";

/**
 * "Esta cuenta ya tiene contraseña propia", guardado en Supabase Auth (`user_metadata`) en el
 * MISMO `updateUser` que crea la contraseña -- así la marca nace junto con la contraseña y no
 * depende de que exista ya una fila en `usuarios`.
 *
 * Por qué hace falta: la marca del backend (`usuarios.contrasena_configurada`, docs/30) solo se
 * puede poner cuando la persona ya tiene perfil. Quien entra por /login con código ANTES de
 * registrarse crea su contraseña sin perfil, el backend no puede anotarlo, y /registro se la
 * volvía a pedir ("crear contraseña dos veces"). Con esta marca, /registro y /login saben que ya
 * la creó y no se la piden de nuevo.
 *
 * Es solo una pista de interfaz para saltarse un paso: `user_metadata` lo puede editar la propia
 * persona, así que NUNCA debe usarse para autorizar nada (eso sigue siendo del backend).
 */
export const PASSWORD_SET_METADATA_KEY = "password_set";

/** Se pasa como `data` en `supabase.auth.updateUser({ password, data: PASSWORD_SET_METADATA })`. */
export const PASSWORD_SET_METADATA = { [PASSWORD_SET_METADATA_KEY]: true } as const;

export function tieneContrasenaMarcada(user: Pick<User, "user_metadata"> | null | undefined): boolean {
  return user?.user_metadata?.[PASSWORD_SET_METADATA_KEY] === true;
}

/**
 * Avisa al backend que la contraseña quedó configurada (`POST /api/auth/confirmar-contrasena`).
 * Best-effort, pero ya no silenciosa: reintenta una vez y deja un aviso en consola si falla (antes
 * el error se tragaba sin rastro, y la cuenta quedaba "sin contraseña" para el login siguiente).
 * Devuelve si quedó confirmada; nunca lanza.
 */
export async function confirmarContrasenaEnBackend(): Promise<boolean> {
  for (let intento = 1; intento <= 2; intento++) {
    try {
      await authApi.confirmarContrasena();
      return true;
    } catch (error) {
      if (intento === 2) {
        console.warn("No se pudo confirmar la contraseña en el backend (se volverá a intentar al iniciar sesión).", error);
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }
  return false;
}
