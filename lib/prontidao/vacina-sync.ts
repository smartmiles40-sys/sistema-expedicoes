/**
 * Vacina é UNIVERSAL da pessoa: o Certificado de Febre Amarela (arquivo + validade +
 * aprovação) vale para TODAS as expedições dela. O requisito "Vacina", porém, é uma
 * instância POR expedição (`passageiro_requisitos`), porque um destino pode DISPENSAR
 * a vacina.
 *
 * Este módulo concilia os dois espalhando o estado da vacina da pessoa (por CPF) para o
 * slot "Vacina" de TODAS as linhas dela:
 *  - "Dispensado" é decisão POR DESTINO (não exige ali) → NUNCA é tocado nem propagado.
 *  - Modo HERANÇA (`sobrescrever:false`): só preenche slot ainda sem arquivo (ex.: nova
 *    expedição recém-semeada herda o certificado/validade/aprovação da pessoa).
 *  - Modo ESPELHO (`sobrescrever:true`): mexeu numa, vale em todas (anexar/aprovar/definir
 *    validade numa expedição reflete nas demais).
 */
import { formatarCpf } from "@/lib/cpf";

// Aceita o client de service-role (admin) ou o de sessão (ssr) — ambos com schema
// não-tipado aqui; a query é simples e validada em runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any;

const STATUS_VERIFICAVEIS = new Set(["Aprovado", "Reprovado", "Dispensado"]);

type ReqVacina = { id: string; arquivo_id: string | null; status: string; validade: string | null };

/** Linhas (ids) e slots "Vacina" de uma pessoa, casando o CPF nas duas formas gravadas. */
async function vacinaDaPessoa(sb: Cliente, cpf: string | null | undefined): Promise<ReqVacina[]> {
  const digitos = (cpf ?? "").replace(/\D/g, "");
  if (digitos.length !== 11) return [];
  // A coluna `cpf` é gravada ora como dígitos, ora formatada (000.000.000-00).
  const variantes = [...new Set([digitos, formatarCpf(digitos)])];
  const { data: pxs } = await sb.from("passageiros").select("id").in("cpf", variantes);
  const ids = ((pxs ?? []) as { id: string }[]).map((p) => p.id);
  if (!ids.length) return [];
  const { data } = await sb
    .from("passageiro_requisitos")
    .select("id, arquivo_id, status, validade")
    .in("passageiro_id", ids)
    .eq("tipo", "Vacina");
  return (data ?? []) as ReqVacina[];
}

/**
 * Propaga o estado da vacina (arquivo/status/validade) para as linhas da pessoa.
 * `patch` traz só os campos a espelhar. "Dispensado" nunca é propagado nem sobrescrito.
 */
export async function propagarVacinaPessoa(
  sb: Cliente,
  cpf: string | null | undefined,
  patch: { arquivo_id?: string | null; status?: string; validade?: string | null },
  opts: { sobrescrever: boolean },
): Promise<{ atualizados: number }> {
  const reqs = await vacinaDaPessoa(sb, cpf);
  if (!reqs.length) return { atualizados: 0 };
  const propagaStatus = "status" in patch && patch.status !== "Dispensado"; // Dispensado é por-destino
  let atualizados = 0;
  for (const r of reqs) {
    if (r.status === "Dispensado") continue; // respeita "não exige aqui"
    if (!opts.sobrescrever && r.arquivo_id) continue; // herança: só slot vazio
    const upd: Record<string, unknown> = {};
    if ("arquivo_id" in patch) upd.arquivo_id = patch.arquivo_id;
    if ("validade" in patch) upd.validade = patch.validade;
    if (propagaStatus) {
      upd.status = patch.status;
      if (STATUS_VERIFICAVEIS.has(patch.status as string)) upd.verificado_em = new Date().toISOString();
    }
    if (Object.keys(upd).length === 0) continue;
    const { error } = await sb.from("passageiro_requisitos").update(upd).eq("id", r.id);
    if (!error) atualizados++;
  }
  return { atualizados };
}

/**
 * HERANÇA: preenche os slots "Vacina" VAZIOS da pessoa com o estado canônico dela
 * (certificado + validade + aprovação). Usado após semear requisitos de uma nova
 * expedição / incluir passageiro. Nunca sobrescreve decisão já tomada.
 */
export async function espalharCertificadoVacina(
  sb: Cliente,
  cpf: string | null | undefined,
  certIdPreferido?: string | null,
): Promise<{ atualizados: number; certId: string | null }> {
  const reqs = await vacinaDaPessoa(sb, cpf);
  if (!reqs.length) return { atualizados: 0, certId: null };

  // Certificado canônico: o preferido (recém-anexado), senão o de qualquer slot, senão o
  // arquivo solto "Febre Amarela" vinculado a alguma linha dela.
  let certId = certIdPreferido ?? reqs.find((r) => r.arquivo_id)?.arquivo_id ?? null;
  if (!certId) {
    const digitos = (cpf ?? "").replace(/\D/g, "");
    const variantes = [...new Set([digitos, formatarCpf(digitos)])];
    const { data: pxs } = await sb.from("passageiros").select("id").in("cpf", variantes);
    const ids = ((pxs ?? []) as { id: string }[]).map((p) => p.id);
    if (ids.length) {
      const { data: arqs } = await sb
        .from("arquivos")
        .select("id")
        .in("passageiro_id", ids)
        .ilike("descricao", "%Febre Amarela%")
        .limit(1);
      certId = ((arqs ?? []) as { id: string }[])[0]?.id ?? null;
    }
  }
  if (!certId) return { atualizados: 0, certId: null };

  // Validade canônica: a mais recente não-nula. Status canônico: Aprovado se já houver
  // um slot Aprovado; senão Enviado (tem certificado, aguardando verificação).
  const validade = reqs.map((r) => r.validade).filter((v): v is string => !!v).sort().at(-1) ?? null;
  const status = reqs.some((r) => r.status === "Aprovado") ? "Aprovado" : "Enviado";
  const { atualizados } = await propagarVacinaPessoa(
    sb, cpf, { arquivo_id: certId, status, validade }, { sobrescrever: false },
  );
  return { atualizados, certId };
}
