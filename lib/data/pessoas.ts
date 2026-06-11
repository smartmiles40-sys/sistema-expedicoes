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
  /** Expedições distintas em que a pessoa está/esteve (exclui Cancelado). */
  totalExpedicoes: number;
  expedicoes: ExpedicaoDoPassageiro[];
  totalContratadoBrl: number;
  totalPagoBrl: number;
};

/** Identidade da pessoa: CPF (só dígitos) → Bitrix → e-mail → nome. */
function chaveIdentidade(p: PassageiroRow): string {
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
        totalExpedicoes: 0,
        expedicoes: [],
        totalContratadoBrl: 0,
        totalPagoBrl: 0,
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
    }

    pessoa.totalContratadoBrl += p.valor_contratado_brl;
    pessoa.totalPagoBrl += p.valor_pago_brl;

    const exp = expById.get(p.expedicao_id);
    if (exp) {
      pessoa.expedicoes.push({
        expedicao_id: exp.id,
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
