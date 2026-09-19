import { Suspense } from "react";
import { AcessoForm } from "./AcessoForm";

export const dynamic = "force-dynamic";

export default function AcessoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>}>
      <AcessoForm />
    </Suspense>
  );
}
