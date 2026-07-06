// Geração do PDF da viagem (client-side, sob demanda). Carregado via import()
// dinâmico só quando o passageiro clica em "Baixar PDF" — mantém o @react-pdf/renderer
// fora do bundle principal.
//
// Identidade visual alinhada ao Guia da Marca "Se Tu For, Eu Vou!" (2025):
// paleta Dark Teal / Lime / Light Green / Off-White, títulos em serifa (espírito da
// Moret/Fraunces) e corpo em sans. Estrutura inspirada no guia impresso da agência
// (capa temática → resumo → roteiro resumido → dia a dia → deslocamentos → hospedagem
// → informações → avisos → encerramento com a assinatura da marca).
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
  Font,
  pdf,
} from "@react-pdf/renderer";
import { formatDate } from "@/lib/utils";
import type { AmigoExpedicao } from "./actions";

// ===== Paleta oficial da marca =====
const DARK = "#09282B"; // Dark Teal — cor principal
const DARK_2 = "#0D3A3F"; // teal do gradiente da capa
const TEAL_600 = "#104146";
const TEAL_400 = "#325A5E"; // metadados / texto secundário
const LIME = "#D7F264"; // Lime — acento (token da marca)
const LIME_DEEP = "#C0E046";
const GREEN_SOFT = "#CBD8CE"; // bordas / painéis
const PANEL = "#EEF3F1"; // fundo de painel (tint teal bem claro)
const OFF = "#F8F6F7"; // off-white
const INK = "#123338"; // corpo sobre fundo claro
const MUTED = "#325A5E";
const CRITICO = "#C0392B"; // avisos de alerta

// ===== Fontes da marca (Fraunces serifada + Inter) embutidas de /public/fonts =====
// Registradas uma vez na carga do módulo; o @react-pdf busca os TTFs (mesma origem)
// no momento da geração, no cliente.
Font.register({ family: "Fraunces", src: "/fonts/Fraunces-Regular.ttf" });
Font.register({ family: "FrauncesBold", src: "/fonts/Fraunces-SemiBold.ttf" });
Font.register({ family: "FrauncesItalic", src: "/fonts/Fraunces-Italic.ttf" });
Font.register({ family: "Inter", src: "/fonts/Inter-Regular.ttf" });
Font.register({ family: "InterBold", src: "/fonts/Inter-Bold.ttf" });
Font.register({ family: "InterItalic", src: "/fonts/Inter-Italic.ttf" });

const SERIF = "Fraunces";
const SERIF_BOLD = "FrauncesBold";
const SERIF_ITALIC = "FrauncesItalic";
const SANS = "Inter";
const SANS_BOLD = "InterBold";
const SANS_ITALIC = "InterItalic";

