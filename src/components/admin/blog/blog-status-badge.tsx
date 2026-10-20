import { Badge } from "@/components/ui/badge";
import { DISPLAY_STATUS_LABEL, type BlogDisplayStatus } from "@/lib/blog/status";

const VARIANT = {
  DRAFT: "soft",
  SCHEDULED: "info",
  PUBLISHED: "success",
  ARCHIVED: "outline",
} as const satisfies Record<BlogDisplayStatus, "soft" | "info" | "success" | "outline">;

/** Pil status artikel — satu bentuk di daftar, editor, dan laporan. */
export function BlogStatusBadge({ status, className }: { status: BlogDisplayStatus; className?: string }) {
  return (
    <Badge variant={VARIANT[status]} className={className}>
      {DISPLAY_STATUS_LABEL[status]}
    </Badge>
  );
}
