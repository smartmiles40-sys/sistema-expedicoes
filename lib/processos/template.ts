/**
 * Catálogo canônico de processos de uma expedição.
 *
 * Fonte: ClickUp "Processos - Expedição" do Grupo Inovvatur / Se Tu For, Eu Vou
 * (app.clickup.com/31174175/v/li/901305605968). Os títulos das 31 tarefas são
 * VERBATIM da lista; as subtarefas marcadas são um ponto de partida operacional
 * (refinar contra o ClickUp). Cada processo carrega a fase de antecedência, o
 * papel responsável padrão e a prioridade — o builder calcula o prazo a partir
 * da data de embarque da expedição.
 */
import type { EtapaChecklist, Prioridade, PapelUsuario, ChecklistItemRow } from "@/types/database";
import { FASES_CHECKLIST } from "@/lib/constants";

export type ProcessoTemplate = {
  etapa: EtapaChecklist;
  tarefa: string;
  papel: PapelUsuario | null;
  prioridade: Prioridade;
  /** Override do offset de prazo (dias antes do embarque). Default = diasReferencia da fase. */
  offsetDias?: number;
  subtarefas?: string[];
};

export const PROCESSOS_EXPEDICAO: ProcessoTemplate[] = [
  // ─── Após o fechamento (pós-venda / comercial / financeiro) ───────────────
  { etapa: "Após o fechamento", tarefa: "Entrar em contato com o cliente", papel: "comercial", prioridade: "Alta" },
  { etapa: "Após o fechamento", tarefa: "Preencher o contrato, enviar para o cliente e anexar", papel: "comercial", prioridade: "Alta",
    subtarefas: ["Preencher contrato com dados do cliente", "Enviar para assinatura", "Anexar contrato assinado"] },
  { etapa: "Após o fechamento", tarefa: "Solicitar link de pagamento para Milena", papel: "financeiro", prioridade: "Alta" },
  { etapa: "Após o fechamento", tarefa: "Anexar contrato no sistema", papel: "comercial", prioridade: "Média" },
  { etapa: "Após o fechamento", tarefa: "Se cliente pagar no pix, fazer controle mensal", papel: "financeiro", prioridade: "Média" },
  { etapa: "Após o fechamento", tarefa: "Atualizar Planilha de Controle da Expedição", papel: "operacional", prioridade: "Média" },

  // ─── 12 a 6 meses de antecedência ─────────────────────────────────────────
  { etapa: "12 a 6 meses", tarefa: "Criar alerta do voo principal e fazer emissão", papel: "operacional", prioridade: "Crítica",
    subtarefas: ["Criar alerta de preço do voo principal", "Acompanhar variação de tarifa", "Definir melhor data de emissão", "Emitir bilhetes do voo principal", "Conferir localizadores"] },
  { etapa: "12 a 6 meses", tarefa: "Monitorar e reservar hotéis", papel: "operacional", prioridade: "Alta",
    subtarefas: ["Levantar opções de hotel por cidade", "Comparar tarifas e política de cancelamento", "Fazer pré-reserva", "Confirmar reserva", "Salvar confirmação"] },
  { etapa: "12 a 6 meses", tarefa: "Falar com fornecedores para reservar passeios", papel: "operacional", prioridade: "Alta",
    subtarefas: ["Listar passeios do roteiro", "Cotar com fornecedores/DMC", "Reservar passeios", "Confirmar disponibilidade"] },
  { etapa: "12 a 6 meses", tarefa: "Comprar voos internos", papel: "operacional", prioridade: "Alta",
    subtarefas: ["Mapear trechos internos do roteiro", "Emitir voos internos"] },
  { etapa: "12 a 6 meses", tarefa: "Alimentar Planilha Controle de Expedições", papel: "operacional", prioridade: "Média",
    subtarefas: ["Lançar custos reservados", "Atualizar status de cada item"] },
  { etapa: "12 a 6 meses", tarefa: "Checar hospedagens mais baratas", papel: "operacional", prioridade: "Média",
    subtarefas: ["Revisar tarifas atuais", "Comparar alternativas", "Trocar se houver economia"] },
  { etapa: "12 a 6 meses", tarefa: "Criar grupo do Wpp da Expedição após fechamento de 90%", papel: "comercial", prioridade: "Média",
    subtarefas: ["Criar grupo e adicionar clientes confirmados"] },

  // ─── 6 a 2 meses de antecedência ──────────────────────────────────────────
  { etapa: "6 a 2 meses", tarefa: "Conferir se todos os voos estão confirmados", papel: "operacional", prioridade: "Crítica",
    subtarefas: ["Conferir voo principal", "Conferir voos internos", "Validar localizadores", "Conferir bagagem incluída", "Conferir assentos"] },
  { etapa: "6 a 2 meses", tarefa: "Salvar nova confirmação de hospedagem", papel: "operacional", prioridade: "Alta",
    subtarefas: ["Solicitar reconfirmação aos hotéis", "Salvar vouchers atualizados"] },
  { etapa: "6 a 2 meses", tarefa: "Confirmar passeios e horários dos transfers", papel: "operacional", prioridade: "Alta",
    subtarefas: ["Confirmar horários de transfer com DMC"] },
  { etapa: "6 a 2 meses", tarefa: "Travel Design", papel: "operacional", prioridade: "Média",
    subtarefas: ["Montar roteiro visual day-by-day", "Revisar com o time"] },
  { etapa: "6 a 2 meses", tarefa: "Oferecer Seguro Viagem", papel: "comercial", prioridade: "Alta",
    subtarefas: ["Cotar seguro para o grupo", "Enviar proposta aos clientes", "Coletar adesões", "Emitir apólices", "Anexar apólices"] },
  { etapa: "6 a 2 meses", tarefa: "Confirmar com clientes documentação", papel: "operacional", prioridade: "Alta",
    subtarefas: ["Conferir validade de passaportes", "Conferir necessidade de visto"] },
  { etapa: "6 a 2 meses", tarefa: "Caixa Brinde e Logomarca", papel: "operacional", prioridade: "Baixa",
    subtarefas: ["Definir itens da caixa de brinde", "Aprovar arte da logomarca", "Solicitar produção", "Conferir recebimento", "Separar por passageiro"] },

  // ─── 2 meses a 15 dias de antecedência ────────────────────────────────────
  { etapa: "2 meses a 15 dias", tarefa: "Conferir se todos os voos estão confirmados", papel: "operacional", prioridade: "Crítica",
    subtarefas: ["Reconferir voo principal", "Reconferir voos internos", "Validar localizadores", "Conferir alterações de malha", "Conferir assentos"] },
  { etapa: "2 meses a 15 dias", tarefa: "Verificar última possibilidade de troca de hospedagens", papel: "operacional", prioridade: "Média",
    subtarefas: ["Revisar tarifas finais", "Trocar se houver ganho real", "Atualizar vouchers"] },
  { etapa: "2 meses a 15 dias", tarefa: "Confirmar passeios e horários dos Transfers", papel: "operacional", prioridade: "Alta",
    subtarefas: ["Reconfirmar horários com DMC"] },
  { etapa: "2 meses a 15 dias", tarefa: "Receber Travel Design", papel: "operacional", prioridade: "Média",
    subtarefas: ["Receber arte final do Travel Design", "Revisar conteúdo"] },
  { etapa: "2 meses a 15 dias", tarefa: "Colocar todas as informações no app", papel: "operacional", prioridade: "Alta" },
  { etapa: "2 meses a 15 dias", tarefa: "Agendar última reunião em vídeo no wpp pelo zoom", papel: "comercial", prioridade: "Média" },
  { etapa: "2 meses a 15 dias", tarefa: "Checar restrições alimentares para voo e preferência de assentos pagos", papel: "operacional", prioridade: "Média" },

  // ─── Na semana da expedição ───────────────────────────────────────────────
  { etapa: "Na semana", tarefa: "Imprimir todas as reservas de passagens pra Luis", papel: "operacional", prioridade: "Alta",
    subtarefas: ["Imprimir bilhetes aéreos"] },
  { etapa: "Na semana", tarefa: "Imprimir todas as hospedagens por pessoa", papel: "operacional", prioridade: "Alta",
    subtarefas: ["Imprimir vouchers de hospedagem por passageiro"] },
  { etapa: "Na semana", tarefa: "Imprimir os vouchers dos passeios para líderes", papel: "operacional", prioridade: "Alta" },
  { etapa: "Na semana", tarefa: "Reunião de apresentação da Expedição", papel: "operacional", prioridade: "Crítica" },
];

