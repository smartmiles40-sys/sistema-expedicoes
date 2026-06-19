"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileDown } from "lucide-react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter,
} from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn, formatDate } from "@/lib/utils";
import {
  parsePassageirosCSV,
  cpfDigitos,
  type LinhaImport,
} from "@/lib/csv/passageiros-import";
import { importarPassageiros, importarPassageirosGlobal } from "@/app/(app)/expedicoes/actions";

type StatusLinha = "ok" | "duplicado" | "erro";

type BaseProps = { open: boolean; onOpenChange: (v: boolean) => void };
type ModoExpedicao = BaseProps & { modo: "expedicao"; expedicaoId: string; cpfsExistentes: string[] };
type ModoGlobal = BaseProps & { modo: "global"; expedicoes: { codigo: string; nome: string }[] };
type Props = ModoExpedicao | ModoGlobal;

const COLS_BASE = "nome_completo;data_nascimento;cpf;passaporte;validade_passaporte;email;telefone;tipo;status_reserva;valor_contratado;valor_pago";
const MODELO_EXPEDICAO =
  COLS_BASE + "\n" +
  "Maria Souza;12/05/1990;111.222.333-44;FA123456;01/01/2032;maria@email.com;11999990000;Pagante;Confirmado;18900;9450\n" +
  "João Lima;03/11/1988;555.666.777-88;;;joao@email.com;11988887777;Pagante;Pré-reserva;18900;0";
const MODELO_GLOBAL =
  "expedicao_codigo;" + COLS_BASE + "\n" +
  "PERU-AGO2026;Maria Souza;12/05/1990;111.222.333-44;FA123456;01/01/2032;maria@email.com;11999990000;Pagante;Confirmado;18900;9450\n" +
  "PATAG-NOV2026;João Lima;03/11/1988;555.666.777-88;;;joao@email.com;11988887777;Pagante;Pré-reserva;22500;0";

