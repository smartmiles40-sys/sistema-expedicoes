import { listCambios } from "@/lib/data/cambios";
import { CambiosTabela } from "./CambiosTabela";

export const metadata = { title: "Câmbios" };
export const revalidate = 3600;

export default async function CambiosPage() {
  const cambios = await listCambios();
  return (
    <div className="p-4">
      <CambiosTabela cambios={cambios} />
    </div>
  );
}
