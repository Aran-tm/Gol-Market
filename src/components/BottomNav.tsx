import { useLocation, useNavigate } from "react-router-dom";
import { Radio, ShieldCheck, Trophy, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
}

const ITEMS: NavItem[] = [
  { icon: Radio, label: "Markets", path: "/" },
  { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
  { icon: ShieldCheck, label: "Resolutions", path: "/resolutions" },
  { icon: User, label: "Profile", path: "/profile" },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-safe">
      <div className="pointer-events-auto mx-auto flex w-full max-w-md items-center justify-around border-t border-white/10 bg-ink-950/80 px-2 py-2 backdrop-blur-xl">
        {ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition ${
                active ? "text-grass" : "text-white/55 hover:text-white/70"
              }`}
            >
              <item.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
