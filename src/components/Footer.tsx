import { Link } from "@tanstack/react-router";
import { PricemarkWordmark } from "@/components/Brand";

export default function Footer() {
  return (
    <footer className="bg-forest-deep text-lime mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid gap-8 md:grid-cols-3">
        <div>
          <PricemarkWordmark />
          <p className="mt-3 text-sm text-lime/65 max-w-xs">
            UK construction tender price inflation, tracked report by report.
          </p>
        </div>
        <nav className="flex flex-col gap-2 text-sm">
          <Link to="/forecasts" className="text-lime/75 hover:text-lime">
            Forecasts
          </Link>
          <Link to="/calculator" className="text-lime/75 hover:text-lime">
            Escalation calculator
          </Link>
          <Link to="/reports" className="text-lime/75 hover:text-lime">
            Source reports
          </Link>
        </nav>
        <p className="text-xs text-lime/55 md:text-right self-end">
          Forecasts are published by the consultants credited on each page. They are regional
          averages and a guide only.
        </p>
      </div>
    </footer>
  );
}
