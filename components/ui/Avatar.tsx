import { cn } from "@/lib/utils";

export function Avatar({
  nome,
  size = 28,
  className,
}: {
  nome: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const initials = (nome ?? "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // hash → cor estável
  const colors = [
    "bg-editavel-100 text-editavel-600",
    "bg-vinculado-100 text-vinculado-600",
    "bg-atencao-100 text-atencao-600",
    "bg-lista-100 text-lista-600",
  ];
  const idx = (nome ?? "")
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold",
        colors[idx],
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials || "?"}
    </div>
  );
}
