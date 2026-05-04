import { listUsuarios } from "@/lib/data/expedicoes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { MARGEM_MINIMA, MARGEM_IDEAL, PROVISAO_EXTRA_PADRAO } from "@/lib/constants";
import { formatPercent } from "@/lib/utils";
import { getCurrentUser } from "@/lib/supabase/auth";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const [usuarios, currentUser] = await Promise.all([listUsuarios(), getCurrentUser()]);
  const isAdmin = currentUser?.papel === "admin";

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Configurações</h1>
        <p className="text-xs text-muted-foreground">Usuários, constantes do negócio, templates</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <CardTitle>Usuários ({usuarios.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {!isAdmin && (
              <p className="text-xs text-atencao-600 mb-2">
                Apenas admins podem promover/demover usuários.
              </p>
            )}
            {usuarios.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-md p-2 hover:bg-accent/40">
                <div className="flex items-center gap-2">
                  <Avatar nome={u.nome} size={28} />
                  <div>
                    <div className="text-[13px] font-medium">{u.nome}</div>
                    <div className="text-[11px] text-muted-foreground">{u.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="lista">{u.papel}</Badge>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" disabled>
                      Mudar papel
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Constantes do negócio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Constant label="Margem mínima" value={formatPercent(MARGEM_MINIMA, 0)} hint="Abaixo disso a expedição é marcada em vermelho." />
            <Constant label="Margem ideal" value={formatPercent(MARGEM_IDEAL, 0)} hint="Meta. Verde a partir desse valor." />
            <Constant label="Provisão extra padrão" value={formatPercent(PROVISAO_EXTRA_PADRAO, 0)} hint="Reserva sobre custos planejados." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Templates de checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Por tipo de destino. <span className="text-atencao-600">A implementar.</span>
            </p>
            <ul className="mt-2 space-y-1 text-[12px]">
              <li className="flex items-center justify-between rounded p-1.5 hover:bg-accent/40">
                <span>América do Sul (sem visto)</span>
                <Badge variant="auto">10 itens</Badge>
              </li>
              <li className="flex items-center justify-between rounded p-1.5 hover:bg-accent/40">
                <span>Europa (Schengen)</span>
                <Badge variant="auto">14 itens</Badge>
              </li>
              <li className="flex items-center justify-between rounded p-1.5 hover:bg-accent/40">
                <span>Ásia (visto on-arrival)</span>
                <Badge variant="auto">12 itens</Badge>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[13px]">
            <IntegrationRow label="Bitrix24 CRM" status="configurar" />
            <IntegrationRow label="n8n webhooks" status="configurar" />
            <IntegrationRow label="Banco Central (câmbios)" status="configurar" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Constant({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <div className="text-[13px] font-medium">{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </div>
      <span className="font-mono text-[13px] tabular-nums">{value}</span>
    </div>
  );
}

function IntegrationRow({ label, status }: { label: string; status: "ok" | "configurar" }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <Badge variant={status === "ok" ? "vinculado" : "atencao"}>
        {status === "ok" ? "Conectado" : "Configurar"}
      </Badge>
    </div>
  );
}
