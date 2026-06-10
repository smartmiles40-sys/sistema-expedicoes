"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DEV_USE_MOCK_DATA } from "@/lib/dev-mode";
import { getServerClient } from "@/lib/supabase/typed";

const criarSchema = z.object({
  expedicao_id: z.string().min(1),
  nome: z.string().min(1).max(60),
  data_embarque: z.string().optional().nullable(),
  data_retorno: z.string().optional().nullable(),
  pax_planejados: z.number().int().min(0).default(0),
  observacoes: z.string().optional().nullable(),
});

export type CriarGrupoResult = { ok: true; id: string } | { ok: false; error: string };

export async function criarGrupo(input: z.infer<typeof criarSchema>): Promise<CriarGrupoResult> {
  const parsed = criarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  const data = parsed.data;

  if (DEV_USE_MOCK_DATA) {
    const id = `g${Math.random().toString(36).slice(2, 14)}`;
    return { ok: true, id };
  }

  const supabase = await getServerClient();
  const r = await supabase
    .from("grupos_expedicao")
    .insert({
      expedicao_id: data.expedicao_id,
      nome: data.nome,
      data_embarque: data.data_embarque ?? null,
      data_retorno: data.data_retorno ?? null,
      pax_planejados: data.pax_planejados,
      observacoes: data.observacoes ?? null,
    })
    .select("id")
    .single();
  if (r.error) return { ok: false, error: r.error.message };
  revalidatePath(`/expedicoes/${data.expedicao_id}`);
  revalidatePath(`/expedicoes/${data.expedicao_id}/grupos`);
  return { ok: true, id: (r.data as { id: string }).id };
}

const CAMPOS_EDITAVEIS = new Set(["nome", "data_embarque", "data_retorno", "pax_planejados", "observacoes", "ordem"]);

export async function atualizarGrupoCampo(
  grupoId: string,
  expedicaoId: string,
  campo: string,
  valor: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (!CAMPOS_EDITAVEIS.has(campo)) return { ok: false, error: `Campo "${campo}" não é editável` };
  if (DEV_USE_MOCK_DATA) {
    revalidatePath(`/expedicoes/${expedicaoId}/grupos`);
    return { ok: true };
  }
  const supabase = await getServerClient();
  const { error } = await supabase.from("grupos_expedicao").update({ [campo]: valor }).eq("id", grupoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/grupos`);
  return { ok: true };
}

export async function deletarGrupo(grupoId: string, expedicaoId: string): Promise<{ ok: boolean; error?: string }> {
  if (DEV_USE_MOCK_DATA) {
    revalidatePath(`/expedicoes/${expedicaoId}/grupos`);
    return { ok: true };
  }
  const supabase = await getServerClient();
  const { error } = await supabase.from("grupos_expedicao").delete().eq("id", grupoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expedicoes/${expedicaoId}/grupos`);
  return { ok: true };
}
