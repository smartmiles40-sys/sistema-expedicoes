import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        outline: "border border-border bg-transparent",
        editavel: "bg-editavel-100 text-editavel-600",
        auto: "bg-auto-100 text-auto-600",
        vinculado: "bg-vinculado-100 text-vinculado-600",
        atencao: "bg-atencao-100 text-atencao-600",
        critico: "bg-critico-100 text-critico-600",
        lista: "bg-lista-100 text-lista-600",
        success: "bg-vinculado-100 text-vinculado-600",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
