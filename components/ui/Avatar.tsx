import { cn } from "@/lib/utils";

export function Avatar({
  nome,
  size = 28,
  className,
  src,
}: {
  nome: string | null | undefined;
  size?: number;
  className?: string;
  /** URL da foto; se presente, mostra a imagem no lugar das iniciais. */
  src?: string | null;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={nome ?? ""}
        className={cn("inline-block shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

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
