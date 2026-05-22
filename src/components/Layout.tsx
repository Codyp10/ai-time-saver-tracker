import { Link, Outlet, useLocation } from "react-router-dom";
import { brand } from "@/config/brand";
import { Wordmark } from "@/components/Wordmark";

const nav = [
  { to: "/", label: brand.navUpload },
  { to: "/history", label: "History" },
  { to: "/methodology", label: "Methodology" },
  { to: "/settings", label: "Settings" },
];

export function Layout() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Wordmark />
          <nav className="flex gap-1 sm:gap-2 text-sm">
            {nav.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-3 py-1.5 rounded-full transition-colors ${
                  pathname === to
                    ? "bg-brand-600 text-white"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-white/10 py-6 text-center text-slate-400 text-sm space-y-1">
        <p>{brand.footerPrivacy}</p>
        <p className="text-slate-500">
          {brand.name} · 100% in your browser
        </p>
      </footer>
    </div>
  );
}