const styles = StyleSheet.create({
  // ---------- Capa ----------
  coverPage: { backgroundColor: DARK, color: OFF, paddingTop: 70, paddingBottom: 54, paddingHorizontal: 48 },
  coverTop: { flexDirection: "column", alignItems: "flex-start" },
  coverWordmark: { fontFamily: SERIF, fontSize: 15, color: OFF, marginTop: 14, letterSpacing: 0.5 },
  coverWordmarkTag: { fontFamily: SERIF_ITALIC, fontSize: 9, color: GREEN_SOFT },
  coverLogo: { width: 232 },
  coverSpacer: { flexGrow: 1 },
  coverRule: { width: 54, height: 3, backgroundColor: LIME, marginBottom: 16 },
  coverKicker: { fontFamily: SANS_BOLD, fontSize: 9, color: LIME, letterSpacing: 3, marginBottom: 8 },
  coverTitle: { fontFamily: SERIF_BOLD, fontSize: 32, color: OFF, lineHeight: 1.08 },
  coverDest: { fontFamily: SERIF_ITALIC, fontSize: 15, color: GREEN_SOFT, marginTop: 12 },
  coverMetaRow: { flexDirection: "row", marginTop: 14 },
  coverMetaBox: { marginRight: 26 },
  coverMetaLabel: { fontFamily: SANS_BOLD, fontSize: 7, color: TEAL_400, letterSpacing: 1.5, marginBottom: 3 },
  coverMetaVal: { fontFamily: SANS, fontSize: 11, color: OFF },
  coverPax: { marginTop: 24, borderTopWidth: 1, borderTopColor: TEAL_600, paddingTop: 14 },
  coverPaxLabel: { fontFamily: SANS_BOLD, fontSize: 8, color: TEAL_400, letterSpacing: 1.5 },
  coverPaxNome: { fontFamily: SERIF, fontSize: 17, color: LIME, marginTop: 3 },
  coverTagline: { fontFamily: SERIF_ITALIC, fontSize: 12, color: GREEN_SOFT, marginTop: 24, lineHeight: 1.35 },

  // ---------- Páginas de conteúdo ----------
  page: { backgroundColor: OFF, paddingTop: 52, paddingBottom: 40, paddingHorizontal: 38, fontSize: 10, color: INK, fontFamily: SANS },
  header: {
    position: "absolute", top: 20, left: 38, right: 38, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: GREEN_SOFT, paddingBottom: 8,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerWord: { fontFamily: SERIF, fontSize: 9, color: DARK, marginLeft: 6, letterSpacing: 0.5 },
  headerLogo: { width: 74 },
  headerTrip: { fontFamily: SANS, fontSize: 8, color: MUTED },

  // Cabeçalho de seção
  secao: { marginTop: 18 },
  secaoTituloRow: { flexDirection: "row", alignItems: "center", marginBottom: 9 },
  secaoBar: { width: 4, height: 16, backgroundColor: LIME, borderRadius: 2, marginRight: 8 },
  secaoTitulo: { fontFamily: SERIF_BOLD, fontSize: 16, color: DARK },
  secaoHint: { fontFamily: SANS, fontSize: 8, color: MUTED, marginBottom: 6, marginTop: -4 },

  subtitulo: { fontFamily: SANS_BOLD, fontSize: 8, color: TEAL_400, letterSpacing: 1.2, marginTop: 12, marginBottom: 6 },

  // ---------- Resumo (fact grid) ----------
  resumoPanel: { backgroundColor: PANEL, borderRadius: 8, padding: 14, flexDirection: "row", flexWrap: "wrap" },
  fact: { width: "50%", marginBottom: 12, paddingRight: 12 },
  factLabel: { fontFamily: SANS_BOLD, fontSize: 7, color: TEAL_400, letterSpacing: 1.2, marginBottom: 2 },
  factVal: { fontFamily: SERIF, fontSize: 12, color: DARK },
  factSub: { fontFamily: SANS, fontSize: 8, color: MUTED, marginTop: 1 },

  // ---------- Roteiro resumido ----------
  resumoDia: { flexDirection: "row", alignItems: "center", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: GREEN_SOFT },
  resumoDiaNum: { fontFamily: SANS_BOLD, fontSize: 8, color: DARK, backgroundColor: LIME, borderRadius: 3, paddingVertical: 2, paddingHorizontal: 5, marginRight: 8, width: 40, textAlign: "center" },
  resumoDiaTit: { fontFamily: SANS_BOLD, fontSize: 10, color: INK, flexGrow: 1 },
  resumoDiaMeta: { fontFamily: SANS, fontSize: 8, color: MUTED },

  // ---------- Cards genéricos ----------
  item: { borderWidth: 1, borderColor: GREEN_SOFT, borderRadius: 6, padding: 10, marginBottom: 7, backgroundColor: "#ffffff" },
  itemRow: { flexDirection: "row", alignItems: "center" },
  itemTitulo: { fontFamily: SANS_BOLD, fontSize: 11, color: DARK },
  meta: { fontFamily: SANS, fontSize: 9, color: MUTED, marginTop: 2 },
  texto: { fontFamily: SANS, fontSize: 10, color: INK, marginTop: 4, lineHeight: 1.5 },

  // Dia detalhado (acento à esquerda)
  dia: { borderWidth: 1, borderColor: GREEN_SOFT, borderLeftWidth: 4, borderLeftColor: LIME, borderRadius: 6, padding: 11, marginBottom: 8, backgroundColor: "#ffffff" },
  diaChip: { backgroundColor: DARK, borderRadius: 4, paddingVertical: 3, paddingHorizontal: 7, marginRight: 8 },
  diaChipTxt: { fontFamily: SANS_BOLD, fontSize: 9, color: LIME },
  diaTitulo: { fontFamily: SERIF_BOLD, fontSize: 13, color: DARK, flexShrink: 1 },

  tags: { flexDirection: "row", flexWrap: "wrap", marginTop: 7 },
  tag: { fontFamily: SANS, fontSize: 8, color: DARK, backgroundColor: GREEN_SOFT, borderRadius: 3, paddingVertical: 2, paddingHorizontal: 5, marginRight: 4, marginBottom: 2 },
  voucherChip: { fontFamily: SANS_BOLD, fontSize: 8, color: DARK, backgroundColor: LIME, borderRadius: 3, paddingVertical: 2, paddingHorizontal: 5, marginTop: 5, alignSelf: "flex-start" },

  fotos: { flexDirection: "row", flexWrap: "wrap", marginTop: 7 },
  foto: { width: 150, height: 100, objectFit: "cover", borderRadius: 4, marginRight: 5, marginBottom: 5 },

  // Dia com foto ao lado do texto (texto à esquerda, imagem à direita)
  diaBody: { flexDirection: "row", alignItems: "flex-start" },
  diaTexto: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  diaFotoCol: { width: 168, marginLeft: 12 },
  fotoLado: { width: 168, height: 122, objectFit: "cover", borderRadius: 4, marginBottom: 5 },

  // ---------- Voo (cartão de deslocamento) ----------
  vooCard: { borderWidth: 1, borderColor: GREEN_SOFT, borderRadius: 6, marginBottom: 7, backgroundColor: "#ffffff", overflow: "hidden" },
  vooHead: { backgroundColor: DARK, paddingVertical: 5, paddingHorizontal: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  vooHeadTxt: { fontFamily: SANS_BOLD, fontSize: 9, color: OFF, letterSpacing: 0.5 },
  vooHeadTag: { fontFamily: SANS_BOLD, fontSize: 8, color: LIME },
  vooBody: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12 },
  vooCol: { flexGrow: 1 },
  vooCode: { fontFamily: SERIF_BOLD, fontSize: 18, color: DARK },
  vooTime: { fontFamily: SANS, fontSize: 9, color: MUTED, marginTop: 1 },
  vooArrow: { fontFamily: SANS, fontSize: 12, color: LIME_DEEP, marginHorizontal: 12 },
  vooRight: { alignItems: "flex-end" },
  vooFoot: { paddingHorizontal: 12, paddingBottom: 9 },

  // ---------- Info (painel numerado) ----------
  infoCard: { flexDirection: "row", borderWidth: 1, borderColor: GREEN_SOFT, borderRadius: 6, padding: 10, marginBottom: 7, backgroundColor: "#ffffff" },
  infoNum: { fontFamily: SERIF_BOLD, fontSize: 16, color: LIME_DEEP, width: 26 },

  // ---------- Aviso (acento por tipo) ----------
  aviso: { borderWidth: 1, borderColor: GREEN_SOFT, borderLeftWidth: 4, borderRadius: 6, padding: 10, marginBottom: 7, backgroundColor: "#ffffff" },
  avisoTipo: { fontFamily: SANS_BOLD, fontSize: 7, letterSpacing: 1, marginBottom: 2 },

  // ---------- Links ----------
  linkRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: GREEN_SOFT },
  linkLabel: { fontFamily: SANS_BOLD, fontSize: 9, color: DARK, width: 150 },
  linkUrl: { fontFamily: SANS, fontSize: 8, color: TEAL_400, flexShrink: 1 },

  vazio: { fontFamily: SANS_ITALIC, fontSize: 9, color: MUTED },

  footer: {
    position: "absolute", bottom: 18, left: 38, right: 38, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", borderTopWidth: 1, borderTopColor: GREEN_SOFT, paddingTop: 6,
  },
  footerBrand: { fontFamily: SERIF, fontSize: 8, color: MUTED },
  footerPage: { fontFamily: SANS, fontSize: 8, color: MUTED },

  // ---------- Encerramento ----------
  endPage: { backgroundColor: DARK, color: OFF, paddingTop: 90, paddingBottom: 60, paddingHorizontal: 54, alignItems: "center" },
  endRule: { width: 54, height: 3, backgroundColor: LIME, marginTop: 22, marginBottom: 22 },
  endLogo: { width: 122, height: 122 },
  endTagline: { fontFamily: SERIF_ITALIC, fontSize: 18, color: OFF, textAlign: "center", lineHeight: 1.4 },
  endBoa: { fontFamily: SERIF_BOLD, fontSize: 22, color: LIME, marginTop: 20 },
  endSpacer: { flexGrow: 1 },
  endSocial: { fontFamily: SANS_BOLD, fontSize: 10, color: GREEN_SOFT, letterSpacing: 1 },
  endNota: { fontFamily: SANS, fontSize: 7.5, color: TEAL_400, textAlign: "center", marginTop: 12, lineHeight: 1.5 },
});

