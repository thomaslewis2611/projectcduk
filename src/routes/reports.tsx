import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { fetchReports, deleteReport } from "@/lib/data.functions";
import type { Report } from "@/lib/data.functions";
import { FileText, RefreshCw, Trash2 } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import PageHeader from "@/components/PageHeader";
import { useAdmin } from "@/lib/use-admin";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const [reports, setReports] = React.useState<Report[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { session, isAdmin } = useAdmin();

  const loadReports = async () => {
    try {
      const data = await fetchReports();
      setReports(data);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadReports();
  }, []);

  const handleDelete = async (id: number, filename: string) => {
    if (!session || !confirm("Delete this report and all its data?")) return;
    setError(null);
    try {
      await deleteReport({ data: { accessToken: session.access_token, id, filename } });
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Failed to delete report:", err);
      setError(err instanceof Error ? err.message : "Failed to delete report.");
    }
  };

  return (
    <>
      <PageHeader eyebrow="Sources" title="Source reports">
        The consultants' reports the forecasts come from, newest first.
      </PageHeader>

      <div className="page space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {isAdmin ? (
              <>
                To add reports, run <code className="mono text-ink">npm run import-reports</code> on
                your computer (see the README). You can delete reports here.
              </>
            ) : (
              <>
                <span className="num text-ink">{reports.length}</span> reports
              </>
            )}
          </p>
          <button onClick={loadReports} className="btn btn-outline">
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="card text-center py-12 text-muted">Loading…</div>
        ) : reports.length === 0 ? (
          <div className="card text-center py-12">
            <FileText size={40} className="mx-auto text-line mb-4" />
            <p className="text-muted">No reports imported yet.</p>
          </div>
        ) : (
          <div className="card p-0 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-muted border-b border-line">
                  <th className="px-6 py-3">Report</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Imported</th>
                  <th className="px-6 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-paper">
                    <td className="px-6 py-4">
                      {report.title ?? report.filename}
                      {report.title && (
                        <div className="text-xs text-muted mono mt-0.5">{report.filename}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 num">{report.quarter ?? "—"}</td>
                    <td className="px-4 py-4">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="px-4 py-4 text-muted num">
                      {report.extracted_at
                        ? new Date(report.extracted_at).toLocaleDateString("en-GB")
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(report.id, report.filename)}
                          className="text-muted hover:text-red-700"
                          title="Delete"
                          aria-label={`Delete ${report.title ?? report.filename}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
