// Geração do PDF da viagem (client-side, sob demanda). Carregado via import()
// dinâmico só quando o passageiro clica em "Baixar PDF" — mantém o @react-pdf/renderer
// fora do bundle principal.
//
// Identidade visual alinhada ao Guia da Marca "Se Tu For, Eu Vou!" (2025):
// paleta Dark Teal / Lime / Light Green / Off-White, capa full-bleed com o ícone
// das duas figuras, títulos em serifa (espírito da Moret) e corpo em sans (Inter-like).
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Svg,
  Path,
  Circle,
  pdf,
} from "@react-pdf/renderer";
import { formatDate } from "@/lib/utils";
import type { AmigoExpedicao } from "./actions";

// ===== Paleta oficial da marca =====
const DARK = "#09282B"; // Dark Teal — cor principal
const TEAL_600 = "#104146"; // teal escuro (variação)
const TEAL_400 = "#325A5E"; // teal médio (metadados sobre claro)
const LIME = "#CCED60"; // Lime Green — acento
const GREEN_SOFT = "#CBD8CE"; // Light Green — painéis/bordas
const OFF = "#F8F6F7"; // Off White — fundo/texto sobre escuro
const INK = "#123338"; // texto de corpo sobre fundo claro (teal profundo)
const MUTED = "#325A5E"; // texto secundário

// ===== Fontes nativas do PDF (sem dependência externa) =====
// Serifa (Times) evoca a Moret do logotipo; Helvetica evoca a Inter do corpo.
const SERIF = "Times-Roman";
const SERIF_BOLD = "Times-Bold";
const SERIF_ITALIC = "Times-Italic";
const SANS = "Helvetica";
const SANS_BOLD = "Helvetica-Bold";
const SANS_ITALIC = "Helvetica-Oblique";

