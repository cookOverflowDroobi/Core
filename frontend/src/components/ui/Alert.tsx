import { CircleAlert, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Alert({ tone, children, className }: { tone: "success" | "error"; children: ReactNode; className?: string }) {
  const Icon = tone === "success" ? CircleCheck : CircleAlert;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "mb-5 flex gap-2.5 rounded-xl px-3.5 py-3 text-sm",
        tone === "success" ? "bg-herb-soft text-herb" : "bg-danger-soft text-danger",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
