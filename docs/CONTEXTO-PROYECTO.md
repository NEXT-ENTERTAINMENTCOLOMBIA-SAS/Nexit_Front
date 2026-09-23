# Contexto del proyecto -- Nexit Front

> Documento vivo: estado real y verificado del frontend, no bitacora de
> avance. Si algo aqui deja de ser cierto, se corrige en el mismo cambio
> que lo vuelve falso. Para pasos de instalacion, variables de entorno y
> comandos, el `README.md` de este repo ya esta completo y actualizado --
> este archivo es el complemento: como encaja el front con el resto del
> sistema (backend, roles, despliegue).
>
> Ultima verificacion: 2026-09-23.

## Que es

Frontend de Nexit (gestion de clientes, proveedores y proyectos), Next.js 16
(App Router) + TypeScript + Tailwind CSS. Consume la API real de
`Nexit_Back` (.NET 8) via `src/lib/api-client.ts`. Usa Supabase Auth
directo desde el navegador (`src/lib/supabase-client.ts`, `@supabase/ssr`)
**solo** para login con codigo OTP y recuperar contrasena -- todo lo demas
(clientes, proveedores, proyectos, usuarios, catalogos, adjuntos, informes)
pasa siempre por la API del backend, nunca directo a Supabase.

`src/proxy.ts` (el equivalente actual de `middleware.ts` en Next.js 16)
valida la sesion del lado del servidor antes de servir cualquier ruta
protegida.

## Despliegue

Vercel, sin configuracion adicional mas alla de las 3 variables de entorno
(ver README: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`). En produccion `NEXT_PUBLIC_API_BASE_URL`
apunta al backend en Railway.

## Como encaja con el backend

- El JWT lo emite Supabase Auth; el backend (`Nexit_Back`) lo valida y
  expone los roles de negocio (`super_admin`/`admin`/`manager`/`miembro`,
  ver `Nexit_Back/docs/CONTEXTO-PROYECTO.md`) como claims.
- El front consulta y filtra UI segun esos roles, pero la autorizacion real
  vive en el backend (politicas de ASP.NET) -- el front no es la ultima
  linea de defensa para nada sensible.
- Los stores en `src/store/` (Zustand) reflejan cada dominio (clientes,
  proveedores, proyectos, catalogos, auth, UI) y son el punto central de
  estado del lado del cliente.

## Estructura

- `src/app/` -- rutas (App Router); `(dashboard)/` agrupa las paginas
  protegidas (clientes, proveedores, proyectos, usuarios, calendario,
  informe, configuracion). `login/`, `registro/` son publicas.
- `src/components/ui/` -- componentes de UI reutilizables.
- `src/services/api/` -- llamadas a la API del backend.
- `src/store/` -- estado global (Zustand), uno por dominio.
- `src/lib/` -- clientes de API/Supabase, utilidades transversales.
- `src/proxy.ts` -- validacion de sesion server-side por ruta.

## CI

`.github/workflows/ci.yml`: lint, chequeo de tipos (`tsc --noEmit`),
auditoria de dependencias, pruebas unitarias (Vitest), build de produccion
y pruebas end-to-end (Playwright) en cada push/PR a `main`.

## Sobre AGENTS.md de este repo

El bloque marcado `nextjs-agent-rules` en `AGENTS.md` lo genera y
re-escribe automaticamente `next dev` (viene de
`node_modules/next/dist/server/lib/generate-agent-files.js`) -- no editarlo
a mano, se vuelve a poner solo. `CLAUDE.md` importa tanto ese archivo como
este.

## Pendiente conocido

- `docs/superpowers/plans/` y `docs/superpowers/specs/` son documentos de
  diseno/planificacion puntual (por ejemplo el sistema visual), no una
  bitacora general del proyecto ni el estado actual -- no asumir que estan
  vigentes sin revisar.
