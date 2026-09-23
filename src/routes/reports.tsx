import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { fetchReports, deleteReport } from "@/lib/data.functions";
import type { Report } from "@/lib/data.functions";
import { FileText, RefreshCw, Trash2, Upload } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import ReportUploader from "@/components/ReportUploader";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const [reports, setReports] = React.useState<Report[]>([]);
  const [loading, setLoading] = React.useState(true);

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
    if (!confirm("Delete this report and all its data?")) return;
    try {
      await deleteReport({ data: { id, filename } });
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Failed to delete report:", err);
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

      {/* Upload section */}
      <ReportUploader onUploadSuccess={loadReports} />

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
                  <td className="px-4 py-3 text-sm text-gray-900">{report.filename}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{report.quarter ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{report.year ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {report.extracted_at ? new Date(report.extracted_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => handleDelete(report.id, report.filename)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
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
