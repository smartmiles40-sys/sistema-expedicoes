"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { alterarPapelUsuario } from "./actions";
import { PAPEIS_ATRIBUIVEIS, PAPEL_LABEL, type PapelUsuario } from "@/lib/constants";

/**
 * Seletor de papel de um usuário (admin). Oferece os 3 perfis em uso
 * (admin/operacional/relacionamento). Não aparece para a própria conta.
 */
export function MudarPapelSelect({
  usuarioId, papelAtual, isSelf,
}: {
  usuarioId: string;
  papelAtual: PapelUsuario;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [salvando, setSalvando] = React.useState(false);

  if (isSelf) return <span className="text-[11px] text-muted-foreground">(você)</span>;

  // Se o papel atual não está nos atribuíveis (comercial/financeiro/leitura antigos),
  // inclui ele na lista pra não trocar sem querer.
  const opcoes: PapelUsuario[] = PAPEIS_ATRIBUIVEIS.includes(papelAtual)
    ? PAPEIS_ATRIBUIVEIS
    : [papelAtual, ...PAPEIS_ATRIBUIVEIS];

  async function mudar(novo: PapelUsuario) {
    if (novo === papelAtual) return;
    setSalvando(true);
    const r = await alterarPapelUsuario(usuarioId, novo);
    setSalvando(false);
    if (r.ok) {
      toast.success(`Papel alterado para ${PAPEL_LABEL[novo]}`);
      router.refresh();
    } else {
      toast.error("Não foi possível mudar o papel", { description: r.error });
    }
  }

  return (
    <select
      value={papelAtual}
      disabled={salvando}
      onChange={(e) => mudar(e.target.value as PapelUsuario)}
      title="Mudar papel"
      className="rounded-md border border-border bg-background px-2 py-1 text-[12px] outline-none focus:ring-2 focus:ring-editavel-600 disabled:opacity-60"
    >
      {opcoes.map((p) => (
        <option key={p} value={p}>{PAPEL_LABEL[p]}</option>
      ))}
    </select>
  );
}
