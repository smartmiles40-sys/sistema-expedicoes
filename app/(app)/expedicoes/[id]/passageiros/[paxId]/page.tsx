import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, IdCard, Calendar } from "lucide-react";
import { getPassageiro } from "@/lib/data/expedicoes";
import { listArquivosPassageiro } from "@/lib/data/arquivos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Drive } from "@/components/arquivos/Drive";
import { formatDate } from "@/lib/utils";
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
  const [passageiro, arquivos] = await Promise.all([
    getPassageiro(paxId),
    listArquivosPassageiro(paxId),
  ]);
  if (!passageiro || passageiro.expedicao_id !== id) notFound();

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
            <CardTitle>Voo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-[13px]">
            <Linha label="Companhia" value={passageiro.companhia_aerea} />
            <Linha label="Localizador" value={passageiro.localizador} />
            <Linha
              label="Voo nacional"
              value={passageiro.voo_nacional_necessario ? "Necessário" : "Não"}
            />
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

      <Card>
        <CardHeader>
          <CardTitle>Drive — arquivos do passageiro</CardTitle>
        </CardHeader>
        <CardContent>
          <Drive
            expedicaoId={id}
            passageiroId={paxId}
            arquivos={arquivos}
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
