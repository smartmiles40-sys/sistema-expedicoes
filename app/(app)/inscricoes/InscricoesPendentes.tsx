"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Check, X, IdCard, ExternalLink, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate, cn } from "@/lib/utils";
import { PERGUNTAS_SAUDE } from "@/app/(app)/expedicoes/[id]/passageiros/SaudeCampos";
import { aprovarInscricao, recusarInscricao, type InscricaoPendente } from "./actions";

function Linha({ label, valor }: { label: string; valor: React.ReactNode }) {
  if (valor === null || valor === undefined || valor === "") return null;
  return (
    <div className="flex gap-2 text-[12px]">
      <span className="w-40 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1 break-words">{valor}</span>
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const has = React.Children.toArray(children).some(Boolean);
  if (!has) return null;
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</div>
      {children}
    </div>
  );
}

const simNao = (v: boolean | null) => (v === null ? null : v ? "Sim" : "Não");

function Detalhe({ it }: { it: InscricaoPendente }) {
  const e = it.endereco;
  const endereco = [e.rua, e.numero, e.complemento, e.bairro, e.cidade, e.estado].filter(Boolean).join(", ");
  const saude = it.saude ?? {};
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <Grupo titulo="Dados pessoais">
        <Linha label="Nome" valor={it.nome_completo} />
        <Linha label="CPF" valor={it.cpf} />
        <Linha label="Nascimento" valor={it.data_nascimento ? formatDate(it.data_nascimento) : null} />
        <Linha label="E-mail" valor={it.email} />
        <Linha label="Telefone" valor={it.telefone} />
      </Grupo>
      {(endereco || e.cep) && (
        <Grupo titulo="Endereço">
          <Linha label="Endereço" valor={endereco || null} />
          <Linha label="CEP" valor={e.cep} />
        </Grupo>
      )}
      <Grupo titulo="Passaporte">
        <Linha label="Número" valor={it.passaporte} />
        <Linha label="Validade" valor={it.validade_passaporte ? formatDate(it.validade_passaporte) : null} />
        <Linha
          label="Anexo"
          valor={
            it.passaporte_arquivo_id ? (
              <a href={`/api/arquivos/${it.passaporte_arquivo_id}/download?inline=1`} target="_blank" rel="noopener noreferrer" className="text-editavel-700 hover:underline">
                Ver passaporte
              </a>
            ) : (
              <span className="text-atencao-600">sem anexo</span>
            )
          }
        />
      </Grupo>
      {(it.contato_emergencia_nome || it.contato_emergencia_fone || it.contato_emergencia_vinculo) && (
        <Grupo titulo="Contato de emergência">
          <Linha label="Nome" valor={it.contato_emergencia_nome} />
          <Linha label="Telefone" valor={it.contato_emergencia_fone} />
          <Linha label="Vínculo" valor={it.contato_emergencia_vinculo} />
        </Grupo>
      )}
      {(it.pref_marcar_assento !== null || it.pref_upgrade_classe) && (
        <Grupo titulo="Preferências de voo">
          <Linha label="Marcar assento" valor={simNao(it.pref_marcar_assento)} />
          <Linha label="Upgrade de classe" valor={it.pref_upgrade_classe} />
        </Grupo>
      )}
      {(it.ja_viajou_internacional !== null || it.paises_visitados) && (
        <Grupo titulo="Experiência de viagem">
          <Linha label="Já viajou internac." valor={simNao(it.ja_viajou_internacional)} />
          <Linha label="Países visitados" valor={it.paises_visitados} />
        </Grupo>
      )}
      {(it.acompanhante_nome || it.acompanhante_divide_quarto) && (
        <Grupo titulo="Acompanhante">
          <Linha label="Acompanhante" valor={it.acompanhante_nome} />
          <Linha label="Dividir quarto/cama" valor={it.acompanhante_divide_quarto} />
        </Grupo>
      )}
      <Grupo titulo="Saúde">
        {PERGUNTAS_SAUDE.map((q) => {
          const resp = (saude as Record<string, string>)[q.campo];
          if (!resp) return null;
          const det = q.detalheCampo ? (saude as Record<string, string>)[q.detalheCampo] : "";
          const det2 = q.detalhe2Campo ? (saude as Record<string, string>)[q.detalhe2Campo] : "";
          const extra = [det, det2].filter(Boolean).join(" · ");
          return <Linha key={q.campo} label={q.pergunta} valor={extra ? `${resp} — ${extra}` : resp} />;
        })}
      </Grupo>
    </div>
  );
}

export function InscricoesPendentes({ itens }: { itens: InscricaoPendente[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [aberto, setAberto] = React.useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setAberto((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function aprovar(it: InscricaoPendente) {
    setBusy(it.id);
    const r = await aprovarInscricao(it.id);
    setBusy(null);
    if (r.ok) { toast.success(`${it.nome_completo} aprovado(a)`); router.refresh(); }
    else toast.error("Erro ao aprovar", { description: r.error });
  }

  async function recusar(it: InscricaoPendente) {
    if (!confirm(`Recusar e apagar a inscrição de ${it.nome_completo}? Esta ação não pode ser desfeita.`)) return;
    setBusy(it.id);
    const r = await recusarInscricao(it.id);
    setBusy(null);
    if (r.ok) { toast.success("Inscrição recusada"); router.refresh(); }
    else toast.error("Erro ao recusar", { description: r.error });
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <UserPlus className="h-4 w-4 text-editavel-600" /> Inscrições pendentes
          {itens.length > 0 && <Badge variant="atencao">{itens.length}</Badge>}
        </h1>
        <p className="text-xs text-muted-foreground">Cadastros recebidos pelo formulário público, aguardando aprovação do operacional.</p>
      </div>

      {itens.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center text-[13px] text-muted-foreground">
          Nenhuma inscrição pendente no momento.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {itens.map((it) => {
            const open = aberto.has(it.id);
            return (
              <div key={it.id} className="space-y-2 rounded-xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold">{it.nome_completo}</div>
                    <div className="text-[11px] text-muted-foreground">CPF {it.cpf ?? "—"} · {formatDate(it.created_at)} · {it.status_reserva}</div>
                  </div>
                  <Badge variant={it.tem_passaporte ? "vinculado" : "atencao"}>
                    <IdCard className="mr-0.5 h-3 w-3" /> {it.tem_passaporte ? "Passaporte" : "Sem anexo"}
                  </Badge>
                </div>

                <div className="rounded-lg bg-muted/40 px-2.5 py-1.5 text-[12px]">
                  <div className="font-medium">{it.expedicao_nome}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {it.destino}{it.data_embarque && ` · embarque ${formatDate(it.data_embarque)}`}
                  </div>
                </div>

                <button type="button" onClick={() => toggle(it.id)} className="flex w-full items-center gap-1 text-[12px] font-medium text-editavel-700 hover:underline">
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
                  {open ? "Ocultar dados" : "Ver todos os dados"}
                </button>
                {open && <Detalhe it={it} />}

                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" variant="brand" onClick={() => aprovar(it)} disabled={busy === it.id} className="flex-1">
                    <Check className="h-3.5 w-3.5" /> Aprovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => recusar(it)} disabled={busy === it.id}>
                    <X className="h-3.5 w-3.5" /> Recusar
                  </Button>
                  {it.expedicao_id && (
                    <Link href={`/expedicoes/${it.expedicao_id}/passageiros`} className="inline-flex h-8 items-center rounded-md border border-border px-2 text-[12px] hover:bg-accent" title="Ver na expedição">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