const styles = StyleSheet.create({
  // ---- Capa (full-bleed dark teal) ----
  coverPage: {
    backgroundColor: DARK,
    color: OFF,
    paddingTop: 74,
    paddingBottom: 56,
    paddingHorizontal: 48,
    flexDirection: "column",
  },
  coverTop: { flexDirection: "column", alignItems: "flex-start" },
  coverWordmark: { fontFamily: SERIF, fontSize: 15, color: OFF, marginTop: 16, letterSpacing: 0.5 },
  coverWordmarkTag: { fontFamily: SERIF, fontSize: 8, color: GREEN_SOFT },
  coverSpacer: { flexGrow: 1 },
  coverRule: { width: 54, height: 3, backgroundColor: LIME, marginBottom: 16 },
  coverKicker: { fontFamily: SANS_BOLD, fontSize: 9, color: LIME, letterSpacing: 2, marginBottom: 8 },
  coverTitle: { fontFamily: SERIF_BOLD, fontSize: 30, color: OFF, lineHeight: 1.1 },
  coverDest: { fontFamily: SERIF, fontSize: 14, color: GREEN_SOFT, marginTop: 10 },
  coverDates: { fontFamily: SANS, fontSize: 11, color: GREEN_SOFT, marginTop: 4 },
  coverPax: { marginTop: 22, flexDirection: "column" },
  coverPaxLabel: { fontFamily: SANS_BOLD, fontSize: 8, color: TEAL_400, letterSpacing: 1.5 },
  coverPaxNome: { fontFamily: SERIF, fontSize: 15, color: LIME, marginTop: 3 },
  coverTagline: { fontFamily: SERIF_ITALIC, fontSize: 11, color: GREEN_SOFT, marginTop: 26 },

  // ---- Páginas de conteúdo ----
  page: {
    backgroundColor: OFF,
    paddingTop: 52,
    paddingBottom: 42,
    paddingHorizontal: 36,
    fontSize: 10,
    color: INK,
    fontFamily: SANS,
  },
  header: {
    position: "absolute",
    top: 20,
    left: 36,
    right: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: GREEN_SOFT,
    paddingBottom: 8,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerWord: { fontFamily: SERIF, fontSize: 9, color: DARK, marginLeft: 6, letterSpacing: 0.5 },
  headerTrip: { fontFamily: SANS, fontSize: 8, color: MUTED },

  secao: { marginTop: 16 },
  secaoTituloRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  secaoBar: { width: 4, height: 15, backgroundColor: LIME, borderRadius: 2, marginRight: 8 },
  secaoTitulo: { fontFamily: SERIF_BOLD, fontSize: 15, color: DARK },

  subtitulo: {
    fontFamily: SANS_BOLD,
    fontSize: 8,
    color: TEAL_400,
    letterSpacing: 1.2,
    marginTop: 10,
    marginBottom: 5,
  },

  item: {
    borderWidth: 1,
    borderColor: GREEN_SOFT,
    borderRadius: 6,
    padding: 9,
    marginBottom: 6,
    backgroundColor: "#ffffff",
  },
  itemRow: { flexDirection: "row", alignItems: "center" },
  itemTitulo: { fontFamily: SANS_BOLD, fontSize: 11, color: DARK },
  meta: { fontFamily: SANS, fontSize: 9, color: MUTED, marginTop: 2 },
  texto: { fontFamily: SANS, fontSize: 10, color: INK, marginTop: 3, lineHeight: 1.45 },

  // Chip "Dia N" do roteiro
  diaChip: {
    backgroundColor: DARK,
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 7,
    marginRight: 8,
  },
  diaChipTxt: { fontFamily: SANS_BOLD, fontSize: 9, color: LIME },
  diaTitulo: { fontFamily: SERIF_BOLD, fontSize: 12, color: DARK, flexShrink: 1 },

  tags: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  tag: {
    fontFamily: SANS,
    fontSize: 8,
    color: DARK,
    backgroundColor: GREEN_SOFT,
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 5,
    marginRight: 4,
    marginBottom: 2,
  },
  voucherChip: {
    fontFamily: SANS_BOLD,
    fontSize: 8,
    color: DARK,
    backgroundColor: LIME,
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 5,
    marginTop: 5,
    alignSelf: "flex-start",
  },

  fotos: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  foto: { width: 148, height: 99, objectFit: "cover", borderRadius: 4, marginRight: 5, marginBottom: 5 },

  // Aviso com acento lime à esquerda
  aviso: {
    borderWidth: 1,
    borderColor: GREEN_SOFT,
    borderLeftWidth: 4,
    borderLeftColor: LIME,
    borderRadius: 6,
    padding: 9,
    marginBottom: 6,
    backgroundColor: "#ffffff",
  },
  avisoTipo: {
    fontFamily: SANS_BOLD,
    fontSize: 7,
    color: TEAL_400,
    letterSpacing: 1,
    marginBottom: 2,
  },

  vazio: { fontFamily: SANS_ITALIC, fontSize: 9, color: MUTED },

  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: GREEN_SOFT,
    paddingTop: 6,
  },
  footerBrand: { fontFamily: SERIF, fontSize: 8, color: MUTED },
  footerPage: { fontFamily: SANS, fontSize: 8, color: MUTED },
});

/** Ícone da marca (duas figuras) — recriado em vetor para nitidez em qualquer tamanho. */
function MarcaIcone({ size = 46 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* corpos (lime) */}
      <Path
        d="M41 34 C 23 39, 17 57, 23 73 C 25 78, 32 78, 34 72 C 38 59, 43 51, 53 46 C 50 40, 46 35, 41 34 Z"
        fill={LIME}
      />
      <Path
        d="M63 50 C 81 55, 87 71, 81 87 C 79 92, 72 92, 70 86 C 66 73, 61 65, 51 60 C 54 54, 58 51, 63 50 Z"
        fill={LIME}
      />
      {/* cabeças (off-white) */}
      <Circle cx="37" cy="25" r="11" fill={OFF} />
      <Circle cx="66" cy="41" r="11" fill={OFF} />
    </Svg>
  );
}

/** Formas orgânicas decorativas da marca, no canto inferior da capa. */
function CapaDecor() {
  return (
    <Svg
      style={{ position: "absolute", right: 0, bottom: 0 }}
      width={300}
      height={320}
      viewBox="0 0 300 320"
    >
      <Path d="M300 60 C 175 110, 165 250, 260 320 L300 320 Z" fill={TEAL_600} />
      <Path d="M300 175 C 235 200, 230 285, 275 320 L300 320 Z" fill="#0d3033" />
    </Svg>
  );
}

