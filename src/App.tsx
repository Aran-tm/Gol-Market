import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, NavLink } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Markets from "./pages/Markets";
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
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <NavLink to="/" className="mr-auto text-lg font-bold tracking-tight">
          Gol<span className="text-grass">Market</span>
        </NavLink>
        <WalletMultiButton />
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-ink text-white">
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
