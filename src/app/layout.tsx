import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "@/styles/globals.css";
import { Toaster } from "@/components/ui/Toaster";

// Archivo (headings/body) + IBM Plex Mono (eyebrow labels, mono data) --
// ported 2026-08-28 from the approved Claude Diseño mockup, replacing the
// previous Nunito-based ("Lovable" era) type system.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
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
