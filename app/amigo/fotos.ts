// Fotos da marca por destino (extraídas do repositório do site setuforeuvouviagens).
// Fonte única usada pelo portal (/amigo) e pelo PDF da viagem — mantém a identidade
// visual consistente entre os dois. Só JPG/PNG (o @react-pdf não renderiza webp).

export type DestinoFotos = {
  /** Foto de capa/hero do destino. */
  hero: string;
  /** Foto de fechamento (última página do PDF). */
  fecho: string;
  /** Fotos por dia (cicladas quando o roteiro tem mais dias que fotos). */
  dias: string[];
};

const B = "/assets/destinos";
const p = (slug: string, files: string[]): string[] => files.map((f) => `${B}/${slug}/${f}`);

export const DESTINO_FOTOS: Record<string, DestinoFotos> = {
  peru: {
    hero: `${B}/peru/machu-picchu-hero.jpg`,
    fecho: `${B}/peru/vinicunca.jpg`,
    dias: p("peru", [
      "dia-01-cusco.jpg", "dia-02-vale-sagrado.jpg", "machu-picchu.jpg", "cusco-livre.jpg",
      "vinicunca.jpg", "huacachina.jpg", "cusco.jpg", "vale-sagrado.jpg", "lima-chegada.jpg",
    ]),
  },
  egito: {
    hero: `${B}/egito/hero-piramides.jpg`,
    fecho: `${B}/egito/cruzeiro-nilo.jpg`,
    dias: p("egito", [
      "dia-01-embarque.jpg", "dia-02-faraos.jpg", "dia-03-piramides.jpg", "dia-04-cairo.jpg",
      "cruzeiro-nilo.jpg", "dia-05-philae.jpg", "dia-06-kom-ombo.jpg", "dia-07-luxor.jpg",
      "dia-08-vale-dos-reis.jpg", "dia-09-resort.jpg", "dia-10-iate.jpg", "dia-12-dubai.jpg",
      "dia-12-burj-vista.jpg", "dia-04-nmec.jpg",
    ]),
  },
  "japao-china": {
    hero: `${B}/japao-china/hero.jpg`,
    fecho: `${B}/japao-china/galeria-05.jpg`,
    dias: p("japao-china", [
      "dia-01.jpg", "dia-02.jpg", "dia-03.jpg", "dia-04.jpg", "dia-06.jpg", "dia-08.jpg",
      "dia-09.jpg", "dia-10.jpg", "dia-11.jpg", "dia-12.jpg", "dia-13.jpg", "dia-16.jpg",
      "galeria-01.jpg", "galeria-03.jpg", "galeria-04.jpg", "galeria-05.jpg",
    ]),
  },
  tailandia: {
    hero: `${B}/tailandia/hero.jpg`,
    fecho: `${B}/tailandia/galeria-01.jpg`,
    dias: p("tailandia", [
      "dia-01.jpg", "dia-02.jpg", "dia-03.jpg", "dia-05.jpg", "dia-06.jpg",
      "dia-10-phiphi-welcome.jpg", "dia-11.jpg", "dia-11-long-beach.jpg", "dia-12.jpg",
      "dia-12-tour-barco-phiphi.jpg", "dia-13.jpg", "galeria-01.jpg", "galeria-02.jpg",
      "galeria-03.jpg", "galeria-04.jpg",
    ]),
  },
  islandia: {
    hero: `${B}/islandia/dia-05-vestrahorn.jpg`,
    fecho: `${B}/islandia/aurora-boreal.jpg`,
    dias: p("islandia", [
      "dia-02-keflavik.jpg", "dia-03-golden-circle.jpg", "dia-03-praia-negra.jpg",
      "dia-04-ice-cave.jpg", "dia-05-jokulsarlon.jpg", "dia-05-vestrahorn.jpg",
      "dia-06-godafoss.jpg", "dia-06-leste.jpg", "dia-07-myvatn.jpg", "dia-08-fridheimar.jpg",
      "dia-08-oeste.jpg", "dia-09-thingvellir.jpg", "aurora-boreal.jpg",
      "blue-lagoon-scaled.jpg", "diamond-beach.jpg", "reykjavik.jpg",
    ]),
  },
  "turquia-grecia": {
    hero: `${B}/turquia-grecia/hero.jpg`,
    fecho: `${B}/turquia-grecia/galeria-03.jpg`,
    dias: p("turquia-grecia", [
      "dia-01.jpg", "dia-02.jpg", "dia-04.jpg", "dia-05.jpg", "dia-06.jpg", "dia-08.jpg",
      "dia-09.jpg", "dia-11.jpg", "galeria-01.jpg", "galeria-02.jpg", "galeria-03.jpg",
      "galeria-04.jpg",
    ]),
  },
  amazonia: {
    hero: `${B}/amazonia/hero-bg-new.jpg`,
    fecho: `${B}/amazonia/grupo-barco-sunset.jpg`,
    dias: p("amazonia", [
      "barco-rio-amazonas.jpg", "comunidade-indigena.jpg", "grupo-barco-sunset.jpg",
      "teatro-amazonas-new.jpg",
    ]),
  },
  italia: {
    hero: `${B}/italia/hero-positano.jpg`,
    fecho: `${B}/italia/dia-08-positano-mar.jpg`,
    dias: p("italia", [
      "dia-01-embarque.jpg", "dia-02-napoles.jpg", "dia-03-pizza-napolitana.jpg",
      "dia-04-pompeia.jpg", "dia-05-limoncello.jpg", "dia-06-amalfi.jpg", "dia-07-capri.jpg",
      "dia-08-positano-mar.jpg", "dia-09-roma.jpg",
    ]),
  },
};

