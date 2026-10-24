# Estado actual y por dónde retomar -- Nexit Front

> Ultima actualizacion: 2026-10-23, sesion de revision con Claude (estructura, bugs de
> autenticacion, bugs silenciosos). Este archivo es el "donde quedamos": cuando se cumpla un
> pendiente, se borra de aqui. Para como encaja el front con el resto del sistema, ver
> `CONTEXTO-PROYECTO.md`.

## Donde quedamos

- Los cambios de esta sesion estan hechos pero **sin commit ni push** (ver lista abajo).
- Verificado en una copia con binarios de Linux: pruebas 81/81, `tsc --noEmit` limpio, `eslint` limpio.
- Falta: probar el flujo a mano (seccion "Prueba manual"), commit y push.

## Bug corregido: pedia crear la contrasena dos veces

Causa: quien entra por `/login` con codigo ANTES de registrarse crea su contrasena ahi, pero el
backend solo puede anotar "ya tiene contrasena" (`usuarios.contrasena_configurada`) cuando existe
su fila en `usuarios`. Sin fila, `POST /api/auth/confirmar-contrasena` no hace nada, y el error se
tragaba en silencio. Despues el dashboard lo mandaba a `/registro` (estado `sin-perfil`), que le
volvia a pedir una contrasena.

Arreglo (solo front, el backend no cambio):

- La marca `password_set: true` se guarda en `user_metadata` de Supabase en el mismo `updateUser`
  que crea la contrasena (`src/lib/password-status.ts`). Nace junto con la contrasena y no depende
  de que exista el perfil.
- `/login`, tras verificar el codigo: si la cuenta ya tiene la marca, no pide crear contrasena.
- `/registro`, tras crear el perfil: si ya tiene la marca, entra directo; si no, pide la contrasena
  como antes.
- `confirmarContrasenaEnBackend()` reintenta una vez y avisa por consola si falla (antes el error
  desaparecia sin rastro).
- Si alguien entra por el enlace manual "¿Ya tienes contrasena?" y logra iniciar sesion, se corrige
  la marca del backend para que el siguiente ingreso vaya directo al paso de contrasena.
- `user_metadata` lo puede editar la propia persona: es solo una pista de interfaz para saltarse un
  paso, nunca se usa para autorizar nada.

## Otros bugs silenciosos corregidos

- `src/store/auth-store.ts`: cada refresco de token de la misma cuenta reemplazaba el nombre y las
  iniciales reales (de `/api/usuarios/me`) por los derivados del correo. Ahora solo actualiza el rol.
- `src/lib/last-section.ts`: restauraba cualquier ruta guardada, incluso de secciones eliminadas
  (Informes, Calendario) -> 404 al iniciar sesion. Ahora valida contra `NAV`.
- `src/app/login/page.tsx`: la deteccion automatica de cuenta recurrente podia arrebatar a la
  persona de un paso que ya habia avanzado (por ejemplo, el del codigo) si la respuesta llegaba tarde.
- `.gitignore`: se agrego `.claude/settings.local.json` (archivo local, no debe versionarse).

## Archivos tocados

- Nuevos: `src/lib/password-status.ts`, `src/lib/password-status.test.ts`, `src/lib/last-section.test.ts`,
  este archivo.
- Modificados: `src/app/login/page.tsx`, `src/app/registro/page.tsx`, `src/store/auth-store.ts`,
  `src/store/auth-store.test.ts`, `src/lib/last-section.ts`, `docs/CONTEXTO-PROYECTO.md`, `CLAUDE.md`,
  `.gitignore`.

## Prueba manual recomendada (todavia no hecha)

1. Invitado nuevo que entra por `/login`: correo -> codigo -> crea contrasena -> `/registro` pide solo
   nombre y apellido y entra, sin volver a pedir contrasena.
2. Invitado que llega directo a `/registro` desde el correo: nombre y apellido -> crea contrasena -> entra.
3. Cerrar sesion y volver a entrar con ese correo: debe ir directo al paso de contrasena.
4. Cuenta antigua con contrasena pero sin marca: "¿Ya tienes contrasena?" -> inicia sesion -> cerrar
   sesion -> el siguiente ingreso va directo a contrasena.
5. Dejar la pestana abierta o cambiar de pestana y volver (refresca el token): el nombre de la
   cabecera no cambia.

## Limitaciones conocidas y pendientes

- Cuentas creadas antes de este cambio no tienen `password_set`; dependen de `contrasena_configurada`
  del backend (se autocorrige con el enlace manual, ver arriba).
- Si alguien recarga `/registro` entre el paso de perfil y el de contrasena, el perfil ya existe y
  entra al dashboard sin contrasena; la proxima vez usara codigo y se le pedira crearla. Posible
  mejora: un guard de "perfil completo sin contrasena".
- Recargar `/login` justo despues de verificar el codigo hace que `proxy.ts` lo mande al dashboard
  sin pasar por crear contrasena (mismo efecto que el punto anterior).
- `login/page.tsx` llama `signInWithOtp` sin `shouldCreateUser: false`: cualquier correo de un
  dominio permitido crea una cuenta en Supabase aunque no este invitado (queda en "sin invitacion").
  Antes de cambiarlo, confirmar como se crean las cuentas invitadas.
- `supabase-proxy.ts` (`DEFAULT_AUTHENTICATED_PATH = /proveedores`) y `last-section.ts` (por defecto
  `/clientes`) no coinciden. Menor.
- Las pruebas end-to-end (Playwright, `e2e/`) no se corrieron en esta sesion.
- `next build` NO se pudo verificar: se colgo en el entorno virtual de la sesion y se cancelo. Correr
  `npm run build` en Windows antes de subir.

## Notas de entorno

- El `node_modules` de este repo es de Windows (binarios `win32`): Vitest/Next no corren desde Linux/WSL
  sin reinstalar. En esta sesion se verifico en una copia temporal en `/tmp` con `npm ci`.
- En Windows: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## Como retomar con Claude

Decir: "Lee `docs/ESTADO-ACTUAL.md` y sigue con los pendientes". `CLAUDE.md` ya importa este archivo
y `CONTEXTO-PROYECTO.md`, asi que Claude los carga solo.
