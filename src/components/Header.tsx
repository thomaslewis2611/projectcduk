import { Link, useRouter } from "@tanstack/react-router";
import { PricemarkWordmark } from "@/components/Brand";
import { signOut, useAdmin } from "@/lib/use-admin";

const NAV = [
  { to: "/forecasts", label: "Forecasts" },
  { to: "/reports", label: "Reports" },
] as const;

export default function Header() {
  const router = useRouter();
  const currentPath = router.state.location.pathname;
  const { session } = useAdmin();

  const navLink = (to: string, label: string) => (
    <Link
      key={to}
      to={to}
      className={`text-sm font-medium transition-colors ${
        currentPath === to ? "text-lime" : "text-lime/70 hover:text-lime"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="bg-forest border-b border-lime/20 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to="/" className="text-lime" aria-label="Pricemark home">
            <PricemarkWordmark />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {NAV.map(({ to, label }) => navLink(to, label))}
          </nav>

          <div className="flex items-center gap-4">
            {session ? (
              <button
                onClick={() => signOut()}
                className="hidden sm:block text-sm text-lime/70 hover:text-lime"
                title={session.user.email ?? undefined}
              >
                Sign out
              </button>
            ) : (
              <Link to="/login" className="hidden sm:block text-sm text-lime/70 hover:text-lime">
                Admin
              </Link>
            )}
            <Link to="/calculator" className="btn btn-lime">
              Calculator
            </Link>
          </div>
        </div>

        {/* Small screens: links on their own row */}
        <nav className="md:hidden flex items-center gap-6 pb-3 -mt-1">
          {NAV.map(({ to, label }) => navLink(to, label))}
          {session ? (
            <button onClick={() => signOut()} className="text-sm text-lime/70 sm:hidden">
              Sign out
            </button>
          ) : (
            <Link to="/login" className="text-sm text-lime/70 sm:hidden">
              Admin
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
