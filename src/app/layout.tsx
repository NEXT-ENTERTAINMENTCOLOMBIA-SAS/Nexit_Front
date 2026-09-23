import type { Metadata } from "next";
import localFont from "next/font/local";
import "@/styles/globals.css";
import { Toaster } from "@/components/ui/Toaster";

// Archivo (headings/body) + IBM Plex Mono (eyebrow labels, mono data) --
// ported 2026-08-28 from the approved Claude Diseño mockup, replacing the
// previous Nunito-based ("Lovable" era) type system.
//
// Fuentes guardadas en el repo (src/app/fonts, subset latin, licencia OFL) en vez
// de next/font/google: el build de Vercel fallaba al azar con "Can't resolve
// '@vercel/turbopack-next/internal/font/google/font'" cuando Google Fonts responde
// con URLs sin extensión (bug de Next.js, vercel/next.js#99114). Así el build no
// depende de descargar nada de Google.
const archivo = localFont({
  src: [
    { path: "./fonts/archivo-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/archivo-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/archivo-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/archivo-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-archivo",
  display: "swap",
});

const plexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nexit · Portal interno",
  description: "Gestión de proveedores y proyectos para Next Marketing Experiencial",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${archivo.variable} ${plexMono.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
