import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import IndexChart from "@/components/IndexChart";
import IndexDataTable from "@/components/IndexDataTable";
import { BarChart3, GitCompare } from "lucide-react";

export const Route = createFileRoute("/compare")({
  component: ComparePage,
});

function ComparePage() {
  const [activeTab, setActiveTab] = React.useState<"chart" | "table">("chart");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Compare Price Indices</h1>
        <p className="text-sm text-gray-500 mt-1">
          Compare build costs and price indices across regions, building types, and time periods.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab("chart")}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "chart"
                ? "border-cpi-blue text-cpi-blue"
                : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
          >
            <BarChart3 size={16} className="inline mr-2" />
            Chart View
          </button>
          <button
            onClick={() => setActiveTab("table")}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "table"
                ? "border-cpi-blue text-cpi-blue"
                : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
          >
            <GitCompare size={16} className="inline mr-2" />
            Table View
          </button>
        </nav>
      </div>

      <div className="card">{activeTab === "chart" ? <IndexChart /> : <IndexDataTable />}</div>
    </div>
  );
}
