import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth";
import { AppShell } from "@/components/layout/AppShell";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { GlobalShortcuts } from "@/components/layout/GlobalShortcuts";
import { listExpedicoesComAgregados, getContagemAlertas } from "@/lib/data/expedicoes";
import { listFornecedores } from "@/lib/data/fornecedores";
import { contarInscricoesPendentes } from "./inscricoes/actions";
import { mockPassageiros } from "@/lib/mock-data";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import type { PassageiroRow } from "@/types/database";

async function listAllPassageiros(): Promise<PassageiroRow[]> {
  if (DEV_USE_MOCK_DATA) return mockPassageiros;
  const supabase = await getServerClient();
  const { data } = await supabase.from("passageiros").select("*").limit(200);
  return (data ?? []) as PassageiroRow[];
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // 1º acesso: conta com senha provisória precisa definir a própria senha antes de usar.
  if (user.senha_provisoria) redirect("/primeiro-acesso");

  const [expedicoes, fornecedores, passageiros, alertas, inscricoesPendentes] = await Promise.all([
    listExpedicoesComAgregados(),
    listFornecedores(),
    listAllPassageiros(),
    getContagemAlertas(),
    contarInscricoesPendentes(),
  ]);

  return (
    <AppShell user={user} alertCount={alertas.total} inscricoesCount={inscricoesPendentes}>
      {children}
      <CommandPalette
        expedicoes={expedicoes}
        passageiros={passageiros}
        fornecedores={fornecedores}
      />
      <GlobalShortcuts />
    </AppShell>
  );
}
