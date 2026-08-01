import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";

type GoogleSignInButtonProps = {
  onCredential: (credential: string) => void;
  disabled?: boolean;
  text?: "signin_with" | "signup_with" | "continue_with";
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

function loadGsiScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google sign-in")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google sign-in"));
    document.head.appendChild(script);
  });
}

export function GoogleSignInButton({
  onCredential,
  disabled,
  text = "continue_with",
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);

  // Stabilize the callback ref so GIS doesn't re-render infinitely
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;
  const stableCallback = useCallback((credential: string) => {
    onCredentialRef.current(credential);
  }, []);

  useEffect(() => {
    api
      .publicConfig()
      .then((cfg) => setClientId(cfg.googleClientId || null))
      .catch(() => setClientId(null))
      .finally(() => setConfigLoaded(true));
  }, []);

  useEffect(() => {
    if (!clientId || !containerRef.current) return;

    let cancelled = false;

    loadGsiScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;
        containerRef.current.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential?: string }) => {
            if (response.credential) stableCallback(response.credential);
          },
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text,
          width: Math.min(400, containerRef.current.clientWidth || 400),
        });
        setGsiReady(true);
      })
      .catch(() => {
        // GIS failed to load — custom button stays visible
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, stableCallback, text]);

  // ─── Custom fallback button (always visible until GIS renders) ───
  const label =
    text === "signup_with"
      ? "Sign up with Google"
      : text === "signin_with"
        ? "Sign in with Google"
        : "Continue with Google";

  return (
    <div className={disabled ? "pointer-events-none opacity-50" : ""}>
      {/* GIS rendered button container — hidden until GIS actually renders */}
      <div
        ref={containerRef}
        className="flex min-h-[44px] justify-center"
        style={{ display: gsiReady ? undefined : "none" }}
      />

      {/* Custom fallback button — shown until GIS renders (or forever if GIS fails) */}
      {!gsiReady && (
        <button
          type="button"
          disabled={!configLoaded || disabled}
          onClick={() => {
            // If GIS is available but button just didn't render, try loading again
            if (clientId) {
              loadGsiScript()
                .then(() => {
                  if (containerRef.current && window.google?.accounts?.id) {
                    containerRef.current.innerHTML = "";
                    containerRef.current.style.display = "";
                    window.google.accounts.id.initialize({
                      client_id: clientId,
                      callback: (response: { credential?: string }) => {
                        if (response.credential) stableCallback(response.credential);
                      },
                    });
                    window.google.accounts.id.renderButton(containerRef.current, {
                      type: "standard",
                      theme: "outline",
                      size: "large",
                      text,
                      width: Math.min(400, containerRef.current.clientWidth || 400),
                    });
                    setGsiReady(true);
                  }
                })
                .catch(() => {
                  // Can't load GIS — redirect to standard OAuth flow
                  if (clientId) {
                    const redirect = `${window.location.origin}/auth/google/callback`;
                    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirect)}&response_type=token&scope=openid%20email%20profile`;
                  }
                });
            }
          }}
          className="flex w-full items-center justify-center gap-3 rounded border border-[#dadce0] bg-white px-4 py-2.5 text-sm font-medium text-[#3c4043] shadow-sm transition-shadow hover:shadow-md"
          style={{ fontFamily: "'Google Sans', Roboto, Arial, sans-serif", height: "44px" }}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>{label}</span>
        </button>
      )}
    </div>
  );
}
