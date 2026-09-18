"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Calcula cuántas columnas debe tener una grilla de tarjetas para que
 * SIEMPRE llenen el ancho disponible del contenedor, sin franja vacía a la
 * derecha ni columnas más angostas que `min` (Alicia, Proveedores
 * 2026-09-08: "cuando [el riel] no está desplegado, [las tarjetas] se
 * quedan chiquitas... tienen que alargarse un poco para ocupar bien el
 * espacio").
 *
 * Antes se usaba `grid-template-columns: repeat(auto-fill, minmax(240px,
 * 300px))` (ver dashboard.module.css): con un MÁXIMO fijo en px, el
 * número de columnas queda decidido por ese máximo, pero una vez fijo el
 * número de columnas cada una deja de crecer al llegar a 300px aunque
 * sobre espacio -- y ese sobrante nunca se reparte, queda como una franja
 * vacía. No existe un valor fijo de "máximo" que evite esto en todos los
 * anchos posibles (se probó 300/320/340/360/380px por Playwright: siempre
 * hay algún ancho de pantalla, con el riel expandido o colapsado, donde
 * sobra una franja notable). La solución real es calcular cuántas
 * columnas caben (entre `min` y `max` de ancho cada una) y ponerlas en
 * `1fr`, para que el navegador reparta TODO el ancho sobrante entre las
 * columnas que ya existen en vez de dejarlo sin usar.
 */
// Alicia 2026-09-08 (Clientes): "cuando yo inicio me aparece una tarjeta
// supergrande, larga, pero cuando vuelvo a proveedores se vuelve a
// convertir". Causa real: `columns` arranca en 1 (una sola columna, o sea
// tarjetas de ancho completo) y antes se recalculaba en un `useEffect`
// normal, que corre DESPUÉS de que el navegador ya pintó esa primera
// versión con 1 columna. En Proveedores (lista corta) ese parpadeo casi no
// se nota; en Clientes (200+ filas, la grilla ocupa mucha más pantalla) se
// veía clarísimo como "una tarjeta gigante" al entrar a la página, antes de
// que se acomodara sola. `useLayoutEffect` calcula las columnas reales
// ANTES de pintar, así que ese parpadeo desaparece en las dos páginas.
// (En el servidor no existe layout que medir, así que ahí se usa
// `useEffect` normal para no disparar la advertencia de React sobre
// useLayoutEffect en SSR.)
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Alicia 2026-09-18 (Clientes/Proveedores/Proyectos, "se ven en un rectángulon feo al
// entrar por primera vez"): el `useLayoutEffect` de arriba ya evita el parpadeo de UNA
// tarjeta gigante en la mayoría de los casos, pero no cubre uno: si la primerísima
// medición (`el.clientWidth`, justo al montar el contenedor, recién llegando del login)
// da 0 -- el contenedor real ya tiene ancho, pero el navegador todavía no terminó de
// asentar el layout de todo lo que está montando a la vez alrededor (rail, KPIs, fuente
// web cargando) -- `compute()` se salía sin llamar `setColumns`, así que `columns` se
// quedaba pegado en su valor inicial (1) para siempre: sin una llamada a `setColumns` no
// hay un nuevo render que dispare este efecto otra vez, y `ResizeObserver` únicamente
// avisa de cambios FUTUROS de tamaño, no corrige una lectura inicial ya equivocada si el
// contenedor no vuelve a cambiar de ancho después. Por eso se arreglaba solo con volver a
// entrar a la página (un montaje nuevo, con todo ya asentado, medía bien la primera vez).
// Ahora, si esa primera lectura da 0, se reintenta en el siguiente frame
// (`requestAnimationFrame`) en vez de darse por vencido -- normalmente alcanza con un
// reintento porque para ese momento el layout ya está asentado.
function computeColumns(width: number, min: number, max: number, gap: number): number {
  const byMax = Math.ceil((width + gap) / (max + gap));
  const byMin = Math.floor((width + gap) / (min + gap));
  return Math.max(1, Math.min(byMax, byMin || 1));
}

export function useGridColumns(min = 240, max = 300, gap = 12) {
  const ref = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    let cancelled = false;
    let retryFrame = 0;

    function measure(width: number, attemptsLeft: number) {
      if (cancelled) return;
      if (width > 0) {
        setColumns(computeColumns(width, min, max, gap));
        return;
      }
      // Ancho todavía en 0 -- el contenedor existe pero el navegador no asentó su layout
      // real todavía (típico justo después de entrar desde /login). Se reintenta un par de
      // frames en vez de quedarse pegado en la columna única de siempre.
      if (attemptsLeft <= 0 || !el) return;
      retryFrame = requestAnimationFrame(() => measure(el.clientWidth, attemptsLeft - 1));
    }

    measure(el.clientWidth, 5);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) measure(entry.contentRect.width, 5);
    });
    observer.observe(el);
    return () => {
      cancelled = true;
      if (retryFrame) cancelAnimationFrame(retryFrame);
      observer.disconnect();
    };
  }, [min, max, gap]);

  return { ref, columns };
}
