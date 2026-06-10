/**
 * Busca taxas de câmbio em BRL na open.er-api.com (gratuita, sem chave, atualiza diariamente).
 * Retorna mapa moeda -> taxa em BRL (1 unidade da moeda = X BRL).
 */
const MOEDAS_ALVO = ["USD", "EUR", "GBP", "JPY", "ARS", "CLP", "PEN"] as const;

interface OpenErApiResponse {
  result: "success" | "error";
  base_code: string;
  rates: Record<string, number>;
  time_last_update_unix?: number;
}

export async function buscarTaxasBrl(): Promise<Record<string, number>> {
  const res = await fetch("https://open.er-api.com/v6/latest/BRL", {
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`open.er-api respondeu ${res.status}`);
  }
  const json = (await res.json()) as OpenErApiResponse;
  if (json.result !== "success" || !json.rates) {
    throw new Error("open.er-api retornou payload invalido");
  }

  const out: Record<string, number> = { BRL: 1.0 };
  for (const m of MOEDAS_ALVO) {
    const r = json.rates[m];
    if (typeof r === "number" && r > 0) {
      out[m] = 1 / r;
    }
  }
  return out;
}