/** Formas orgânicas decorativas da marca (canto da capa). */
function CapaDecor() {
  return (
    <Svg style={{ position: "absolute", right: 0, bottom: 0 }} width={300} height={340} viewBox="0 0 300 340">
      <Path d="M300 70 C 175 120, 165 265, 260 340 L300 340 Z" fill={DARK_2} />
      <Path d="M300 190 C 235 215, 230 300, 275 340 L300 340 Z" fill={TEAL_600} />
      <Circle cx="252" cy="150" r="7" fill={LIME} />
    </Svg>
  );
}

function SecaoTitulo({ children, hint }: { children: string; hint?: string }) {
  return (
    <View>
      <View style={styles.secaoTituloRow}>
        <View style={styles.secaoBar} />
        <Text style={styles.secaoTitulo}>{children}</Text>
      </View>
      {hint ? <Text style={styles.secaoHint}>{hint}</Text> : null}
    </View>
  );
}

/** Noites entre embarque e retorno (>= 0). */
function noites(embarque: string, retorno: string): number {
  const a = new Date(embarque.slice(0, 10));
  const b = new Date(retorno.slice(0, 10));
  const d = Math.round((b.getTime() - a.getTime()) / 86400000);
  return Number.isFinite(d) && d > 0 ? d : 0;
}

