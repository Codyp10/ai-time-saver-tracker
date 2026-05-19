import { Link, Outlet, useLocation } from "react-router-dom";

const nav = [
  { to: "/", label: "Upload" },
  { to: "/history", label: "History" },
  { to: "/methodology", label: "Methodology" },
  { to: "/settings", label: "Settings" },
];

export function Layout() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="font-bold text-lg tracking-tight text-white">
            AI Time Saver
          </Link>
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
      <footer className="border-t border-white/10 py-6 text-center text-slate-400 text-sm">
        All processing happens in your browser. Your chats never leave your device.
      </footer>
    </div>
  );
}
