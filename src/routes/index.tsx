import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  fetchReports,
  fetchRegions,
  fetchBuildingTypes,
  fetchYears,
  fetchDataPointCount,
} from "@/lib/data.functions";
import type { Report } from "@/lib/data.functions";
import { FileText, TrendingUp, BarChart3, Upload } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [reports, setReports] = React.useState<Report[]>([]);
  const [regions, setRegions] = React.useState<string[]>([]);
  const [buildingTypes, setBuildingTypes] = React.useState<string[]>([]);
  const [years, setYears] = React.useState<number[]>([]);
  const [totalDataPoints, setTotalDataPoints] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const load = async () => {
      try {
        const [reportsData, regionsData, bts, yearsData, dataPointCount] = await Promise.all([
          fetchReports(),
          fetchRegions(),
          fetchBuildingTypes(),
          fetchYears(),
          fetchDataPointCount(),
        ]);

        setReports(reportsData);
        setRegions(regionsData);
        setBuildingTypes(bts);
        setYears(yearsData);
        setTotalDataPoints(dataPointCount);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const completedReports = reports.filter((r) => r.status === "completed").length;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold text-gradient mb-2">UK Construction Price Index</h1>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          Analysis tool for UK construction price data. Explore price trends, compare build costs
          across regions and building types, and ask questions using AI-powered chat.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-bold text-cpi-blue">{reports.length}</div>
          <p className="text-sm text-gray-600 mt-1">Reports Ingested</p>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-cpi-green">{totalDataPoints}</div>
          <p className="text-sm text-gray-600 mt-1">Data Points</p>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-cpi-orange">{regions.length}</div>
          <p className="text-sm text-gray-600 mt-1">Regions</p>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-purple-600">{buildingTypes.length}</div>
          <p className="text-sm text-gray-600 mt-1">Building Types</p>
        </div>
      </div>

      {/* Upload CTA + Recent Reports */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Upload size={20} />
              Upload a Report
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload PDF price index reports to start building your data set.
            </p>
            <Link to="/reports" className="btn btn-primary w-full flex justify-center">
              Go to Reports
            </Link>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText size={20} />
              Recent Reports
            </h3>
            {loading ? (
              <p className="text-gray-500">Loading…</p>
            ) : reports.length === 0 ? (
              <p className="text-gray-400 text-sm">No reports uploaded yet.</p>
            ) : (
              <div className="space-y-3">
                {reports.slice(0, 5).map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{report.title || report.filename}</p>
                      <p className="text-sm text-gray-600">
                        {report.quarter && `${report.quarter} · `}
                        {report.year}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        report.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : report.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {report.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart placeholder */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <TrendingUp size={20} />
          Price Index Trends
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Filter by region, building type, and year to see how prices have changed over time.
        </p>
        {reports.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400">
            <TrendingUp size={48} className="mb-3 opacity-30" />
            <p>Upload reports to see trend charts.</p>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center">
            <Link to="/charts" className="text-cpi-blue hover:underline text-sm font-medium">
              Go to Charts page
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