export function ImportarPassageirosDrawer(props: Props) {
  const { open, onOpenChange } = props;
  const global = props.modo === "global";
  const router = useRouter();
  const [parse, setParse] = React.useState<ReturnType<typeof parsePassageirosCSV> | null>(null);
  const [nomeArquivo, setNomeArquivo] = React.useState<string | null>(null);
  const [importando, setImportando] = React.useState(false);

  const existentes = React.useMemo(
    () => new Set(props.modo === "expedicao" ? props.cpfsExistentes : []),
    [props],
  );
  const codigosValidos = React.useMemo(
    () => new Set(props.modo === "global" ? props.expedicoes.map((e) => e.codigo) : []),
    [props],
  );

  function handleOpenChange(v: boolean) {
    if (!v) { setParse(null); setNomeArquivo(null); }
    onOpenChange(v);
  }

  function carregarTexto(texto: string) {
    // Cadastro exige CPF válido + data de nascimento (modo estrito).
    // Passageiro importado entra como "Confirmado" (salvo status explícito no CSV).
    setParse(parsePassageirosCSV(texto, { exigirObrigatorios: true, statusPadrao: "Confirmado" }));
  }

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNomeArquivo(file.name);
    carregarTexto(await file.text());
  }

  // Classifica cada linha (erro > duplicado > ok), marcando duplicados no lote.
  const classificadas = React.useMemo(() => {
    if (!parse) return [];
    const vistos = new Set<string>();
    return parse.linhas.map((l): { linha: LinhaImport; status: StatusLinha; motivo: string } => {
      if (l.erros.length > 0) return { linha: l, status: "erro", motivo: l.erros.join("; ") };
      if (global) {
        const cod = l.dados.expedicao_codigo;
        if (!cod) return { linha: l, status: "erro", motivo: "código da expedição ausente" };
        if (!codigosValidos.has(cod)) return { linha: l, status: "erro", motivo: `expedição "${cod}" não encontrada` };
      }
      const cpf = cpfDigitos(l.dados.cpf);
      // Chave de dedup: por expedição no modo global; global na expedição única.
      const chave = global ? `${l.dados.expedicao_codigo}|${cpf}` : cpf;
      if (cpf && (existentes.has(cpf) || vistos.has(chave ?? ""))) {
        return { linha: l, status: "duplicado", motivo: "CPF já existe nesta expedição" };
      }
      if (cpf && chave) vistos.add(chave);
      return { linha: l, status: "ok", motivo: "" };
    });
  }, [parse, existentes, codigosValidos, global]);

  const validos = classificadas.filter((c) => c.status === "ok");
  const duplicados = classificadas.filter((c) => c.status === "duplicado").length;
  const comErro = classificadas.filter((c) => c.status === "erro").length;

  function baixarModelo() {
    const blob = new Blob(["﻿" + (global ? MODELO_GLOBAL : MODELO_EXPEDICAO)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = global ? "modelo-passageiros-global.csv" : "modelo-passageiros.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importar() {
    if (validos.length === 0) return;
    setImportando(true);
    const dados = validos.map((c) => c.linha.dados);
    const r = props.modo === "global"
      ? await importarPassageirosGlobal({
          linhas: dados.map((d) => ({ ...d, expedicao_codigo: d.expedicao_codigo ?? "" })),
        })
      : await importarPassageiros({ expedicao_id: props.expedicaoId, linhas: dados });
    setImportando(false);
    if (r.ok) {
      const extras = [
        r.ignorados ? `${r.ignorados} ignorado(s)` : null,
        "semExpedicao" in r && r.semExpedicao ? `${r.semExpedicao} sem expedição` : null,
      ].filter(Boolean).join(" · ");
      toast.success(`${r.inseridos} passageiro(s) importado(s)${extras ? ` · ${extras}` : ""}`);
      handleOpenChange(false);
      router.refresh();
    } else {
      toast.error("Erro ao importar", { description: r.error });
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent width="w-[680px]">
        <DrawerHeader>
          <DrawerTitle>Importar passageiros (CSV)</DrawerTitle>
          <DrawerDescription>
            {global
              ? "Cada linha indica a expedição pelo código (coluna expedicao_codigo). "
              : ""}
            Colunas: nome completo, data de nascimento, CPF, passaporte, validade, e-mail,
            telefone, tipo, status, valor contratado, valor pago. Só o nome
            {global ? " e o código da expedição são" : " é"} obrigatório
            {global ? "s" : ""}.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <div className="flex items-center gap-2">
            <label className="inline-flex">
              <input type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={onArquivo} />
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] font-medium cursor-pointer hover:bg-accent transition-colors">
                <Upload className="h-3.5 w-3.5" /> Escolher arquivo CSV
              </span>
            </label>
            {nomeArquivo && <span className="text-[12px] text-muted-foreground truncate">{nomeArquivo}</span>}
            <button
              type="button"
              onClick={baixarModelo}
              className="ml-auto inline-flex items-center gap-1 text-[12px] text-editavel-600 hover:underline"
            >
              <FileDown className="h-3.5 w-3.5" /> Baixar modelo
            </button>
          </div>

          <div>
            <p className="text-[11px] text-muted-foreground mb-1">Ou cole o conteúdo do CSV:</p>
            <textarea
              rows={4}
              placeholder={global ? "expedicao_codigo;nome_completo;cpf;..." : "nome_completo;cpf;passaporte;..."}
              onChange={(e) => carregarTexto(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[12px] font-mono outline-none focus:ring-2 focus:ring-editavel-600"
            />
          </div>

          {parse?.erroGeral && (
            <div className="rounded-md border border-critico-600/40 bg-critico-100 px-3 py-2 text-[12px] text-critico-600">
              {parse.erroGeral}
            </div>
          )}

          {parse && !parse.erroGeral && (
            <>
              <div className="flex items-center gap-2 text-[12px]">
                <Badge variant="vinculado">{validos.length} válido(s)</Badge>
                {duplicados > 0 && <Badge variant="atencao">{duplicados} duplicado(s)</Badge>}
                {comErro > 0 && <Badge variant="critico">{comErro} com erro</Badge>}
              </div>

              <div className="rounded-md border border-border overflow-hidden">
                <div className="max-h-[320px] overflow-auto">
                  <table className="w-full table-dense">
                    <thead className="bg-muted/40 border-b border-border sticky top-0">
                      <tr>
                        <ThMini>#</ThMini>
                        {global && <ThMini>Expedição</ThMini>}
                        <ThMini>Nome</ThMini>
                        <ThMini>CPF</ThMini>
                        <ThMini>Nasc.</ThMini>
                        <ThMini>Contratado</ThMini>
                        <ThMini>Situação</ThMini>
                      </tr>
                    </thead>
                    <tbody>
                      {classificadas.map((c) => (
                        <tr key={c.linha.linha} className={cn("border-b border-border", c.status === "erro" && "bg-critico-100/40", c.status === "duplicado" && "bg-atencao-100/40")}>
                          <td className="px-2 text-[11px] tabular-nums text-muted-foreground">{c.linha.linha}</td>
                          {global && (
                            <td className="px-2 text-[11px] font-mono text-muted-foreground">{c.linha.dados.expedicao_codigo ?? "—"}</td>
                          )}
                          <td className="px-2 text-[12px] font-medium">{c.linha.dados.nome_completo || <span className="text-critico-600">—</span>}</td>
                          <td className="px-2 text-[11px] font-mono text-muted-foreground">{c.linha.dados.cpf ?? "—"}</td>
                          <td className="px-2 text-[11px] tabular-nums text-muted-foreground">
                            {c.linha.dados.data_nascimento ? formatDate(c.linha.dados.data_nascimento) : "—"}
                          </td>
                          <td className="px-2 text-[11px] tabular-nums text-muted-foreground">
                            {c.linha.dados.valor_contratado_brl != null ? c.linha.dados.valor_contratado_brl.toLocaleString("pt-BR") : "—"}
                          </td>
                          <td className="px-2">
                            <span title={c.motivo} className="inline-flex">
                              <Badge variant={c.status === "ok" ? "vinculado" : c.status === "duplicado" ? "atencao" : "critico"}>
                                {c.status === "ok" ? "Importar" : c.status === "duplicado" ? "Duplicado" : "Erro"}
                              </Badge>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {(duplicados > 0 || comErro > 0) && (
                <p className="text-[11px] text-muted-foreground">
                  Linhas duplicadas ou com erro serão ignoradas. Passe o mouse na situação para ver o motivo.
                </p>
              )}
            </>
          )}
        </DrawerBody>
        <DrawerFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={importar} disabled={importando || validos.length === 0}>
            {importando ? "Importando..." : `Importar ${validos.length} válido(s)`}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function ThMini({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-2 whitespace-nowrap">
      {children}
    </th>
  );
}
