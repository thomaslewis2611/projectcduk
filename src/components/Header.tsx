import { Link, useRouter } from "@tanstack/react-router";
import {
  Home,
  Upload,
  BarChart3,
  MessageCircle,
  GitCompare,
  LogIn,
  LogOut,
  TrendingUp,
} from "lucide-react";
import { signOut, useAdmin } from "@/lib/use-admin";

export default function Header() {
  const router = useRouter();
  const currentPath = router.state.location.pathname;
  const { session } = useAdmin();

  const navItems = [
    { to: "/", label: "Dashboard", icon: Home },
    { to: "/forecasts", label: "Forecasts", icon: TrendingUp },
    { to: "/reports", label: "Reports", icon: Upload },
    { to: "/compare", label: "Compare", icon: GitCompare },
    { to: "/charts", label: "Charts", icon: BarChart3 },
    { to: "/chat", label: "AI Chat", icon: MessageCircle },
  ];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="text-2xl font-bold text-gradient">
            Project CPD UK
          </Link>

          <nav className="flex items-center space-x-1">
            {navItems.map(({ to, label, icon: Icon }) => {
              const isActive = currentPath === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive ? "bg-cpi-blue/10 text-cpi-blue" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              );
            })}
            {session ? (
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-gray-500 hover:bg-gray-100"
                title={session.user.email ?? undefined}
              >
                <LogOut size={18} />
                Sign out
              </button>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <LogIn size={18} />
                Admin
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
