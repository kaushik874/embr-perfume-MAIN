import React from "react";
import { WifiOff, RotateCcw } from "lucide-react";

interface QueryErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function QueryErrorState({
  title = "Unable to load the latest content",
  message = "Please check your internet connection and try again.",
  onRetry,
  className = "",
}: QueryErrorStateProps) {
  return (
    <div
      className={`mx-auto flex max-w-md flex-col items-center justify-center px-4 py-16 text-center ${className}`}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-charcoal/5 text-ink-muted">
        <WifiOff className="h-6 w-6 text-gold-deep" />
      </div>
      <h3 className="font-serif text-xl sm:text-2xl text-ink">{title}</h3>
      <p className="mt-2 text-sm text-ink-muted leading-relaxed">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-gold px-6 py-2.5 text-xs sm:text-sm font-medium tracking-wider text-charcoal shadow-gold transition-all hover:scale-[1.03] active:scale-[0.98]"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}
