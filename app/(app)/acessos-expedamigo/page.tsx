import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import { mockExpedamigoAcessos, mockExpedicoes, mockPassageiros } from "@/lib/mock-data";
import { soDigitosCpf } from "@/lib/cpf";
import { AcessosTabela, type AcessoLog } from "./AcessosTabela";
import type { ExpedamigoAcessoRow, ExpedicaoRow } from "@/types/database";

export const metadata = { title: "Acessos ExpedAmigo" };

export default async function AcessosExpedamigoPage() {
  let acessos: ExpedamigoAcessoRow[];
  let exps: ExpedicaoRow[];
  let pax: { cpf: string | null; nome_completo: string }[];

  if (DEV_USE_MOCK_DATA) {
    acessos = [...mockExpedamigoAcessos];
    exps = mockExpedicoes;
    pax = mockPassageiros.map((p) => ({ cpf: p.cpf, nome_completo: p.nome_completo }));
  } else {
    const sb = await getServerClient();
    const [{ data: a }, { data: e }, { data: p }] = await Promise.all([
      sb.from("expedamigo_acessos").select("*").order("created_at", { ascending: false }).limit(1000),
      sb.from("expedicoes").select("*"),
      sb.from("passageiros").select("cpf,nome_completo").not("cpf", "is", null),
    ]);
    acessos = (a ?? []) as ExpedamigoAcessoRow[];
    exps = (e ?? []) as ExpedicaoRow[];
    pax = (p ?? []) as { cpf: string | null; nome_completo: string }[];
  }

  const expNome = new Map(exps.map((e) => [e.id, e.nome]));
  const nomePorCpf = new Map<string, string>();
  for (const p of pax) {
    const c = soDigitosCpf(p.cpf ?? "");
    if (c.length === 11 && !nomePorCpf.has(c)) nomePorCpf.set(c, p.nome_completo);
  }

  const rows: AcessoLog[] = acessos
    .slice()
    .sort((x, y) => y.created_at.localeCompare(x.created_at))
    .map((r) => ({
      id: r.id,
      cpf: r.cpf,
      nome: nomePorCpf.get(soDigitosCpf(r.cpf)) ?? null,
      evento: r.evento,
      expedicao_nome: r.expedicao_id ? expNome.get(r.expedicao_id) ?? null : null,
      created_at: r.created_at,
    }));

  return (
    <div className="p-4">
      <AcessosTabela rows={rows} />
    </div>
  );
}
