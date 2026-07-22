/**
 * ⚠️ LOCAL / PROVISÓRIO — indicativo visual de Grupo 1 / Grupo 2 na Expedição Egito.
 *
 * Mapeamento tirado da planilha "Validação de Dados - Expedição Egito.xlsx"
 * (aba "Expedição Egito - Dados p emiss": Grupo 1 e Grupo 2). Casa por NOME
 * (fragmento distintivo de cada pessoa, sem acento/maiúsculas) — de propósito
 * SEM CPF no arquivo, pra não versionar dado pessoal.
 *
 * NÃO é pra virar produção como hard-code — quando for definitivo, isso deve
 * sair de uma coluna real (ex.: grupos_expedicao), não daqui.
 */

export type GrupoEgito = "G1" | "G2";

const normNome = (v: string | null | undefined) =>
  (v ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// Fragmento distintivo do nome (normalizado) → grupo. Casa por "inclui".
const POR_NOME: { fragmento: string; grupo: GrupoEgito }[] = [
  // --- Grupo 1 ---
  { fragmento: "luis antonio", grupo: "G1" },
  { fragmento: "veronica", grupo: "G1" },
  { fragmento: "livia andrade", grupo: "G1" },
  { fragmento: "isabella gomes", grupo: "G1" },
  { fragmento: "renzo", grupo: "G1" },
  { fragmento: "alana", grupo: "G1" },
  { fragmento: "simone", grupo: "G1" },
  { fragmento: "mirian", grupo: "G1" },
  { fragmento: "roberta lessa", grupo: "G1" },
  { fragmento: "ana julia", grupo: "G1" },
  { fragmento: "lorena", grupo: "G1" },
  { fragmento: "fabiana", grupo: "G1" },
  { fragmento: "matteus", grupo: "G1" },
  { fragmento: "shirley", grupo: "G1" },
  { fragmento: "tania", grupo: "G1" },
  { fragmento: "liduina", grupo: "G1" },
  { fragmento: "lucia regina", grupo: "G1" },
  { fragmento: "isabela zilah", grupo: "G1" },
  { fragmento: "elias", grupo: "G1" },
  { fragmento: "lucineide", grupo: "G1" },
  { fragmento: "ivan", grupo: "G1" },
  { fragmento: "patricia segala", grupo: "G1" },
  { fragmento: "sandra cristina", grupo: "G1" },
  { fragmento: "haroldo", grupo: "G1" },
  // --- Grupo 2 ---
  { fragmento: "livia de araujo", grupo: "G2" },
  { fragmento: "augusto", grupo: "G2" },
  { fragmento: "karla regiane", grupo: "G2" },
  { fragmento: "gimmy", grupo: "G2" },
  { fragmento: "alexandre", grupo: "G2" },
  { fragmento: "lilian", grupo: "G2" },
  { fragmento: "fernanda", grupo: "G2" },
  { fragmento: "andre luiz", grupo: "G2" },
  { fragmento: "paulo cesar", grupo: "G2" },
  { fragmento: "carmem", grupo: "G2" },
  { fragmento: "cecilia", grupo: "G2" },
  { fragmento: "lara moreira", grupo: "G2" },
  { fragmento: "luziana", grupo: "G2" },
  { fragmento: "ticiana", grupo: "G2" },
  { fragmento: "antonio mardonio", grupo: "G2" },
  { fragmento: "josefa", grupo: "G2" },
  { fragmento: "gisele", grupo: "G2" },
  { fragmento: "ana caroline", grupo: "G2" },
  { fragmento: "ana priscyla", grupo: "G2" },
  { fragmento: "joaquim", grupo: "G2" },
  { fragmento: "ana paula", grupo: "G2" },
  { fragmento: "beatriz rodrigues galvao", grupo: "G2" },
  { fragmento: "nayara", grupo: "G2" },
];

// Fragmentos mais longos primeiro: evita um fragmento curto "roubar" um nome
// que também casaria com um mais específico.
const ORDENADO = [...POR_NOME].sort((a, b) => b.fragmento.length - a.fragmento.length);

/** Retorna "G1"/"G2" do passageiro pelo nome, ou null se não mapeado. */
export function grupoEgito(nomeCompleto: string | null | undefined): GrupoEgito | null {
  const nome = normNome(nomeCompleto);
  if (!nome) return null;
  for (const { fragmento, grupo } of ORDENADO) {
    if (nome.includes(fragmento)) return grupo;
  }
  return null;
}
