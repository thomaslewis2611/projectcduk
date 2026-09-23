import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { fetchReports, deleteReport } from "@/lib/data.functions";
import type { Report } from "@/lib/data.functions";
import { FileText, RefreshCw, Trash2, Upload } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import ReportUploader from "@/components/ReportUploader";
import { useAdmin } from "@/lib/use-admin";
import { Link } from "@tanstack/react-router";

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your uploaded price index report PDFs.
          </p>
        </div>
        <button onClick={loadReports} className="btn btn-outline">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Upload section (admin only) */}
      {isAdmin && session ? (
        <ReportUploader accessToken={session.access_token} onUploadSuccess={loadReports} />
      ) : (
        <p className="text-sm text-gray-500">
          <Link to="/login" className="text-cpi-blue hover:underline">
            Sign in as admin
          </Link>{" "}
          to upload or delete reports.
        </p>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Reports list */}
      {loading ? (
        <div className="py-8 text-center text-gray-500">Loading…</div>
      ) : reports.length === 0 ? (
        <div className="card text-center py-12">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No reports uploaded yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Filename
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Quarter
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Year
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Extracted
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <StatusBadge status={report.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {report.title ?? report.filename}
                    {report.title && <div className="text-xs text-gray-500">{report.filename}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{report.quarter ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{report.year ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {report.extracted_at ? new Date(report.extracted_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(report.id, report.filename)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
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
  );
}
