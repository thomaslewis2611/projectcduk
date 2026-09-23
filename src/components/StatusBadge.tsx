type StatusBadgeProps = {
  status: string;
};

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-paper text-muted border-line" },
  processing: { label: "Processing", className: "bg-paper text-muted border-line" },
  completed: { label: "Imported", className: "bg-lime/60 text-forest border-leaf/25" },
  no_data: { label: "No data found", className: "bg-amber-50 text-amber-900 border-amber-200" },
  failed: { label: "Failed", className: "bg-red-50 text-red-800 border-red-200" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = statusConfig[status] ?? statusConfig.pending;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}
