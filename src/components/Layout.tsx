import { Link, Outlet, useLocation } from "react-router-dom";
import { brand } from "@/config/brand";
import { Wordmark } from "@/components/Wordmark";

const secondaryNav = [
  { to: "/history", label: "History" },
  { to: "/methodology", label: "Methodology" },
  { to: "/settings", label: "Settings" },
];

export function Layout() {
  const { pathname } = useLocation();
  const isLanding = pathname === "/";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="fixed top-0 w-full z-50 bg-surface-900/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-4">
          <Wordmark />
          <nav className="flex items-center gap-4 sm:gap-8">
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-text-muted">
              {secondaryNav.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`transition-colors hover:text-white ${
                    pathname === to ? "text-white" : ""
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
            <Link
              to="/"
              className={`shrink-0 px-4 sm:px-5 py-2 rounded-full font-bold text-sm transition-all transform hover:scale-105 ${
                isLanding
                  ? "bg-wrap-500 text-black hover:bg-white"
                  : "bg-white/10 text-white hover:bg-wrap-500 hover:text-black"
              }`}
            >
              {brand.navUpload}
            </Link>
          </nav>
        </div>
      </header>

      <main
        className={`flex-1 w-full mx-auto px-6 pt-20 ${
          isLanding ? "max-w-7xl pb-20" : "max-w-5xl py-8"
        }`}
      >
        <Outlet />
      </main>

      <footer className="py-12 border-t border-white/5 text-center text-sm text-text-muted/40">
        <p>
          © {new Date().getFullYear()} {brand.name}. {brand.footerPrivacy}
        </p>
      </footer>
    </div>
  );
}
