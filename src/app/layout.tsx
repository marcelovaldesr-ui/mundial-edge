import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Disclaimer } from "@/components/disclaimer";

export const metadata: Metadata = {
  title: "Mundial Edge — Análisis probabilístico del Mundial 2026",
  description:
    "Plataforma de análisis estadístico: probabilidades del modelo vs. cuotas, edge y valor esperado. Herramienta probabilística, no garantiza resultados.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body>
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-6">
          {children}
        </main>
        <footer className="mx-auto max-w-6xl px-4 pb-10">
          <Disclaimer compact />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Mundial Edge · Proyecto de análisis. Las cuotas y probabilidades son
            estimaciones. Juega con responsabilidad. +18.
          </p>
        </footer>
      </body>
    </html>
  );
}
