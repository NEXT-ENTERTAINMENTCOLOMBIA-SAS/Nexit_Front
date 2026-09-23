# Nexus · Front

Frontend de Nexus (gestión de clientes, proveedores y proyectos para Next
Marketing Experiencial), construido con **Next.js 16 (App Router) +
TypeScript + Tailwind CSS**.

Consume la API real de **Nexit_Back** (.NET 8) vía `src/lib/api-client.ts`
y usa Supabase Auth directo desde el navegador (`src/lib/supabase-client.ts`,
`@supabase/ssr`) solo para login con código OTP y recuperar contraseña —
todo lo demás (clientes, proveedores, proyectos, usuarios, catálogos,
adjuntos, informes) pasa siempre por la API. `src/proxy.ts` (lo que en
versiones previas de Next.js se llamaba `middleware.ts`) valida la sesión
del lado del servidor antes de servir cualquier ruta protegida.

## Por qué Next.js

- Consume cualquier API HTTP (incluida la Web API en .NET) sin fricción vía
  `fetch`.
- Enrutamiento por archivos (`src/app/...`), fácil de escalar a medida que
  se agregan módulos.
- Se despliega en Vercel con cero configuración adicional.
- Ecosistema muy grande y curva de aprendizaje suave si el equipo crece.

## Cómo correr el proyecto

```bash
npm install
cp .env.example .env.local   # completa las 3 variables, ver abajo
npm run dev
```

Abre `http://localhost:3000`. Necesitas `Nexit_Back` corriendo (ver su
propio README) y un usuario real invitado en Supabase — no hay login de
demo.

```bash
npm run build      # build de producción
npm run lint         # eslint
npx tsc --noEmit     # chequeo de tipos
npm test              # pruebas unitarias (Vitest)
npm run test:e2e      # pruebas de extremo a extremo (Playwright)
```

Estos son exactamente los pasos que corre `.github/workflows/ci.yml` en
cada push/PR a `main`.

## Variables de entorno

| Variable | Dónde se usa | Nota |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `src/lib/api-client.ts`, CSP en `next.config.ts` | URL base de `Nexit_Back`. Local: `http://localhost:5031`. Producción: el dominio del backend en Railway. |
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase-client.ts` | Project URL de Supabase — no es secreta. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase-client.ts` | anon/public key — pensada para exponerse en el navegador. Nunca la Service Role Key acá. |

Las tres se sacan de Supabase Dashboard → Project Settings → API (las dos
últimas) y del dominio real del backend (la primera). En Vercel se
configuran en Project Settings → Environment Variables; en CI ya están
como GitHub Secrets del repo (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` — ver `.github/workflows/ci.yml`).

## Desplegar en Vercel

1. Importa el repo (ya movido a la organización `NEXT-ENTERTAINMENTCOLOMBIA-SAS`)
   en Vercel — detecta Next.js automáticamente, sin configuración extra.
2. Carga las 3 variables de la tabla de arriba en Project Settings →
   Environment Variables, con `NEXT_PUBLIC_API_BASE_URL` apuntando al
   dominio real del backend en Railway.
3. Confirma el dominio custom ya conectado en Vercel.
4. En `Nexit_Back`, agrega ese mismo dominio a `Cors:AllowedOrigins`
   (variable de entorno `Cors__AllowedOrigins__0` en Railway) — si no, el
   navegador bloquea las peticiones a la API aunque el backend responda
   bien.
5. Actualiza el Site URL / Redirect URLs de Supabase Auth al dominio de
   producción (Supabase Dashboard → Authentication → URL Configuration).

## Estructura de carpetas

```
src/
  app/
    login/                      Login (código OTP)
    registro/                   Crear contraseña al aceptar una invitación
    (dashboard)/                 Layout autenticado (header, nav, guard de sesión)
      clientes/                   Grid, filtros, modal, detalle, adjuntos
      proveedores/                 Grid, filtros, modal, detalle, adjuntos
      proyectos/                   Grid, filtros, modal, detalle, adjuntos
      usuarios/                    Directorio, invitar, roles
      calendario/                  Calendario de proyectos por mes/año
      informe/                     Informe semanal/mensual + export a Excel
      configuracion/                Catálogos (ubicaciones, estados, etapas…)
  components/ui/                Librería de componentes compartidos
  services/api/                 Un servicio por recurso, todos sobre api-client.ts
  store/                        Estado global con Zustand (auth, catálogos, clientes, proveedores, proyectos, ui)
  lib/                          api-client, supabase-client/proxy, geo, formato, CSV, informes, jwt…
  proxy.ts                      Verificación de sesión server-side (antes "middleware.ts")
```

## Estado (state management)

Se usa [Zustand](https://github.com/pmndrs/zustand), un store por dominio
(`catalogos-store`, `clientes-store`, `providers-store`, `projects-store`,
`auth-store`, `page-toolbar-store`, `ui-store` para toasts). Cada store
delega la persistencia real en la capa de `services/api/`.

## Diseño

Los tokens de diseño (colores, radios, tipografía) están portados 1:1 del
mockup aprobado (`baseproveedores_Next.html`) en `src/styles/globals.css`,
incluyendo modo oscuro automático (`prefers-color-scheme`). Tailwind v4 los
expone como utilidades (`bg-surface`, `text-text-2`, `bg-teal-light`, etc.)
para mantener consistencia en toda la app.
