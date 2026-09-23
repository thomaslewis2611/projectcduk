import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import IndexChart from "@/components/IndexChart";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/charts")({
  component: ChartsPage,
});

function ChartsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Data Visualisations</h1>
        <p className="text-sm text-gray-500 mt-1">
          Interactive charts showing price index trends across regions and building types.
        </p>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <BarChart3 size={20} />
          Price Index Trend Chart
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Use the filters to view trends for specific regions, building types, and years.
        </p>
        <div className="h-[600px]">
          <IndexChart />
        </div>
      </div>
    </div>
  );
}
