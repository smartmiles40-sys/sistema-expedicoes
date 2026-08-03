import { listClientesCompras } from "@/lib/data/compras";
import { ClientesTabela } from "./ClientesTabela";

export const metadata = { title: "Clientes & compras" };

export default async function ClientesPage() {
  const clientes = await listClientesCompras();
  return (
    <div className="p-4">
      <ClientesTabela clientes={clientes} />
    </div>
  );
}