function SecaoTitulo({ children }: { children: string }) {
  return (
    <View style={styles.secaoTituloRow}>
      <View style={styles.secaoBar} />
      <Text style={styles.secaoTitulo}>{children}</Text>
    </View>
  );
}

function ViagemDoc({ exp, nome, fotos }: { exp: AmigoExpedicao; nome: string; fotos: Map<string, string> }) {
  const voos = exp.voos_grupo;
  const passeios = exp.passeios;
  return (
    <Document title={`Viagem — ${exp.nome}`} author="Se Tu For, Eu Vou">
      {/* ===== CAPA ===== */}
      <Page size="A4" style={styles.coverPage}>
        <CapaDecor />
        <View style={styles.coverTop}>
          <MarcaIcone size={52} />
          <Text style={styles.coverWordmark}>
            SE TU FOR, EU VOU! <Text style={styles.coverWordmarkTag}>Viagens</Text>
          </Text>
        </View>

        <View style={styles.coverSpacer} />

        <View>
          <View style={styles.coverRule} />
          <Text style={styles.coverKicker}>SUA EXPEDIÇÃO</Text>
          <Text style={styles.coverTitle}>{exp.nome}</Text>
          <Text style={styles.coverDest}>{exp.destino}</Text>
          <Text style={styles.coverDates}>
            {formatDate(exp.data_embarque)} a {formatDate(exp.data_retorno)}
          </Text>
          <View style={styles.coverPax}>
            <Text style={styles.coverPaxLabel}>VIAJANTE</Text>
            <Text style={styles.coverPaxNome}>{nome}</Text>
          </View>
          <Text style={styles.coverTagline}>Nós cuidamos de tudo e você só embarca!</Text>
        </View>
      </Page>

      {/* ===== CONTEÚDO ===== */}
      <Page size="A4" style={styles.page} wrap>
        {/* Cabeçalho fixo */}
        <View style={styles.header} fixed>
          <View style={styles.headerLeft}>
            <MarcaIcone size={13} />
            <Text style={styles.headerWord}>SE TU FOR, EU VOU!</Text>
          </View>
          <Text style={styles.headerTrip}>{exp.nome}</Text>
        </View>

        {/* Roteiro */}
        {exp.roteiro.length > 0 && (
          <View style={styles.secao}>
            <SecaoTitulo>Roteiro dia a dia (previsto)</SecaoTitulo>
            {exp.roteiro.map((d, i) => (
              <View key={i} style={styles.item} wrap={false}>
                <View style={styles.itemRow}>
                  <View style={styles.diaChip}>
                    <Text style={styles.diaChipTxt}>Dia {d.dia}</Text>
                  </View>
                  {d.titulo ? <Text style={styles.diaTitulo}>{d.titulo}</Text> : null}
                </View>
                <Text style={styles.meta}>
                  {[d.data ? formatDate(d.data) : null, d.cidade].filter(Boolean).join(" · ")}
                </Text>
                {d.descricao ? <Text style={styles.texto}>{d.descricao}</Text> : null}
                {(d.refeicoes || d.hospedagem) ? (
                  <View style={styles.tags}>
                    {d.refeicoes ? <Text style={styles.tag}>Refeições: {d.refeicoes}</Text> : null}
                    {d.hospedagem ? <Text style={styles.tag}>Hospedagem: {d.hospedagem}</Text> : null}
                  </View>
                ) : null}
                {d.fotos.length > 0 && (
                  <View style={styles.fotos}>
                    {d.fotos.map((f, j) => {
                      const data = fotos.get(f.url);
                      return data ? <Image key={j} src={data} style={styles.foto} /> : null;
                    })}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Vouchers: voos + passeios + hospedagem */}
        <View style={styles.secao}>
          <SecaoTitulo>Vouchers</SecaoTitulo>

          <Text style={styles.subtitulo}>VOOS</Text>
          {voos.length > 0 || exp.voo.companhia || exp.voo.localizador ? (
            <>
              {voos.map((v, i) => (
                <View key={i} style={styles.item} wrap={false}>
                  <Text style={styles.itemTitulo}>
                    {v.trecho}: {v.origem ?? "—"} {"->"} {v.destino ?? "—"}
                  </Text>
                  <Text style={styles.meta}>
                    {[v.companhia, v.numero_voo].filter(Boolean).join(" ")}
                    {v.partida ? ` · Partida: ${v.partida}` : ""}
                    {v.chegada ? ` · Chegada: ${v.chegada}` : ""}
                  </Text>
                  {v.observacoes ? <Text style={styles.texto}>{v.observacoes}</Text> : null}
                  {v.voucher_url ? <Text style={styles.voucherChip}>Voucher disponível no portal</Text> : null}
                </View>
              ))}
              {(exp.voo.companhia || exp.voo.localizador) && (
                <Text style={styles.meta}>
                  Seu voo: {exp.voo.companhia ?? "—"}{exp.voo.localizador ? ` · localizador ${exp.voo.localizador}` : ""}
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.vazio}>A definir.</Text>
          )}

          {passeios.length > 0 && (
            <>
              <Text style={styles.subtitulo}>PASSEIOS E INGRESSOS</Text>
              {passeios.map((p, i) => (
                <View key={i} style={styles.item} wrap={false}>
                  <Text style={styles.itemTitulo}>{p.nome}</Text>
                  <Text style={styles.meta}>
                    {[p.data ? formatDate(p.data) : null, p.horario, p.local].filter(Boolean).join(" · ")}
                  </Text>
                  {p.observacoes ? <Text style={styles.texto}>{p.observacoes}</Text> : null}
                  {p.voucher_url ? <Text style={styles.voucherChip}>Voucher disponível no portal</Text> : null}
                </View>
              ))}
            </>
          )}

          {exp.quartos.length > 0 && (
            <>
              <Text style={styles.subtitulo}>HOSPEDAGEM</Text>
              {exp.quartos.map((q, i) => (
                <View key={i} style={styles.item} wrap={false}>
                  <Text style={styles.itemTitulo}>{q.hotel_cidade ?? "Hospedagem"} · Quarto {q.numero}</Text>
                  <Text style={styles.meta}>
                    {q.tipo}
                    {(q.check_in || q.check_out)
                      ? ` · ${q.check_in ? formatDate(q.check_in) : "—"} a ${q.check_out ? formatDate(q.check_out) : "—"}`
                      : ""}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Informações do destino */}
        {exp.info.length > 0 && (
          <View style={styles.secao}>
            <SecaoTitulo>Informações do destino</SecaoTitulo>
            {exp.info.map((b, i) => (
              <View key={i} style={styles.item} wrap={false}>
                <Text style={styles.itemTitulo}>{b.titulo}</Text>
                <Text style={styles.texto}>{b.conteudo}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Avisos */}
        {exp.avisos.length > 0 && (
          <View style={styles.secao}>
            <SecaoTitulo>Avisos e boas práticas</SecaoTitulo>
            {exp.avisos.map((a, i) => (
              <View key={i} style={styles.aviso} wrap={false}>
                <Text style={styles.avisoTipo}>{a.tipo.toUpperCase()}</Text>
                <Text style={styles.itemTitulo}>{a.titulo}</Text>
                <Text style={styles.texto}>{a.conteudo}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Rodapé fixo */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerBrand}>Se Tu For, Eu Vou! · Viagens</Text>
          <Text
            style={styles.footerPage}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

/** Baixa uma imagem (signed URL / rota mock) como data URL. Pula o que falhar/não-imagem. */
async function imagemDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!/^image\/(jpe?g|png)$/i.test(blob.type)) return null; // react-pdf: jpg/png
    return await new Promise<string | null>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Gera o PDF da viagem e devolve o Blob. */
export async function gerarPdfViagem(exp: AmigoExpedicao, nome: string): Promise<Blob> {
  const urls = [...new Set(exp.roteiro.flatMap((d) => d.fotos.map((f) => f.url)))];
  const fotos = new Map<string, string>();
  await Promise.all(
    urls.map(async (u) => {
      const data = await imagemDataUrl(u);
      if (data) fotos.set(u, data);
    }),
  );
  return pdf(<ViagemDoc exp={exp} nome={nome} fotos={fotos} />).toBlob();
}
