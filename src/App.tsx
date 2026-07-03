import { Routes, Route, Navigate, NavLink } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { cn } from "./lib/cn";
import Markets from "./pages/Markets";
import Leaderboard from "./pages/Leaderboard";

function Header() {
  const link = ({ isActive }: { isActive: boolean }) =>
    cn(
      "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
      isActive ? "bg-white/10 text-white" : "text-white/60 hover:text-white",
    );
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <NavLink to="/" className="mr-auto text-lg font-bold tracking-tight">
          Gol<span className="text-grass">Market</span>
        </NavLink>
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={link}>
            Markets
          </NavLink>
          <NavLink to="/leaderboard" className={link}>
            Leaderboard
          </NavLink>
        </nav>
        <WalletMultiButton style={{ height: 36, fontSize: 13, borderRadius: 10 }} />
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-ink text-white">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Routes>
          <Route index element={<Markets />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
