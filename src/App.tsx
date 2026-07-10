import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, NavLink } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Markets from "./pages/Markets";
import Background from "./components/Background";
import BottomNav from "./components/BottomNav";
import { Spinner } from "./components/ui";

// Only the index route (Markets) needs to be in the initial bundle — the other
// tabs load on demand, keeping first paint lean.
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Resolutions = lazy(() => import("./pages/Resolutions"));
const Profile = lazy(() => import("./pages/Profile"));

function PageFallback() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner className="h-6 w-6 text-white/40" />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <NavLink to="/" className="mr-auto flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-grass/30 bg-grass/10 text-base leading-none">
            ⚽
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            Gol<span className="text-gradient">Market</span>
          </span>
        </NavLink>
        <WalletMultiButton />
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="relative min-h-screen text-white">
      <Background />
      <Header />
      <main className="pb-nav mx-auto max-w-3xl px-4 py-6">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route index element={<Markets />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="resolutions" element={<Resolutions />} />
            <Route path="profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}
