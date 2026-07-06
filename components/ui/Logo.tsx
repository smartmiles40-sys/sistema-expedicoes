// Marca "Se Tu For, Eu Vou" — logos oficiais servidos de /public/brand.
// `tone` = tom do FUNDO onde a logo aparece:
//   "dark"  → fundo escuro  → usa a versão off-white
//   "light" → fundo claro   → usa a versão dark-teal

export function Logo({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  const src = tone === "dark" ? "/brand/logo-horizontal-off-white.svg" : "/brand/logo-horizontal-dark-teal.svg";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Se Tu For, Eu Vou — Viagens" className={className} />;
}

export function LogoMark({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  const src = tone === "dark" ? "/brand/logo-circular-off-white.svg" : "/brand/logo-circular-dark-teal.svg";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Se Tu For, Eu Vou" className={className} />;
}
