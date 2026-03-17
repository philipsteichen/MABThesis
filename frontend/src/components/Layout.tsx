import { NavLink } from "react-router-dom";
import { LayoutDashboard, BarChart3, TrendingUp, LineChart } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/analysis", label: "Basis Analysis", icon: BarChart3 },
  { to: "/forecast", label: "Basis Forecast", icon: TrendingUp },
  { to: "/price-forecast", label: "Price Forecast", icon: LineChart },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-kstate-purple text-white flex flex-col shrink-0">
        {/* K-State / MAB header */}
        <div className="px-5 pt-3 pb-4 border-b border-white/10 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-wheat-200">
            Kansas State University
          </p>
          <p className="text-[11px] text-white/50 mt-0.5">
            College of Agriculture
          </p>
          <div className="w-10 h-px bg-white/20 mx-auto mt-2 mb-2" />
          <h1 className="text-base font-bold leading-snug">
            Master of Agribusiness
          </h1>
          <p className="text-xs text-wheat-100 mt-1 font-medium">
            Basis Spread Analyzer
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3">
          <p className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
            Analysis
          </p>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-white/15 text-white font-semibold border-r-2 border-wheat-200"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-5 border-t border-white/10">
          <p className="text-xs font-medium text-white/80">Phil Steichen</p>
          <p className="text-[11px] text-white/40 mt-0.5">MAB Thesis Project</p>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-wheat-200" />
            <p className="text-[10px] text-white/30">
              K-State MAB &middot; Est. 1998
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100 px-8 py-3 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-wheat-300" />
            <span className="text-xs text-slate-400">
              HRW Wheat &middot; Kansas
            </span>
          </div>
        </div>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
