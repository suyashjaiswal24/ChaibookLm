import { cn } from "@/lib/utils";
import { statusMeta } from "@/lib/sourceStatus";

function StatusDot({ status, className }) {
  const meta = statusMeta(status);
  return (
    <span
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", meta.dotClass, className, {
        "animate-pulse-dot": meta.pulse,
      })}
      title={meta.label}
    />
  );
}

export default StatusDot;