/** Cor do acento do aviso conforme o tipo (texto livre). */
function corAviso(tipo: string): string {
  const t = (tipo || "").toLowerCase();
  if (t.includes("alert") || t.includes("aten") || t.includes("import")) return CRITICO;
  if (t.includes("dica") || t.includes("tip")) return LIME_DEEP;
  return TEAL_400;
}

function ViagemDoc({ exp, nome, fotos }: { exp: AmigoExpedicao; nome: string; fotos: Map<string, string> }) {
  const voos = exp.voos_grupo;
  const passeios = exp.passeios;
  const nts = noites(exp.data_embarque, exp.data_retorno);
  const meuHotel = exp.quartos[0];

  return (
    <Document title={`Viagem — ${exp.nome}`} author="Se Tu For, Eu Vou">
      {/* ===== CAPA ===== */}
      <Page size="A4" style={styles.coverPage}>
        <CapaDecor />
        <View style={styles.coverTop}>
          <Image src="/brand/logo-horizontal-off-white.png" style={styles.coverLogo} />
        </View>

        <View style={styles.coverSpacer} />

        <View>
          <View style={styles.coverRule} />
          <Text style={styles.coverKicker}>SUA EXPEDIÇÃO</Text>
          <Text style={styles.coverTitle}>{exp.nome}</Text>
          <Text style={styles.coverDest}>{exp.destino}</Text>

          <View style={styles.coverMetaRow}>
            <View style={styles.coverMetaBox}>
              <Text style={styles.coverMetaLabel}>EMBARQUE</Text>
              <Text style={styles.coverMetaVal}>{formatDate(exp.data_embarque)}</Text>
            </View>
            <View style={styles.coverMetaBox}>
              <Text style={styles.coverMetaLabel}>RETORNO</Text>
              <Text style={styles.coverMetaVal}>{formatDate(exp.data_retorno)}</Text>
            </View>
            {nts > 0 && (
              <View style={styles.coverMetaBox}>
                <Text style={styles.coverMetaLabel}>DURAÇÃO</Text>
                <Text style={styles.coverMetaVal}>{nts} {nts === 1 ? "noite" : "noites"}</Text>
              </View>
            )}
          </View>

          <View style={styles.coverPax}>
            <Text style={styles.coverPaxLabel}>PREPARADO PARA</Text>
            <Text style={styles.coverPaxNome}>{nome}</Text>
          </View>

          <Text style={styles.coverTagline}>Explorando o extraordinário.{"\n"}Planejando o inesquecível.</Text>
        </View>
      </Page>

      {/* ===== CONTEÚDO ===== */}
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <View style={styles.headerLeft}>
            <Image src="/brand/sigla-dark-teal.png" style={styles.headerLogo} />
          </View>
          <Text style={styles.headerTrip}>{exp.nome}</Text>
        </View>

        {/* ---- Resumo ---- */}
        <View style={styles.secao}>
          <SecaoTitulo>Sua viagem em resumo</SecaoTitulo>
          <View style={styles.resumoPanel}>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>DESTINO</Text>
              <Text style={styles.factVal}>{exp.destino}</Text>
            </View>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>QUANDO</Text>
              <Text style={styles.factVal}>{formatDate(exp.data_embarque)} a {formatDate(exp.data_retorno)}</Text>
              {nts > 0 ? <Text style={styles.factSub}>{nts} {nts === 1 ? "noite" : "noites"}</Text> : null}
            </View>
            {(exp.voo.companhia || exp.voo.localizador) && (
              <View style={styles.fact}>
                <Text style={styles.factLabel}>SEU VOO</Text>
                <Text style={styles.factVal}>{exp.voo.companhia ?? "A definir"}</Text>
                {exp.voo.localizador ? <Text style={styles.factSub}>Localizador {exp.voo.localizador}</Text> : null}
              </View>
            )}
            {meuHotel && (
              <View style={styles.fact}>
                <Text style={styles.factLabel}>SUA HOSPEDAGEM</Text>
                <Text style={styles.factVal}>{meuHotel.hotel_cidade ?? "Hospedagem"}</Text>
                <Text style={styles.factSub}>Quarto {meuHotel.numero} · {meuHotel.tipo}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ---- Roteiro resumido ---- */}
        {exp.roteiro.length > 0 && (
          <View style={styles.secao}>
            <SecaoTitulo hint="Uma visão geral dia a dia. O detalhe completo vem logo abaixo.">Roteiro resumido</SecaoTitulo>
            {exp.roteiro.map((d, i) => (
              <View key={i} style={styles.resumoDia} wrap={false}>
                <Text style={styles.resumoDiaNum}>Dia {d.dia}</Text>
                <Text style={styles.resumoDiaTit}>{d.titulo || "—"}</Text>
                <Text style={styles.resumoDiaMeta}>{[d.data ? formatDate(d.data) : null, d.cidade].filter(Boolean).join(" · ")}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ---- Roteiro dia a dia ---- */}
        {exp.roteiro.length > 0 && (
          <View style={styles.secao} break>
            <SecaoTitulo>Roteiro dia a dia (previsto)</SecaoTitulo>
            {exp.roteiro.map((d, i) => {
              const imgs = d.fotos.map((f) => fotos.get(f.url)).filter((x): x is string => !!x);
              return (
                <View key={i} style={styles.dia} wrap={false}>
                  <View style={styles.diaBody}>
                    <View style={styles.diaTexto}>
                      <View style={styles.itemRow}>
                        <View style={styles.diaChip}><Text style={styles.diaChipTxt}>Dia {d.dia}</Text></View>
                        {d.titulo ? <Text style={styles.diaTitulo}>{d.titulo}</Text> : null}
                      </View>
                      <Text style={styles.meta}>{[d.data ? formatDate(d.data) : null, d.cidade].filter(Boolean).join(" · ")}</Text>
                      {d.descricao ? <Text style={styles.texto}>{d.descricao}</Text> : null}
                      {(d.refeicoes || d.hospedagem) ? (
                        <View style={styles.tags}>
                          {d.refeicoes ? <Text style={styles.tag}>Refeições: {d.refeicoes}</Text> : null}
                          {d.hospedagem ? <Text style={styles.tag}>Hospedagem: {d.hospedagem}</Text> : null}
                        </View>
                      ) : null}
                    </View>
                    {imgs.length > 0 && (
                      <View style={styles.diaFotoCol}>
                        {imgs.map((src, j) => <Image key={j} src={src} style={styles.fotoLado} />)}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ---- Deslocamentos (voos) ---- */}
        <View style={styles.secao} break>
          <SecaoTitulo>Deslocamentos e voos</SecaoTitulo>
          {voos.length > 0 ? (
            voos.map((v, i) => (
              <View key={i} style={styles.vooCard} wrap={false}>
                <View style={styles.vooHead}>
                  <Text style={styles.vooHeadTxt}>{v.trecho}</Text>
                  <Text style={styles.vooHeadTag}>{[v.companhia, v.numero_voo].filter(Boolean).join(" ") || "Voo"}</Text>
                </View>
                <View style={styles.vooBody}>
                  <View style={styles.vooCol}>
                    <Text style={styles.vooCode}>{v.origem ?? "—"}</Text>
                    {v.partida ? <Text style={styles.vooTime}>Partida {v.partida}</Text> : null}
                  </View>
                  <Text style={styles.vooArrow}>{"------>"}</Text>
                  <View style={[styles.vooCol, styles.vooRight]}>
                    <Text style={styles.vooCode}>{v.destino ?? "—"}</Text>
                    {v.chegada ? <Text style={styles.vooTime}>Chegada {v.chegada}</Text> : null}
                  </View>
                </View>
                {(v.localizador || v.observacoes) && (
                  <View style={styles.vooFoot}>
                    {v.localizador ? <Text style={styles.meta}>Localizador: {v.localizador}</Text> : null}
                    {v.observacoes ? <Text style={styles.texto}>{v.observacoes}</Text> : null}
                    {v.voucher_url ? <Text style={styles.voucherChip}>Voucher disponível no portal</Text> : null}
                  </View>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.vazio}>Detalhes dos voos serão informados em breve.</Text>
          )}
          {(exp.voo.companhia || exp.voo.localizador) && (
            <Text style={styles.meta}>
              Seu voo: {exp.voo.companhia ?? "—"}{exp.voo.localizador ? ` · localizador ${exp.voo.localizador}` : ""}
            </Text>
          )}
        </View>

        {/* ---- Passeios e ingressos ---- */}
        {passeios.length > 0 && (
          <View style={styles.secao}>
            <SecaoTitulo>Passeios e ingressos</SecaoTitulo>
            {passeios.map((p, i) => (
              <View key={i} style={styles.item} wrap={false}>
                <Text style={styles.itemTitulo}>{p.nome}</Text>
                <Text style={styles.meta}>{[p.data ? formatDate(p.data) : null, p.horario, p.local].filter(Boolean).join(" · ")}</Text>
                {p.observacoes ? <Text style={styles.texto}>{p.observacoes}</Text> : null}
                {p.voucher_url ? <Text style={styles.voucherChip}>Voucher disponível no portal</Text> : null}
              </View>
            ))}
          </View>
        )}

        {/* ---- Hospedagem ---- */}
        {exp.quartos.length > 0 && (
          <View style={styles.secao}>
            <SecaoTitulo>Sua hospedagem</SecaoTitulo>
            {exp.quartos.map((q, i) => (
              <View key={i} style={styles.item} wrap={false}>
                <Text style={styles.itemTitulo}>{q.hotel_cidade ?? "Hospedagem"} · Quarto {q.numero}</Text>
                <Text style={styles.meta}>
                  {q.tipo}
                  {(q.check_in || q.check_out) ? ` · ${q.check_in ? formatDate(q.check_in) : "—"} a ${q.check_out ? formatDate(q.check_out) : "—"}` : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ---- Informações do destino ---- */}
        {exp.info.length > 0 && (
          <View style={styles.secao} break>
            <SecaoTitulo>Informações do destino</SecaoTitulo>
            {exp.info.map((b, i) => (
              <View key={i} style={styles.infoCard} wrap={false}>
                <Text style={styles.infoNum}>{String(i + 1).padStart(2, "0")}</Text>
                <View style={{ flexGrow: 1, flexShrink: 1 }}>
                  <Text style={styles.itemTitulo}>{b.titulo}</Text>
                  <Text style={styles.texto}>{b.conteudo}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ---- Avisos e boas práticas ---- */}
        {exp.avisos.length > 0 && (
          <View style={styles.secao}>
            <SecaoTitulo>Avisos e boas práticas</SecaoTitulo>
            {exp.avisos.map((a, i) => (
              <View key={i} style={[styles.aviso, { borderLeftColor: corAviso(a.tipo) }]} wrap={false}>
                <Text style={[styles.avisoTipo, { color: corAviso(a.tipo) }]}>{a.tipo.toUpperCase()}</Text>
                <Text style={styles.itemTitulo}>{a.titulo}</Text>
                <Text style={styles.texto}>{a.conteudo}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ---- Links úteis ---- */}
        {exp.links.length > 0 && (
          <View style={styles.secao}>
            <SecaoTitulo>Links úteis</SecaoTitulo>
            {exp.links.map((l, i) => (
              <View key={i} style={styles.linkRow} wrap={false}>
                <Text style={styles.linkLabel}>{l.label}</Text>
                <Text style={styles.linkUrl}>{l.url}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ---- Seus ingressos (Peru) ---- */}
        {(exp.ingressos_mp.length > 0 || exp.ingressos_trem.length > 0) && (
          <View style={styles.secao}>
            <SecaoTitulo hint="Disponíveis para download no portal do ExpedAmigo.">Seus ingressos</SecaoTitulo>
            {[...exp.ingressos_mp, ...exp.ingressos_trem].map((g, i) => (
              <View key={i} style={styles.item} wrap={false}>
                <Text style={styles.itemTitulo}>{g.nome}</Text>
                <Text style={styles.voucherChip}>Disponível no portal</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerBrand}>Se Tu For, Eu Vou! · Viagens</Text>
          <Text style={styles.footerPage} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ===== ENCERRAMENTO ===== */}
      <Page size="A4" style={styles.endPage}>
        <Image src="/brand/logo-circular-off-white.png" style={styles.endLogo} />
        <View style={styles.endRule} />
        <Text style={styles.endTagline}>Explorando o extraordinário.{"\n"}Planejando o inesquecível.</Text>
        <Text style={styles.endBoa}>Boa viagem!</Text>
        <View style={styles.endSpacer} />
        <Text style={styles.endSocial}>@setuforeuvouviagens</Text>
        <Text style={styles.endNota}>
          Este material é de uso exclusivo dos participantes desta expedição da{"\n"}
          Se Tu For, Eu Vou! — Viagens. As informações podem sofrer ajustes; acompanhe o portal e o grupo oficial.
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
