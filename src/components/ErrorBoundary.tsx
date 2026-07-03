import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Catches render errors that would otherwise leave a blank white screen with no recovery. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("GolMarket crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl">⚽💥</p>
        <h1 className="mt-4 text-xl font-black text-white">Something went wrong</h1>
        <p className="mt-2 text-sm text-white/50">GolMarket hit an unexpected error. Reloading usually fixes it.</p>
        <button onClick={() => location.reload()} className="btn-primary mt-6 px-8">
          Reload
        </button>
      </main>
    );
  }
}
