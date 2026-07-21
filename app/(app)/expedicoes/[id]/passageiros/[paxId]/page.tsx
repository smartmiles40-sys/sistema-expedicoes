import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, IdCard, Calendar } from "lucide-react";
import { getPassageiro, getExpedicao } from "@/lib/data/expedicoes";
import { listArquivosPassageiro } from "@/lib/data/arquivos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Drive } from "@/components/arquivos/Drive";
import { PassaporteAnexo } from "@/components/arquivos/PassaporteAnexo";
import { CATEGORIA_ARQUIVO } from "@/lib/constants";

/** Pastas do Drive no perfil, sem "Documentos pessoais" (o passaporte tem item próprio). */
const CATEGORIAS_SEM_DOC_PESSOAL = CATEGORIA_ARQUIVO.filter((c) => c !== "Documentos pessoais");
import { formatDate, aniversarioNaViagem } from "@/lib/utils";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { soDigitosCpf } from "@/lib/cpf";
import { ExpedamigoPainel } from "../ExpedamigoPainel";
import type { StatusReserva } from "@/types/database";

const STATUS_VARIANT: Record<StatusReserva, "lista" | "atencao" | "vinculado" | "critico"> = {
  Lead: "lista",
  "Pré-reserva": "atencao",
  Confirmado: "vinculado",
  Cancelado: "critico",
};

export default async function PerfilPassageiroPage({
  params,
}: {
  params: Promise<{ id: string; paxId: string }>;
}) {
  const { id, paxId } = await params;
  const [passageiro, arquivos, expedicao] = await Promise.all([
    getPassageiro(paxId),
    listArquivosPassageiro(paxId),
    getExpedicao(id),
  ]);
  if (!passageiro || passageiro.expedicao_id !== id) notFound();

  const aniv = expedicao
    ? aniversarioNaViagem(passageiro.data_nascimento, expedicao.data_embarque, expedicao.data_retorno)
    : null;

  const pv = passageiro.perfil_viajante ?? null;
  const temPerfil = pv && [pv.profissao, pv.descricao_grupo, pv.anima_expedicao, pv.significado, pv.instagram, pv.camiseta, pv.musica].some((v) => v && String(v).trim());

  // ExpedAmigo (só admin): estado de liberação + senha da pessoa.
  const currentUser = await getCurrentUser();
  const isAdmin = currentUser?.papel === "admin";
  let acesso: { temHash: boolean; senhaProvisoria: string | null } = { temHash: false, senhaProvisoria: null };
  if (isAdmin && !DEV_USE_MOCK_DATA && passageiro.cpf) {
    const sb = createServiceRoleClient();
    const { data } = await sb.from("acesso_senhas").select("senha_hash,senha_provisoria").eq("cpf", soDigitosCpf(passageiro.cpf)).maybeSingle();
    acesso = {
      temHash: !!(data as { senha_hash: string | null } | null)?.senha_hash,
      senhaProvisoria: (data as { senha_provisoria: string | null } | null)?.senha_provisoria ?? null,
    };
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href={`/expedicoes/${id}/passageiros`}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Avatar
          nome={passageiro.nome_completo}
          size={44}
          className="shrink-0"
          src={passageiro.foto_arquivo_id ? `/api/arquivos/${passageiro.foto_arquivo_id}/download?inline=1` : undefined}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-semibold truncate">{passageiro.nome_completo}</h1>
            <Badge variant={STATUS_VARIANT[passageiro.status_reserva]}>{passageiro.status_reserva}</Badge>
            <Badge variant={passageiro.tipo === "Líder" ? "lista" : passageiro.tipo === "Cortesia" ? "auto" : "vinculado"}>
              {passageiro.tipo}
            </Badge>
          </div>
        </div>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>ExpedAmigo (portal do viajante)</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpedamigoPainel
              passageiroId={paxId}
              expedicaoId={id}
              cpf={passageiro.cpf}
              liberado={!!passageiro.liberado_expedamigo}
              temHash={acesso.temHash}
              senhaProvisoria={acesso.senhaProvisoria}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card>
          <CardHeader>
            <CardTitle>Dados pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-[13px]">
            <Linha icon={<IdCard className="h-3.5 w-3.5" />} label="CPF" value={passageiro.cpf} />
            <Linha icon={<IdCard className="h-3.5 w-3.5" />} label="Passaporte" value={passageiro.passaporte} />
            <Linha
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Validade passaporte"
              value={passageiro.validade_passaporte ? formatDate(passageiro.validade_passaporte) : null}
            />
            <Linha
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Nascimento"
              value={passageiro.data_nascimento ? formatDate(passageiro.data_nascimento) : null}
            />
            <Linha icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={passageiro.email} />
            <Linha icon={<Phone className="h-3.5 w-3.5" />} label="Telefone" value={passageiro.telefone} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aniversário na viagem</CardTitle>
          </CardHeader>
          <CardContent className="text-[13px]">
            {aniv ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-lista-100 px-2.5 py-1 text-[12px] font-medium text-lista-600">
                🎂 Faz aniversário em {formatDate(aniv.data)}{aniv.idade != null ? ` (${aniv.idade} anos)` : ""}
              </span>
            ) : (
              <span className="text-muted-foreground">Não faz aniversário durante esta viagem.</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent className="text-[13px] whitespace-pre-wrap">
            {passageiro.observacoes || <span className="text-muted-foreground">—</span>}
          </CardContent>
        </Card>
      </div>

      {temPerfil && pv && (
        <Card>
          <CardHeader>
            <CardTitle>Perfil &amp; conexões</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-1.5 text-[13px] sm:grid-cols-2">
            <Linha label="Profissão" value={pv.profissao} />
            <Linha label="Como se descreve em grupo" value={pv.descricao_grupo} />
            <Linha label="O que mais te anima" value={pv.anima_expedicao} />
            <Linha label="Significado da expedição" value={pv.significado} />
            <Linha label="Instagram" value={pv.instagram} />
            <Linha label="Camiseta" value={pv.camiseta} />
            <Linha label="Música preferida" value={pv.musica} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Documentos do passageiro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PassaporteAnexo
            expedicaoId={id}
            passageiroId={paxId}
            arquivoId={passageiro.passaporte_arquivo_id}
          />
          <Drive
            expedicaoId={id}
            passageiroId={paxId}
            arquivos={arquivos}
            categorias={CATEGORIAS_SEM_DOC_PESSOAL}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Linha({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground text-[12px]">
        {icon}
        {label}
      </span>
      <span className={value ? "font-medium" : "text-muted-foreground italic"}>
        {value || "—"}
      </span>
    </div>
  );
}