/** Destino (texto livre do banco) -> slug da pasta de fotos. "" se desconhecido. */
export function slugDestino(destino: string): string {
  const d = (destino ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (d.includes("peru")) return "peru";
  if (d.includes("egito")) return "egito";
  if (d.includes("tail")) return "tailandia";
  if (d.includes("island")) return "islandia";
  if (d.includes("turquia") || d.includes("grecia")) return "turquia-grecia";
  if (d.includes("amazonia") || d.includes("brasil")) return "amazonia";
  if (d.includes("italia")) return "italia";
  if (d.includes("japao") || d.includes("china")) return "japao-china";
  return "";
}

function fotosDoDestino(destino: string): DestinoFotos | null {
  return DESTINO_FOTOS[slugDestino(destino)] ?? null;
}

/** Foto de capa/hero do destino (null se não temos fotos daquele destino). */
export function heroDoDestino(destino: string): string | null {
  return fotosDoDestino(destino)?.hero ?? null;
}

/** Foto de fechamento (cai no hero se não houver fecho). */
export function fechoDoDestino(destino: string): string | null {
  const f = fotosDoDestino(destino);
  return f?.fecho ?? f?.hero ?? null;
}

/** Foto para um dia do roteiro — cicla pelas fotos do destino. */
export function diaImgFallback(destino: string, dia: number): string | null {
  const f = fotosDoDestino(destino);
  if (!f || f.dias.length === 0) return null;
  const n = f.dias.length;
  const idx = (((Math.max(1, dia) - 1) % n) + n) % n;
  return f.dias[idx];
}

/** Slideshow do header da tela inicial — um hero por destino. */
export const HERO_SLIDESHOW: string[] = [
  DESTINO_FOTOS.peru.hero,
  DESTINO_FOTOS["japao-china"].hero,
  DESTINO_FOTOS.tailandia.hero,
  DESTINO_FOTOS.italia.hero,
  DESTINO_FOTOS.egito.hero,
  DESTINO_FOTOS.islandia.hero,
  DESTINO_FOTOS["turquia-grecia"].hero,
  DESTINO_FOTOS.amazonia.hero,
];
