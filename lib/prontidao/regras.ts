/**
 * Avaliador de Prontidão para Embarque — a fonte de verdade do semáforo.
 *
 * Mesma lógica da view SQL `vw_prontidao_passageiro` (migration 0010), mas em TS
 * para rodar no modo mock e alimentar a UI. Dado um passageiro + a expedição + as
 * instâncias de requisito, devolve uma checagem por exigência e o status final
 * Apto / Atenção / Bloqueado.
 *
 * Duas fontes por exigência:
 *  - COLUNA  (Passaporte, Pagamento, Contrato, Dados Pessoais): derivada direto
 *    dos campos do passageiro — sempre fresca, sem precisar de instância.
 *  - INSTÂNCIA (Seguro, Visto, Vacina, RG, Aéreo…): lida de `passageiro_requisitos`,
 *    onde o time registra status, validade e evidência.
 */
import { parseISO } from "date-fns";
import { MESES_VALIDADE_PASSAPORTE_PADRAO } from "@/lib/constants";
import { requisitosDoDestino } from "@/lib/prontidao/requisitos-destino";
import type {
  PassageiroRow,
  PassageiroRequisitoRow,
  TipoRequisito,
  Obrigatoriedade,
  Prontidao,
} from "@/types/database";

/** Tipos cuja prontidão é derivada de colunas do passageiro (não viram instância). */
export const REQUISITOS_DE_COLUNA: ReadonlySet<TipoRequisito> = new Set([
  "Passaporte",
  "Contrato",
  "Dados Pessoais",
]);

/**
 * Requisitos que NÃO se aplicam a passageiros do tipo "Líder" (vai a trabalho,
 * não-pagante): contrato, seguro, aéreo internacional e vacina. Ficam como
 * "não necessário" (semáforo N/A) e não geram atenção/bloqueio.
 */
export const DISPENSAVEIS_LIDER: ReadonlySet<TipoRequisito> = new Set([
  "Contrato",
  "Seguro",
  "Aéreo Internacional",
  "Vacina",
]);

/**
 * Requisitos que só são "ok" com o ARQUIVO de evidência anexado — não basta
 * mudar o status. Hoje: a foto do documento pessoal (RG/CNH/passaporte).
 * A prontidão lê `arquivo_id` da instância em passageiro_requisitos.
 */
export const REQUISITOS_COM_ANEXO_OBRIGATORIO: ReadonlySet<TipoRequisito> = new Set([
  "Documento Pessoal",
]);

export type Semaforo = "ok" | "atencao" | "bloqueio" | "na";

export type ChecagemProntidao = {
  tipo: TipoRequisito;
  descricao: string;
  obrigatoriedade: Obrigatoriedade;
  bloqueia_embarque: boolean;
  semaforo: Semaforo;
  detalhe: string;
  /** id da instância em passageiro_requisitos, quando a fonte é instância. */
  requisito_id: string | null;
};

export type ResultadoProntidao = {
  passageiro_id: string;
  prontidao: Prontidao;
  bloqueios: number;
  atencoes: number;
  checagens: ChecagemProntidao[];
};

type ExpedicaoLite = { data_embarque: string; data_retorno: string; status?: string };

