// Detección de fase de eliminación directa (knockout) a partir del campo
// `stage` del partido. Se usa para penalizar varianza extra (P1.5) y para
// el mercado "Clasifica" (P0.3). Excluye explícitamente la fase de grupos.
export function isKnockoutStage(stage?: string | null): boolean {
  if (!stage) return false;
  const s = stage.toLowerCase();
  if (s.includes("group") || s.includes("grupo")) return false;
  return /round of 16|round of 32|octavos|cuartos|quarter|semi|final/.test(s);
}
