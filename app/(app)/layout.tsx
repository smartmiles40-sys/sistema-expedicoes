import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth";
import { AppShell } from "@/components/layout/AppShell";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { GlobalShortcuts } from "@/components/layout/GlobalShortcuts";
import { listExpedicoesComAgregados } from "@/lib/data/expedicoes";
import { listFornecedores } from "@/lib/data/fornecedores";
import { mockPassageiros } from "@/lib/mock-data";
import { DEV_BYPASS } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import type { PassageiroRow } from "@/types/database";

async function listAllPassageiros(): Promise<PassageiroRow[]> {
  if (DEV_BYPASS) return mockPassageiros;
  const supabase = await getServerClient();
  const { data } = await supabase.from("passageiros").select("*").limit(200);
  return (data ?? []) as PassageiroRow[];
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [expedicoes, fornecedores, passageiros] = await Promise.all([
    listExpedicoesComAgregados(),
    listFornecedores(),
    listAllPassageiros(),
  ]);

  return (
    <AppShell user={user}>
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
