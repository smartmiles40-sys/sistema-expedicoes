/**
 * Saída (outbound) para o Bitrix via n8n.
 *
 * O sistema NÃO fala com o Bitrix direto — ele manda uma "cartinha" (POST) para
 * um webhook do n8n, e o n8n é quem escreve no Bitrix (`crm.deal.update` /
 * `crm.contact.update`). As credenciais do Bitrix ficam só no n8n.
 *
 * Config (env):
 *   N8N_BITRIX_OUTBOUND_URL  — URL do webhook de ESCRITA no n8n. Sem ela, não envia.
 *   WEBHOOK_SECRET           — segredo compartilhado; vai no header x-webhook-secret.
 *
 * Regra de ouro: enviar NUNCA pode quebrar a ação que disparou (ex.: aprovar
 * inscrição). Toda falha é engolida e logada — a cartinha é "melhor esforço".
 */

export type PassageiroOutbound = {
  /** O que aconteceu no sistema (o n8n usa isso pra decidir o que fazer). */
  evento: "inscricao_aprovada";
  /** IDs da pessoa no Bitrix (podem ser null se a inscrição não veio de lá). */
  bitrix_deal_id: string | null;
  bitrix_contact_id: string | null;
  /** Código da expedição no sistema (bate com expedicoes.codigo). */
  expedicao_codigo: string | null;
  // Dados úteis — o n8n distribui cada um na sua gavetinha no Bitrix.
  nome_completo: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  passaporte: string | null;
  validade_passaporte: string | null;
  status_reserva: string;
  observacoes: string | null;
  // V2 — todos os campos do formulário de inscrição.
  endereco: {
    cep: string | null;
    rua: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
  };
  contato_emergencia_nome: string | null;
  contato_emergencia_vinculo: string | null;
  contato_emergencia_fone: string | null;
  pref_marcar_assento: boolean | null;
  pref_upgrade_classe: string | null;
  ja_viajou_internacional: boolean | null;
  paises_visitados: string | null;
  /** Questionário de saúde (jsonb) — cada chave é uma pergunta; o n8n mapeia por título. */
  saude: Record<string, string> | null;
};

/**
 * Manda o passageiro para o webhook de escrita do n8n. Retorna se enviou (útil
 * para logs/testes). Nunca lança.
 */
export async function enviarPassageiroParaBitrix(
  payload: PassageiroOutbound,
): Promise<{ enviado: boolean; motivo?: string }> {
  const url = process.env.N8N_BITRIX_OUTBOUND_URL;
  if (!url) {
    // Ainda não configurado — segue a vida sem enviar.
    return { enviado: false, motivo: "N8N_BITRIX_OUTBOUND_URL não configurada" };
  }

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": process.env.WEBHOOK_SECRET ?? "",
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      console.error(`[bitrix-outbound] n8n respondeu ${resp.status} para ${payload.evento}`);
      return { enviado: false, motivo: `n8n status ${resp.status}` };
    }
    return { enviado: true };
  } catch (err) {
    console.error("[bitrix-outbound] falha ao enviar para o n8n:", err);
    return { enviado: false, motivo: "erro de rede" };
  }
}
