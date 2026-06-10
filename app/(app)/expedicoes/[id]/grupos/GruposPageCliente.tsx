"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { EditableCell } from "@/components/tables/EditableCell";
import type { GrupoExpedicaoRow } from "@/types/database";
import { criarGrupo, atualizarGrupoCampo, deletarGrupo } from "./actions";

interface Props {
  expedicaoId: string;
  grupos: GrupoExpedicaoRow[];
}

export function GruposPageCliente({ expedicaoId, grupos }: Props) {
  const router = useRouter();
  const [criando, setCriando] = React.useState(false);
  const [novoNome, setNovoNome] = React.useState("");

  async function adicionar() {
    if (!novoNome.trim()) {
      toast.error("Dá um nome pro grupo (ex: G1, G2…)");
      return;
    }
    setCriando(true);
    const r = await criarGrupo({
      expedicao_id: expedicaoId,
      nome: novoNome.trim(),
      pax_planejados: 0,
    });
    setCriando(false);
    if (!r.ok) {
      toast.error("Erro ao criar grupo", { description: r.error });
      return;
    }
    setNovoNome("");
    toast.success(`Grupo "${novoNome.trim()}" criado`);
    router.refresh();
  }

  async function remover(grupo: GrupoExpedicaoRow) {
    if (!confirm(`Remover grupo "${grupo.nome}"? Passageiros vinculados ficarão sem grupo.`)) return;
    const r = await deletarGrupo(grupo.id, expedicaoId);
    if (!r.ok) {
      toast.error("Erro ao remover", { description: r.error });
      return;
    }
    toast.success("Grupo removido");
    router.refresh();
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Grupos</h2>
          <p className="text-xs text-muted-foreground">
            Crie subgrupos (G1, G2, G3…) com datas próprias dentro desta expedição.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Nome do grupo (ex: G1)"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
            className="w-48"
          />
          <Button onClick={adicionar} disabled={criando} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </Button>
        </div>
      </div>

      {grupos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">Nenhum grupo ainda</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Útil quando a mesma expedição tem várias saídas com datas diferentes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {grupos.map((g) => (
            <Card key={g.id}>
              <CardContent className="pt-3 space-y-2">
                <div className="flex items-start justify-between">
                  <EditableCell
                    value={g.nome}
                    onSave={async (v) => {
                      const r = await atualizarGrupoCampo(g.id, expedicaoId, "nome", v ?? "");
                      router.refresh();
                      return r;
                    }}
                    className="text-base font-semibold"
                  />
                  <button
                    onClick={() => remover(g)}
                    className="text-muted-foreground hover:text-critico-600 p-1"
                    title="Remover grupo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                      Embarque
                    </span>
                    <EditableCell
                      value={g.data_embarque ? g.data_embarque.slice(0, 10) : null}
                      type="date"
                      onSave={async (v) => {
                        const r = await atualizarGrupoCampo(g.id, expedicaoId, "data_embarque", v);
                        router.refresh();
                        return r;
                      }}
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                      Retorno
                    </span>
                    <EditableCell
                      value={g.data_retorno ? g.data_retorno.slice(0, 10) : null}
                      type="date"
                      onSave={async (v) => {
                        const r = await atualizarGrupoCampo(g.id, expedicaoId, "data_retorno", v);
                        router.refresh();
                        return r;
                      }}
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                      Pax planejados
                    </span>
                    <EditableCell
                      value={g.pax_planejados}
                      type="number"
                      onSave={async (v) => {
                        const r = await atualizarGrupoCampo(
                          g.id,
                          expedicaoId,
                          "pax_planejados",
                          v == null ? 0 : Number(v),
                        );
                        router.refresh();
                        return r;
                      }}
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                      Observações
                    </span>
                    <EditableCell
                      value={g.observacoes}
                      onSave={async (v) => {
                        const r = await atualizarGrupoCampo(g.id, expedicaoId, "observacoes", v);
                        router.refresh();
                        return r;
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
