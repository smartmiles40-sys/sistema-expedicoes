import { notFound } from "next/navigation";
import { getExpedicaoComAgregados } from "@/lib/data/expedicoes";
import { ExpedicaoHeader } from "./ExpedicaoHeader";
import { ExpedicaoTabsNav } from "./ExpedicaoTabsNav";
import { ExpedicaoRealtimeSync } from "./ExpedicaoRealtimeSync";

export default async function ExpedicaoLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const expedicao = await getExpedicaoComAgregados(id);
  if (!expedicao) notFound();

  return (
    <div className="flex flex-col h-full">
      <ExpedicaoRealtimeSync expedicaoId={id} />
      <ExpedicaoHeader expedicao={expedicao} />
      <ExpedicaoTabsNav expedicaoId={id} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
