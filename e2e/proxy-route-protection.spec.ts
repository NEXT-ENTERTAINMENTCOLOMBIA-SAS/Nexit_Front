import { test, expect } from "@playwright/test";

/**
 * "No quiero que nadie se pueda meter a esta página" -- estas pruebas pegan
 * contra el servidor real (sin iniciar sesión) y confirman que src/proxy.ts
 * de verdad bloquea. Antes esto se verificó a mano con curl al escribir el
 * proxy; acá queda como prueba repetible.
 */

const RUTAS_PROTEGIDAS = ["/proveedores", "/clientes", "/calendario", "/project-managers", "/proyectos", "/usuarios", "/"];

for (const ruta of RUTAS_PROTEGIDAS) {
  test(`sin sesión: ${ruta} redirige a /login`, async ({ page }) => {
    const response = await page.goto(ruta);
    expect(new URL(page.url()).pathname).toBe("/login");
    expect(response?.status()).toBeLessThan(400);
  });
}

test("sin sesión: una ruta que no existe también redirige a /login (no expone un 404 antes de filtrar)", async ({ page }) => {
  await page.goto("/esto-no-existe-de-verdad-xyz");
  expect(new URL(page.url()).pathname).toBe("/login");
});

test("/login es accesible sin sesión", async ({ page }) => {
  const response = await page.goto("/login");
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe("/login");
});

test("los activos estáticos (logo) no quedan bloqueados por el proxy", async ({ page }) => {
  const response = await page.goto("/logo.png");
  expect(response?.status()).toBe(200);
});

test("una cookie de sesión falsificada no engaña al proxy -- se trata igual que anónimo", async ({ browser }) => {
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: "sb-access-token",
      value: "esto.no.es.un.jwt.valido",
      domain: "localhost",
      path: "/",
    },
  ]);
  const page = await context.newPage();
  const response = await page.goto("/proveedores");
  expect(response?.status()).toBeLessThan(500); // no debe tumbar el servidor
  expect(new URL(page.url()).pathname).toBe("/login");
  await context.close();
});
