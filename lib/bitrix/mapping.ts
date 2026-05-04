/**
 * Helpers de mapeamento de campos custom do Bitrix24.
 *
 * Recomendação: o n8n já transforma a resposta do Bitrix em chaves planas
 * (ex: `UF_CRM_CPF` → `cpf`) antes de chamar nossos webhooks. Os helpers
 * abaixo servem como referência de quais campos custom esperamos.
 */

export const CAMPOS_CUSTOM_BITRIX = {
  CPF: "UF_CRM_CPF",
  PASSAPORTE: "UF_CRM_PASSAPORTE",
  VALIDADE_PASSAPORTE: "UF_CRM_PASSAPORTE_VALIDADE",
  DATA_NASCIMENTO: "UF_CRM_DATA_NASCIMENTO",
  EXPEDICAO_CODIGO: "UF_CRM_EXPEDICAO_CODIGO",
  VOO_NACIONAL: "UF_CRM_VOO_NACIONAL",
  OBSERVACOES_OPERACIONAIS: "UF_CRM_OBSERVACOES",
} as const;

/**
 * Helper: extrai um campo custom de um objeto bruto do Bitrix.
 * O Bitrix devolve esses campos com prefixo "UF_CRM_" — sometimes como string,
 * sometimes como array (quando multivalor).
 */
export function extractCustom<T = unknown>(
  bitrixObj: Record<string, unknown>,
  key: keyof typeof CAMPOS_CUSTOM_BITRIX,
): T | null {
  const fieldName = CAMPOS_CUSTOM_BITRIX[key];
  const value = bitrixObj[fieldName];
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T;
  return value as T;
}
