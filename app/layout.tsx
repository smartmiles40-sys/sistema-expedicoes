import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import "./globals.css";

// Corpo: Inter (mesma do site). Títulos: Fraunces (serifa elegante de alto
// contraste, no espírito da IvyPresto/Moret usadas no site da agência).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: "Sistema Operacional de Expedições",
  description: "Se Tu For, Eu Vou — gestão de expedições",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: "border border-border bg-background text-foreground",
                error: "!bg-critico-50 !text-critico-600 !border-critico-100",
                success: "!bg-vinculado-50 !text-vinculado-600 !border-vinculado-100",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
