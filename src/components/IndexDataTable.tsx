import * as React from "react";
import { fetchIndices, type PriceIndex } from "@/lib/data.functions";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

export default function IndexDataTable() {
  const [data, setData] = React.useState<PriceIndex[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const pageSize = 50;
  const [searchTerm, setSearchTerm] = React.useState("");

  React.useEffect(() => {
    const load = async () => {
      try {
        const result = await fetchIndices({
          data: { limit: 10000 },
        });
        setData(result);
      } catch (err) {
        console.error("Failed to fetch indices:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = data.filter((row) => {
    const s = searchTerm.toLowerCase();
    return (
      row.region?.name?.toLowerCase().includes(s) ||
      row.building_type?.name?.toLowerCase().includes(s) ||
      row.size_band?.label?.toLowerCase().includes(s) ||
      (row.index_value?.toString() ?? "").includes(s) ||
      (row.price_per_sqft?.toString() ?? "").includes(s)
    );
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  if (loading) {
    return <div className="py-8 text-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by region, building type, size band…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cpi-blue focus:border-transparent text-sm"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Year
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Quarter
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Region
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Building Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Size Band
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Index
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                £/sqft
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No data found.
                </td>
              </tr>
            ) : (
              paginated.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900">{row.year ?? "—"}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.quarter ?? "—"}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{row.region?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">
                    {row.building_type?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">{row.size_band?.label ?? "—"}</td>
                  <td className="px-4 py-2 text-right text-sm font-medium text-cpi-blue">
                    {row.index_value?.toFixed(1) ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-sm text-gray-700">
                    {row.price_per_sqft ? `£${row.price_per_sqft.toFixed(0)}` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages} ({filtered.length} records)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="btn btn-outline"
            >
              <ChevronLeft size={16} />
              Prev
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="btn btn-outline"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
