import type { Metadata } from "next";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import "./globals.css";

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
    <html lang="pt-BR" suppressHydrationWarning>
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
