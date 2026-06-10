import { listLinks } from "@/lib/data/expedicoes";
import { LinksGrid } from "./LinksGrid";

export default async function LinksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const links = await listLinks(id);
  return <LinksGrid expedicaoId={id} links={links} />;
}
