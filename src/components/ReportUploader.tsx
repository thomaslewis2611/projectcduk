import * as React from "react";
import { uploadAndParseReport } from "@/lib/pdf-parser";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";

type ReportUploaderProps = {
  onUploadSuccess?: () => void;
};

export default function ReportUploader({ onUploadSuccess }: ReportUploaderProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);
    const selected = e.target.files?.[0] ?? null;
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
    } else if (selected) {
      setError("Please select a valid PDF file.");
      setFile(null);
    }
  };

  const onUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Read file as base64 for server function
      const base64 = await readFileAsBase64(file);
      const result = await uploadAndParseReport({
        data: { filename: file.name, base64 },
      });

      if (result.status === "no_data") {
        setError(
          `"${file.name}" was uploaded, but no data rows were recognised. The report layout may not be supported yet.`,
        );
      } else {
        setSuccess(`"${file.name}" imported: ${result.dataPoints} data points.`);
      }
      setFile(null);
      const input = document.getElementById("file-input") as HTMLInputElement;
      if (input) input.value = "";
      onUploadSuccess?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed. Check the backend is running.");
    } finally {
      setUploading(false);
    }
  };

  function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        // Strip the data:application/pdf;base64, prefix
        const base64 = dataUrl.split(",")[1] ?? "";
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Upload size={20} />
        Upload a Price Index Report
      </h3>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-cpi-blue hover:bg-gray-50 transition-colors">
        <input
          id="file-input"
          type="file"
          accept="application/pdf"
          onChange={onFileChange}
          className="hidden"
        />
        <label htmlFor="file-input" className="cursor-pointer flex flex-col items-center">
          <FileText size={48} className="text-gray-400 mb-2" />
          <span className="text-sm text-gray-600">
            {file ? file.name : "Click to select a PDF report"}
          </span>
          <span className="text-xs text-gray-400 mt-1">
            {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "PDF, up to 50 MB"}
          </span>
        </label>
      </div>

      {file && (
        <button onClick={onUpload} disabled={uploading} className="btn btn-primary w-full mt-4">
          {uploading ? "Uploading & processing…" : "Upload & Process"}
        </button>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} className="text-red-600" />
          <span className="text-sm text-red-800">{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <CheckCircle size={16} className="text-green-600" />
          <span className="text-sm text-green-800">{success}</span>
        </div>
      )}
    </div>
  );
}
