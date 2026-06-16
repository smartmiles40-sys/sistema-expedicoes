/**
 * Agregação de pessoas (passageiros) entre todas as expedições.
 *
 * Cada `passageiros` é um vínculo pax↔expedição; a mesma pessoa pode aparecer
 * em várias expedições. Aqui consolidamos por identidade — CPF (preferido),
 * depois contato do Bitrix, e-mail e por fim o nome — para mostrar dados
 * pessoais únicos e em quantas expedições a pessoa já participou.
 */
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";
import { mockPassageiros, mockExpedicoes } from "@/lib/mock-data";
import type {
  PassageiroRow,
  ExpedicaoRow,
  StatusReserva,
  TipoPassageiro,
} from "@/types/database";

export type ExpedicaoDoPassageiro = {
  expedicao_id: string;
  /** Linha `passageiros` que vincula esta pessoa a esta expedição. */
  passageiro_id: string;
  nome: string;
  destino: string;
  data_embarque: string;
  status_reserva: StatusReserva;
  tipo: TipoPassageiro;
};

export type PessoaAgregada = {
  chave: string;
  nome_completo: string;
  cpf: string | null;
  passaporte: string | null;
  validade_passaporte: string | null;
  data_nascimento: string | null;
  email: string | null;
  telefone: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_fone: string | null;
  restricoes_alimentares: string | null;
  condicoes_medicas: string | null;
  /** Todas as linhas `passageiros` desta pessoa (todas as expedições). */
  idsPassageiros: string[];
  /** Linha/expedição mais recente — âncora pra anexar novos documentos. */
  expedicaoIdAncora: string | null;
  passageiroIdAncora: string | null;
  /** Expedições distintas em que a pessoa está/esteve (exclui Cancelado). */
  totalExpedicoes: number;
  expedicoes: ExpedicaoDoPassageiro[];
};

/** Identidade da pessoa: CPF (só dígitos) → Bitrix → e-mail → nome. */
export function chaveIdentidade(p: PassageiroRow): string {
  const cpf = p.cpf?.replace(/\D/g, "");
  if (cpf && cpf.length >= 11) return `cpf:${cpf}`;
  if (p.bitrix_contact_id) return `bx:${p.bitrix_contact_id}`;
  if (p.email) return `email:${p.email.trim().toLowerCase()}`;
  return `nome:${p.nome_completo.trim().toLowerCase()}`;
}

/** Mantém o valor mais recente não-nulo (rows ordenadas por created_at asc). */
function maisRecente<T>(atual: T | null, novo: T | null): T | null {
  return novo ?? atual;
}

function agregar(
  passageiros: PassageiroRow[],
  expedicoes: ExpedicaoRow[],
): PessoaAgregada[] {
  const expById = new Map(expedicoes.map((e) => [e.id, e]));
  const ordenados = [...passageiros].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );

  const mapa = new Map<string, PessoaAgregada>();
  for (const p of ordenados) {
    const chave = chaveIdentidade(p);
    let pessoa = mapa.get(chave);
    if (!pessoa) {
      pessoa = {
        chave,
        nome_completo: p.nome_completo,
        cpf: p.cpf,
        passaporte: p.passaporte,
        validade_passaporte: p.validade_passaporte,
        data_nascimento: p.data_nascimento,
        email: p.email,
        telefone: p.telefone,
        contato_emergencia_nome: p.contato_emergencia_nome,
        contato_emergencia_fone: p.contato_emergencia_fone,
        restricoes_alimentares: p.restricoes_alimentares,
        condicoes_medicas: p.condicoes_medicas,
        idsPassageiros: [],
        expedicaoIdAncora: null,
        passageiroIdAncora: null,
        totalExpedicoes: 0,
        expedicoes: [],
      };
      mapa.set(chave, pessoa);
    } else {
      // Enriquhece com o dado mais recente disponível.
      pessoa.nome_completo = p.nome_completo || pessoa.nome_completo;
      pessoa.cpf = maisRecente(pessoa.cpf, p.cpf);
      pessoa.passaporte = maisRecente(pessoa.passaporte, p.passaporte);
      pessoa.validade_passaporte = maisRecente(pessoa.validade_passaporte, p.validade_passaporte);
      pessoa.data_nascimento = maisRecente(pessoa.data_nascimento, p.data_nascimento);
      pessoa.email = maisRecente(pessoa.email, p.email);
      pessoa.telefone = maisRecente(pessoa.telefone, p.telefone);
      pessoa.contato_emergencia_nome = maisRecente(pessoa.contato_emergencia_nome, p.contato_emergencia_nome);
      pessoa.contato_emergencia_fone = maisRecente(pessoa.contato_emergencia_fone, p.contato_emergencia_fone);
      pessoa.restricoes_alimentares = maisRecente(pessoa.restricoes_alimentares, p.restricoes_alimentares);
      pessoa.condicoes_medicas = maisRecente(pessoa.condicoes_medicas, p.condicoes_medicas);
    }

    pessoa.idsPassageiros.push(p.id);

    const exp = expById.get(p.expedicao_id);
    if (exp) {
      pessoa.expedicoes.push({
        expedicao_id: exp.id,
        passageiro_id: p.id,
        nome: exp.nome,
        destino: exp.destino,
        data_embarque: exp.data_embarque,
        status_reserva: p.status_reserva,
        tipo: p.tipo,
      });
    }
  }

  for (const pessoa of mapa.values()) {
    pessoa.expedicoes.sort((a, b) => b.data_embarque.localeCompare(a.data_embarque));
    pessoa.totalExpedicoes = pessoa.expedicoes.filter(
      (e) => e.status_reserva !== "Cancelado",
    ).length;
    // Âncora pra novos documentos: a expedição mais recente da pessoa.
    const ancora = pessoa.expedicoes[0];
    if (ancora) {
      pessoa.expedicaoIdAncora = ancora.expedicao_id;
      pessoa.passageiroIdAncora = ancora.passageiro_id;
    }
  }

  return [...mapa.values()].sort((a, b) =>
    a.nome_completo.localeCompare(b.nome_completo, "pt-BR"),
  );
}

export async function listPessoas(): Promise<PessoaAgregada[]> {
  if (DEV_USE_MOCK_DATA) {
    return agregar(mockPassageiros, mockExpedicoes);
  }
  const supabase = await getServerClient();
  const [{ data: pax }, { data: exps }] = await Promise.all([
    supabase.from("passageiros").select("*"),
    supabase.from("expedicoes").select("*"),
  ]);
  return agregar((pax ?? []) as PassageiroRow[], (exps ?? []) as ExpedicaoRow[]);
}