const FASE_BY_ETAPA = new Map(FASES_CHECKLIST.map((f) => [f.etapa, f]));

/** prazo (YYYY-MM-DD) = data_embarque − offsetDias. */
function prazoFromEmbarque(dataEmbarque: string, offsetDias: number): string {
  const base = new Date(dataEmbarque);
  base.setDate(base.getDate() - offsetDias);
  return base.toISOString().slice(0, 10);
}

export type ChecklistPadraoParams = {
  expedicaoId: string;
  dataEmbarque: string;
  /** papel → usuario_id, pra atribuir responsável padrão. */
  responsavelPorPapel?: Partial<Record<PapelUsuario, string>>;
  /** prefixo pra IDs determinísticos (usado no mock); default gera aleatório. */
  idPrefix?: string;
  createdAt?: string;
};

/**
 * Instancia os 31 processos (+ subtarefas) como linhas de checklist_itens
 * prontas pra inserir, com prazos calculados a partir do embarque. Pai vem
 * antes dos filhos no array; filhos referenciam o pai via parent_id.
 */
export function construirChecklistPadrao(params: ChecklistPadraoParams): ChecklistItemRow[] {
  const { expedicaoId, dataEmbarque, responsavelPorPapel = {}, idPrefix, createdAt } = params;
  const now = createdAt ?? new Date().toISOString();
  let seq = 0;
  const mkId = () =>
    idPrefix ? `${idPrefix}-${String(++seq).padStart(3, "0")}` : `ck${Math.random().toString(36).slice(2, 14).padEnd(12, "0")}`;

  const rows: ChecklistItemRow[] = [];
  const ordemPorFase = new Map<EtapaChecklist, number>();

  for (const proc of PROCESSOS_EXPEDICAO) {
    const fase = FASE_BY_ETAPA.get(proc.etapa);
    const ordemFase = (ordemPorFase.get(proc.etapa) ?? 0) + 1;
    ordemPorFase.set(proc.etapa, ordemFase);

    // Espalha os prazos dentro da fase: passos mais adiantados vencem antes.
    const baseOffset = proc.offsetDias ?? fase?.diasReferencia ?? 30;
    const offset = baseOffset - (ordemFase - 1) * 2;

    const parentId = mkId();
    rows.push({
      id: parentId,
      expedicao_id: expedicaoId,
      etapa: proc.etapa,
      tarefa: proc.tarefa,
      responsavel_id: (proc.papel && responsavelPorPapel[proc.papel]) || null,
      status: "Pendente",
      prazo: prazoFromEmbarque(dataEmbarque, offset),
      prioridade: proc.prioridade,
      dependencia_id: null,
      parent_id: null,
      ordem: ordemFase,
      evidencia_url: null,
      bitrix_task_id: null,
      observacoes: null,
      created_at: now,
      updated_at: now,
    });

    proc.subtarefas?.forEach((sub, i) => {
      rows.push({
        id: mkId(),
        expedicao_id: expedicaoId,
        etapa: proc.etapa,
        tarefa: sub,
        responsavel_id: (proc.papel && responsavelPorPapel[proc.papel]) || null,
        status: "Pendente",
        prazo: prazoFromEmbarque(dataEmbarque, offset),
        prioridade: proc.prioridade,
        dependencia_id: null,
        parent_id: parentId,
        ordem: i + 1,
        evidencia_url: null,
        bitrix_task_id: null,
        observacoes: null,
        created_at: now,
        updated_at: now,
      });
    });
  }

  return rows;
}
