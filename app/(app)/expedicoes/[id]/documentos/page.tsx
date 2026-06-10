import { listPassageiros, listDocumentos, getExpedicao } from "@/lib/data/expedicoes";
import { listArquivosExpedicao } from "@/lib/data/arquivos";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Drive } from "@/components/arquivos/Drive";
import { formatDate, daysUntil, cn } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function DocumentosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pax, docs, expedicao, arquivos] = await Promise.all([
    listPassageiros(id),
    listDocumentos(id),
    getExpedicao(id),
    listArquivosExpedicao(id),
  ]);
  if (!expedicao) notFound();

  const arquivosExpedicao = arquivos.filter((a) => a.passageiro_id === null);

  const docsByPax = new Map(docs.map((d) => [d.passageiro_id, d]));
  const embarqueDias = daysUntil(expedicao.data_embarque) ?? 0;

  function statusGeral(p: typeof pax[number]): "OK" | "Pendente" | "Crítico" {
    const d = docsByPax.get(p.id);
    if (!p.passaporte) return "Crítico";
    const validade = daysUntil(p.validade_passaporte);
    if (validade != null && validade - embarqueDias < 180) return "Crítico";
    if (d?.seguro_status !== "Emitido") return "Pendente";
    if (d?.visto_necessario && d?.status_visto !== "Aprovado") return "Pendente";
    return "OK";
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Drive da expedição</CardTitle>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Arquivos compartilhados (não vinculados a um passageiro). Pra anexar algo de um pax específico, abre o perfil dele em Passageiros.
          </p>
        </CardHeader>
        <CardContent>
          <Drive expedicaoId={id} arquivos={arquivosExpedicao} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Status de documentos por passageiro</h2>
          <p className="text-xs text-muted-foreground">{pax.length} passageiros</p>
        </div>
      </div>

      <div className="rounded-md border border-border overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full table-dense">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <Th>Pax</Th>
                <Th>Passaporte</Th>
                <Th>Validade</Th>
                <Th>Visto</Th>
                <Th>Status Visto</Th>
                <Th>Seguro</Th>
                <Th>Apólice</Th>
                <Th>Voos nac.</Th>
                <Th>Status geral</Th>
              </tr>
            </thead>
            <tbody>
              {pax.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-muted-foreground py-8">
                    Sem passageiros nessa expedição.
                  </td>
                </tr>
              ) : (
                pax.map((p) => {
                  const d = docsByPax.get(p.id);
                  const validadeDias = daysUntil(p.validade_passaporte);
                  const validadeAlerta = validadeDias != null && validadeDias - embarqueDias < 180;
                  const sg = statusGeral(p);
                  return (
                    <tr key={p.id} className="border-b border-border hover:bg-accent/30">
                      <td className="px-2.5 font-medium">{p.nome_completo}</td>
                      <td className="px-2.5 tabular-nums font-mono text-[12px]">
                        {p.passaporte ?? <span className="text-critico-600">Falta</span>}
                      </td>
                      <td className={cn("px-2.5 tabular-nums", validadeAlerta && "text-critico-600 font-medium")}>
                        {p.validade_passaporte ? formatDate(p.validade_passaporte) : "—"}
                      </td>
                      <td className="px-2.5">
                        {d?.visto_necessario ? <Badge variant="atencao">Sim</Badge> : <Badge variant="auto">Não</Badge>}
                      </td>
                      <td className="px-2.5 text-muted-foreground">{d?.status_visto ?? "—"}</td>
                      <td className="px-2.5">
                        <Badge variant={d?.seguro_status === "Emitido" ? "vinculado" : d?.seguro_status === "Solicitado" ? "atencao" : "auto"}>
                          {d?.seguro_status ?? "—"}
                        </Badge>
                      </td>
                      <td className="px-2.5">
                        {d?.apolice_url ? (
                          <a href={d.apolice_url} target="_blank" rel="noreferrer" className="text-editavel-600 hover:underline text-[12px]">
                            Ver
                          </a>
                        ) : (
                          <a
                            href={`/expedicoes/${id}/passageiros/${p.id}`}
                            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                          >
                            Anexar no perfil
                          </a>
                        )}
                      </td>
                      <td className="px-2.5 text-muted-foreground">
                        {p.voo_nacional_necessario ? "Sim" : "—"}
                      </td>
                      <td className="px-2.5">
                        <Badge variant={sg === "OK" ? "vinculado" : sg === "Pendente" ? "atencao" : "critico"}>
                          {sg}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap px-2.5">
      {children}
    </th>
  );
}
