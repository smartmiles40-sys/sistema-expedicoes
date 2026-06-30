// Geração do PDF da viagem (client-side, sob demanda). Carregado via import()
// dinâmico só quando o passageiro clica em "Baixar PDF" — mantém o @react-pdf/renderer
// fora do bundle principal.
import { Document, Page, Text, View, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import { formatDate } from "@/lib/utils";
import type { AmigoExpedicao } from "./actions";

const DARK = "#09282b";
const LIME = "#c0e046";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 36, paddingHorizontal: 32, fontSize: 10, color: "#0f172a", fontFamily: "Helvetica" },
  capa: { backgroundColor: DARK, color: "#ffffff", borderRadius: 8, padding: 18, marginBottom: 16 },
  marca: { fontSize: 10, color: LIME, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  titulo: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  capaSub: { fontSize: 11, color: "#cbd5e1", marginTop: 6 },
  secao: { marginTop: 14 },
  secaoTitulo: { fontSize: 13, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: LIME, paddingBottom: 3 },
  item: { borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 8, marginBottom: 6 },
  itemTitulo: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  meta: { fontSize: 9, color: MUTED, marginTop: 2 },
  texto: { fontSize: 10, marginTop: 3, lineHeight: 1.4 },
  tags: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  tag: { fontSize: 8, color: MUTED, backgroundColor: "#f1f5f9", borderRadius: 3, paddingVertical: 2, paddingHorizontal: 4, marginRight: 4, marginBottom: 2 },
  fotos: { flexDirection: "row", flexWrap: "wrap", marginTop: 5 },
  foto: { width: 150, height: 100, objectFit: "cover", borderRadius: 4, marginRight: 4, marginBottom: 4 },
  subtitulo: { fontSize: 10, fontFamily: "Helvetica-Bold", color: MUTED, marginTop: 8, marginBottom: 4 },
  vazio: { fontSize: 9, color: MUTED, fontStyle: "italic" },
  rodape: { position: "absolute", bottom: 16, left: 32, right: 32, fontSize: 8, color: MUTED, textAlign: "center" },
});

function ViagemDoc({ exp, nome, fotos }: { exp: AmigoExpedicao; nome: string; fotos: Map<string, string> }) {
  const voos = exp.voos_grupo;
  const passeios = exp.passeios;
  return (
    <Document title={`Viagem — ${exp.nome}`} author="Se Tu For, Eu Vou">
      <Page size="A4" style={styles.page} wrap>
        {/* Capa */}
        <View style={styles.capa}>
          <Text style={styles.marca}>SE TU FOR, EU VOU</Text>
          <Text style={styles.titulo}>{exp.nome}</Text>
          <Text style={styles.capaSub}>{exp.destino}</Text>
          <Text style={styles.capaSub}>
            {formatDate(exp.data_embarque)} a {formatDate(exp.data_retorno)}
          </Text>
          <Text style={[styles.capaSub, { marginTop: 8, color: LIME }]}>Viajante: {nome}</Text>
        </View>

        {/* Roteiro */}
        {exp.roteiro.length > 0 && (
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Roteiro dia a dia (previsto)</Text>
            {exp.roteiro.map((d, i) => (
              <View key={i} style={styles.item} wrap={false}>
                <Text style={styles.itemTitulo}>
                  Dia {d.dia}{d.titulo ? ` · ${d.titulo}` : ""}
                </Text>
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
          <Text style={styles.secaoTitulo}>Vouchers</Text>

          <Text style={styles.subtitulo}>Voos</Text>
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
                  {v.voucher_url ? <Text style={styles.meta}>📎 Voucher disponível no portal</Text> : null}
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
              <Text style={styles.subtitulo}>Passeios e ingressos</Text>
              {passeios.map((p, i) => (
                <View key={i} style={styles.item} wrap={false}>
                  <Text style={styles.itemTitulo}>{p.nome}</Text>
                  <Text style={styles.meta}>
                    {[p.data ? formatDate(p.data) : null, p.horario, p.local].filter(Boolean).join(" · ")}
                  </Text>
                  {p.observacoes ? <Text style={styles.texto}>{p.observacoes}</Text> : null}
                  {p.voucher_url ? <Text style={styles.meta}>📎 Voucher disponível no portal</Text> : null}
                </View>
              ))}
            </>
          )}

          {exp.quartos.length > 0 && (
            <>
              <Text style={styles.subtitulo}>Hospedagem</Text>
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
            <Text style={styles.secaoTitulo}>Informações do destino</Text>
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
            <Text style={styles.secaoTitulo}>Avisos e boas práticas</Text>
            {exp.avisos.map((a, i) => (
              <View key={i} style={styles.item} wrap={false}>
                <Text style={styles.itemTitulo}>[{a.tipo}] {a.titulo}</Text>
                <Text style={styles.texto}>{a.conteudo}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.rodape} fixed>
          Se Tu For, Eu Vou · Dúvidas sobre a sua viagem? Fale com a equipe da agência.
        </Text>
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
