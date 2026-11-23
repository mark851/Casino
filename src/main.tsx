import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class RootErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#050806] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-[#D4AF37]/40 bg-[#021D12] p-6 text-center space-y-4">
            <h1 className="font-display text-xl font-bold text-[#FFD76A]">CASINO ROYALE</h1>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Something interrupted rendering. Reload the page to continue.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="gold-shimmer-btn inline-flex items-center justify-center rounded-full px-6 py-2.5 text-xs font-bold cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