function addMonths(iso: string, months: number): Date {
  const d = parseISO(iso);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Compara duas datas ISO; retorna a − b em ms (negativo = a antes de b). */
function antesDe(aIso: string, bIso: string): boolean {
  return parseISO(aIso).getTime() < parseISO(bIso).getTime();
}

/** Reduz uma lista de semáforos ao status final do passageiro. */
function consolidar(checagens: ChecagemProntidao[]): {
  prontidao: Prontidao;
  bloqueios: number;
  atencoes: number;
} {
  const bloqueios = checagens.filter((c) => c.semaforo === "bloqueio").length;
  const atencoes = checagens.filter((c) => c.semaforo === "atencao").length;
  const prontidao: Prontidao =
    bloqueios > 0 ? "Bloqueado" : atencoes > 0 ? "Atenção" : "Apto";
  return { prontidao, bloqueios, atencoes };
}

// --- Checagens derivadas de coluna --------------------------------------------

function checarPassaporte(
  p: PassageiroRow,
  exp: ExpedicaoLite,
  bloqueia: boolean,
): Semaforo {
  if (!p.passaporte || !p.validade_passaporte) return bloqueia ? "bloqueio" : "atencao";
  // Vence antes do retorno → bloqueio.
  if (antesDe(p.validade_passaporte, exp.data_retorno)) return "bloqueio";
  // Válido pro retorno, mas vence dentro da janela de 6 meses → atenção.
  const limite = addMonths(exp.data_retorno, MESES_VALIDADE_PASSAPORTE_PADRAO).toISOString();
  if (antesDe(p.validade_passaporte, limite)) return "atencao";
  return "ok";
}

function checarContrato(p: PassageiroRow, bloqueia: boolean): Semaforo {
  if (p.contrato_assinado) return "ok";
  return bloqueia ? "bloqueio" : "atencao";
}

function checarDadosPessoais(p: PassageiroRow, bloqueia: boolean): Semaforo {
  const completo = Boolean(p.cpf && p.data_nascimento && p.nome_completo);
  if (completo) return "ok";
  return bloqueia ? "bloqueio" : "atencao";
}

function detalheColuna(tipo: TipoRequisito, p: PassageiroRow, sem: Semaforo): string {
  switch (tipo) {
    case "Passaporte":
      if (!p.passaporte || !p.validade_passaporte) return "Sem passaporte cadastrado";
      return sem === "bloqueio"
        ? `Vence em ${p.validade_passaporte.slice(0, 10)} (antes do retorno)`
        : sem === "atencao"
          ? `Vence em ${p.validade_passaporte.slice(0, 10)} — dentro de 6 meses do retorno`
          : `Válido até ${p.validade_passaporte.slice(0, 10)}`;
    case "Contrato":
      return p.contrato_assinado ? "Assinado" : "Contrato não assinado";
    case "Dados Pessoais":
      return sem === "ok" ? "Cadastro completo" : "Faltam dados (CPF/nascimento)";
    default:
      return "";
  }
}

// --- Checagens de instância ---------------------------------------------------

function checarInstancia(
  r: PassageiroRequisitoRow,
  exp: ExpedicaoLite,
): Semaforo {
  const validadeOk = !r.validade || !antesDe(r.validade, exp.data_retorno);
  const resolvido = (r.status === "Aprovado" || r.status === "Dispensado") && validadeOk;
  if (resolvido) return "ok";
  if (r.status === "Vencido" || !validadeOk || r.status === "Reprovado") {
    return r.bloqueia_embarque ? "bloqueio" : "atencao";
  }
  // Pendente / Em análise / Enviado
  if (r.obrigatoriedade === "Recomendado") return "atencao";
  return r.bloqueia_embarque ? "bloqueio" : "atencao";
}

/**
 * Requisito que exige evidência anexada (ex.: foto do documento pessoal):
 * só fica "ok" quando há um arquivo vinculado. Dispensado segue valendo como ok;
 * Reprovado/Vencido derrubam.
 */
function checarDocumentoAnexo(r: PassageiroRequisitoRow): Semaforo {
  if (r.status === "Dispensado") return "ok";
  if (r.status === "Reprovado" || r.status === "Vencido") {
    return r.bloqueia_embarque ? "bloqueio" : "atencao";
  }
  if (r.arquivo_id) return "ok";
  return r.bloqueia_embarque ? "bloqueio" : "atencao";
}

function detalheAnexo(r: PassageiroRequisitoRow | undefined): string {
  if (!r) return "Falta anexar o documento";
  if (r.status === "Dispensado") return "Dispensado";
  if (r.status === "Reprovado") return "Documento reprovado — reenviar";
  if (r.arquivo_id) return "Documento anexado";
  return "Falta anexar o documento";
}

function detalheInstancia(r: PassageiroRequisitoRow | undefined, sem: Semaforo): string {
  if (!r) return "Ainda não iniciado";
  if (sem === "ok") return r.status + (r.validade ? ` (val. ${r.validade.slice(0, 10)})` : "");
  if (r.status === "Vencido") return `Vencido${r.validade ? ` em ${r.validade.slice(0, 10)}` : ""}`;
  return r.status;
}

/**
 * Avalia a prontidão de um passageiro. As colunas (checagens) seguem a ordem do
 * catálogo do destino, então a tabela do painel fica consistente entre pax.
 */
export function avaliarProntidao(params: {
  passageiro: PassageiroRow;
  expedicao: ExpedicaoLite;
  destino: string;
  requisitos: PassageiroRequisitoRow[];
}): ResultadoProntidao {
  const { passageiro, expedicao, destino, requisitos } = params;
  const porTipo = new Map(requisitos.map((r) => [r.tipo, r]));
  const templates = requisitosDoDestino(destino);

  // Expedição concluída: a viagem já aconteceu, então não faz sentido alarmar a
  // prontidão. Todos entram como "Apto" (cada exigência marcada como N/A).
  if (expedicao.status === "Concluída") {
    const checagens: ChecagemProntidao[] = templates.map((t) => ({
      tipo: t.tipo,
      descricao: t.descricao,
      obrigatoriedade: t.obrigatoriedade,
      bloqueia_embarque: t.bloqueia_embarque,
      semaforo: "na" as Semaforo,
      detalhe: "Expedição concluída",
      requisito_id: porTipo.get(t.tipo)?.id ?? null,
    }));
    return { passageiro_id: passageiro.id, prontidao: "Apto", bloqueios: 0, atencoes: 0, checagens };
  }

  const checagens: ChecagemProntidao[] = templates.map((t) => {
    // Líder não precisa de contrato, seguro, aéreo internacional nem vacina.
    if (passageiro.tipo === "Líder" && DISPENSAVEIS_LIDER.has(t.tipo)) {
      return {
        tipo: t.tipo,
        descricao: t.descricao,
        obrigatoriedade: t.obrigatoriedade,
        bloqueia_embarque: t.bloqueia_embarque,
        semaforo: "na" as Semaforo,
        detalhe: "Não necessário (líder)",
        requisito_id: porTipo.get(t.tipo)?.id ?? null,
      };
    }
    if (REQUISITOS_DE_COLUNA.has(t.tipo)) {
      let semaforo: Semaforo;
      switch (t.tipo) {
        case "Passaporte":
          semaforo = checarPassaporte(passageiro, expedicao, t.bloqueia_embarque);
          break;
        case "Contrato":
          semaforo = checarContrato(passageiro, t.bloqueia_embarque);
          break;
        case "Dados Pessoais":
          semaforo = checarDadosPessoais(passageiro, t.bloqueia_embarque);
          break;
        default:
          semaforo = "na";
      }
      return {
        tipo: t.tipo,
        descricao: t.descricao,
        obrigatoriedade: t.obrigatoriedade,
        bloqueia_embarque: t.bloqueia_embarque,
        semaforo,
        detalhe: detalheColuna(t.tipo, passageiro, semaforo),
        requisito_id: null,
      };
    }
    const inst = porTipo.get(t.tipo);
    const exigeAnexo = REQUISITOS_COM_ANEXO_OBRIGATORIO.has(t.tipo);
    const semaforo: Semaforo = inst
      ? exigeAnexo
        ? checarDocumentoAnexo(inst)
        : checarInstancia(inst, expedicao)
      : t.bloqueia_embarque
        ? "bloqueio"
        : "atencao";
    return {
      tipo: t.tipo,
      descricao: inst?.descricao ?? t.descricao,
      obrigatoriedade: inst?.obrigatoriedade ?? t.obrigatoriedade,
      bloqueia_embarque: inst?.bloqueia_embarque ?? t.bloqueia_embarque,
      semaforo,
      detalhe: exigeAnexo ? detalheAnexo(inst) : detalheInstancia(inst, semaforo),
      requisito_id: inst?.id ?? null,
    };
  });

  return { passageiro_id: passageiro.id, ...consolidar(checagens), checagens };
}
