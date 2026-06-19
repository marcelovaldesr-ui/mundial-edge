import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BarChart3, BrainCircuit, Database, Grid3X3, ShieldCheck, SlidersHorizontal, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Metodología — Mundial Edge",
  description: "Cómo Mundial Edge transforma ratings, goles esperados y simulaciones de marcadores en probabilidades verificables.",
};

const pipeline = [
  { number: "01", title: "Ratings de selecciones", icon: Trophy, text: "Medimos fuerza de ataque y defensa con historia mundialista y rendimiento reciente. Es parecido a un ranking de ajedrez, pero separa la capacidad de marcar y de evitar goles." },
  { number: "02", title: "Goles esperados", icon: BrainCircuit, text: "Enfrentamos el ataque de una selección con la defensa de la otra. La estimación se ajusta por forma disponible y por lo que cada equipo necesita en su grupo." },
  { number: "03", title: "Marcadores posibles", icon: Grid3X3, text: "Una distribución de Poisson asigna probabilidad a 0-0, 1-0, 1-1, 2-1 y al resto de resultados. No elegimos un marcador único: conservamos todo el abanico." },
  { number: "04", title: "Mercados", icon: BarChart3, text: "Sumamos las casillas correspondientes para obtener victoria, empate, Over 2.5, ambos marcan y otros mercados. Todos salen de una misma matriz coherente." },
  { number: "05", title: "Calibración", icon: SlidersHorizontal, text: "Repetimos el proceso como si estuviéramos antes de cada partido de los últimos siete Mundiales. El ajuste final reduce sesgos sin mirar el resultado futuro." },
];

export default function MethodologyPage() {
  return (
    <div className="space-y-9">
      <section className="rounded-xl border bg-card/70 p-6 sm:p-8">
        <div className="max-w-3xl space-y-3">
          <div className="flex flex-wrap gap-2"><Badge variant="outline">Metodología abierta</Badge><Badge variant="muted">Lectura: 6 minutos</Badge></div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Cómo piensa Mundial Edge</h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            El modelo no “sabe” quién ganará. Construye una estimación probabilística trazable: empieza con la fuerza de los equipos, imagina todos los marcadores razonables y comprueba sus probabilidades contra partidos que ya ocurrieron.
          </p>
        </div>
      </section>

      <section aria-labelledby="pipeline-title" className="space-y-5">
        <Heading eyebrow="El proceso" title="De datos históricos a una probabilidad" id="pipeline-title" />
        <div className="relative grid gap-3 lg:grid-cols-5">
          <div aria-hidden className="absolute left-[10%] right-[10%] top-10 hidden border-t border-dashed border-primary/40 lg:block" />
          {pipeline.map((step) => {
            const Icon = step.icon;
            return (
              <Card key={step.number} className="relative bg-card/95">
                <CardContent className="p-4">
                  <div className="mb-4 flex items-center justify-between"><span className="font-mono text-xs text-primary">{step.number}</span><span className="rounded-full border bg-background p-2"><Icon className="h-4 w-4 text-primary" /></span></div>
                  <h2 className="font-semibold">{step.title}</h2>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.text}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="evidence-title" className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle id="evidence-title" className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-success" /> ¿Cómo sabemos que funciona?</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>Simulamos qué habría predicho el modelo antes de cada uno de los 448 partidos jugados entre Francia 1998 y Qatar 2022. En cada paso sólo usamos información disponible hasta ese momento.</p>
            <p>El <strong className="text-foreground">Brier Score</strong> mide la distancia entre las probabilidades anunciadas y lo que ocurrió. Cero sería perfecto. El modelo obtuvo aproximadamente <strong className="text-foreground">0,592</strong>, frente a <strong className="text-foreground">0,667</strong> de repartir 33,3% a cada resultado.</p>
            <p>También publicamos Log Loss, RPS, acierto por Mundial y diagramas de fiabilidad. Así se puede detectar un modelo que acierta algunos partidos por suerte, pero expresa mal su incertidumbre.</p>
            <Link href="/transparencia" className="inline-flex items-center gap-2 font-semibold text-primary hover:underline">Ver todas las métricas públicas <BarChart3 className="h-4 w-4" /></Link>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader><CardTitle className="text-base">Una lectura sencilla</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-4xl font-bold tabular-nums">11,2%</p>
            <p className="text-muted-foreground">menos error Brier que un modelo sin información que asigna la misma probabilidad a local, empate y visitante.</p>
            <p className="border-t pt-4 text-xs text-muted-foreground">Esto demuestra valor predictivo histórico; no garantiza resultados futuros ni rentabilidad.</p>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="limits-title" className="space-y-4">
        <Heading eyebrow="Honestidad metodológica" title="Limitaciones reconocidas" id="limits-title" />
        <div className="grid gap-3 md:grid-cols-3">
          <Limit title="Pocos partidos" text="Un Mundial tiene sólo 64 partidos y ocurre cada cuatro años. Siete ediciones siguen siendo una muestra limitada." />
          <Limit title="El fútbol contiene azar" text="Lesiones tardías, expulsiones, arbitraje, clima y decisiones tácticas pueden cambiar un partido y no siempre llegan al modelo." />
          <Limit title="El historial pesa al inicio" text="En las primeras jornadas hay poca evidencia del torneo actual. La forma observada gana peso conforme se juegan partidos." />
        </div>
      </section>

      <section aria-labelledby="sources-title" className="space-y-4">
        <Heading eyebrow="Trazabilidad" title="Fuentes de datos" id="sources-title" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Source title="OpenFootball worldcup.json" text="Resultados históricos 1998–2022 bajo licencia CC0, fijados a una versión y normalizados localmente." />
          <Source title="World Football Elo Ratings" text="Snapshots pre-torneo usados de forma conservadora: 10% Elo externo y 90% perfil histórico Mundial Edge." />
          <Source title="Football Data API" text="Fixtures, resultados y estadísticas operativas para el Mundial 2026." />
          <Source title="Datos Mundial Edge" text="Perfiles de ataque y defensa, contexto de grupos y transformaciones documentadas del modelo." />
        </div>
      </section>

      <section className="rounded-xl border border-dashed p-6 text-center">
        <p className="text-lg font-semibold">La transparencia también incluye lo incómodo</p>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">Publicamos torneos donde el modelo rindió peor, bins alejados de la calibración ideal y mercados aún imperfectos. Una métrica útil debe poder contradecirnos.</p>
        <Link href="/transparencia" className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Abrir Dashboard de Transparencia</Link>
      </section>
    </div>
  );
}

function Heading({ eyebrow, title, id }: { eyebrow: string; title: string; id: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p><h2 id={id} className="mt-1 text-2xl font-bold">{title}</h2></div>;
}

function Limit({ title, text }: { title: string; text: string }) {
  return <Card><CardContent className="p-4"><AlertTriangle className="mb-3 h-5 w-5 text-warning" /><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p></CardContent></Card>;
}

function Source({ title, text }: { title: string; text: string }) {
  return <div className="flex gap-3 rounded-lg border bg-card p-4"><Database className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{text}</p></div></div>;
}
