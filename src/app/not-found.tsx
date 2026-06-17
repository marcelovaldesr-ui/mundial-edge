import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Partido no encontrado</h1>
      <p className="text-muted-foreground">El recurso solicitado no existe o fue actualizado.</p>
      <Button asChild><Link href="/">Volver al dashboard</Link></Button>
    </div>
  );
}
