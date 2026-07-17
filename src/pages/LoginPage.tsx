import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ShopLayout } from "@/components/layout/ShopLayout";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function LoginPage() {
  const { login, requestOtp, verifyOtp, loginWithGoogle } = useAuth();
  const [location, setLocation] = useLocation();
  const [mode, setMode] = useState<"otp" | "password">("otp");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [displayOtp, setDisplayOtp] = useState<string | null>(null);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = useMemo(() => {
    const url = new URL(location, window.location.origin);
    const n = url.searchParams.get("next");
    return n && n.startsWith("/") ? n : "/";
  }, [location]);

  const finishLogin = () => {
    toast.success("Welcome back");
    setLocation(next);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "otp") {
        if (!otpSent) {
          const result = await requestOtp(identifier.trim());
          setOtpSent(true);
          setDisplayOtp(result.demoOtp ?? null);
          setOtpMessage(result.message);
          if (result.demoOtp) {
            setOtp(result.demoOtp);
          }
          toast.success(result.demoOtp ? "Verification code ready" : result.message);
          return;
        }
        await verifyOtp(identifier.trim(), otp);
      } else {
        await login(identifier.trim(), password);
      }
      finishLogin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async (credential: string) => {
    setBusy(true);
    try {
      await loginWithGoogle(credential);
      finishLogin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ShopLayout promo="Sign in to checkout and track orders">
      <div className="mx-auto flex max-w-md flex-col px-6 py-16">
        <p className="font-display text-xs tracking-[0.4em] text-gold-deep">- ACCOUNT</p>
        <h1 className="mt-3 font-serif text-4xl text-ink">Sign In</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Login with email or mobile to access saved addresses and orders.
        </p>

        <div className="mt-8">
          <GoogleSignInButton onCredential={handleGoogle} disabled={busy} text="signin_with" />
        </div>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-ink-muted">
          <span className="h-px flex-1 bg-border-light" />
          or
          <span className="h-px flex-1 bg-border-light" />
        </div>

        <div className="grid grid-cols-2 rounded-full border border-border-light bg-white p-1 text-sm">
          <button
            type="button"
            onClick={() => {
              setMode("otp");
              setOtpSent(false);
              setDisplayOtp(null);
              setOtpMessage(null);
              setOtp("");
            }}
            className={`rounded-full px-4 py-2 ${mode === "otp" ? "bg-ink text-white" : "text-ink-muted"}`}
          >
            OTP
          </button>
          <button
            type="button"
            onClick={() => setMode("password")}
            className={`rounded-full px-4 py-2 ${mode === "password" ? "bg-ink text-white" : "text-ink-muted"}`}
          >
            Password
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-10 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="identifier" className="text-ink">
              Email or Mobile Number
            </Label>
            <Input
              id="identifier"
              type="text"
              required
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setOtpSent(false);
                setOtp("");
                setDisplayOtp(null);
                setOtpMessage(null);
              }}
              className="border-border-light bg-white text-ink"
            />
          </div>

          {mode === "otp" && otpSent && (
            <>
              <div className="rounded-lg border border-gold-deep/30 bg-gold-deep/10 p-4 text-sm text-ink">
                <p className="font-medium text-gold-deep">Verification code</p>
                {displayOtp ? (
                  <p className="mt-2 font-display text-2xl tracking-[0.3em]">{displayOtp}</p>
                ) : (
                  <p className="mt-2 text-ink-muted">Check your email for the 6-digit code.</p>
                )}
                {otpMessage && <p className="mt-2 text-xs text-ink-muted">{otpMessage}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-ink">
                  6 digit OTP
                </Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="border-border-light bg-white text-ink"
                />
              </div>
            </>
          )}

          {mode === "password" && (
            <div className="space-y-2">
              <Label htmlFor="password" className="text-ink">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-border-light bg-white text-ink"
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-gradient-gold text-charcoal hover:opacity-90"
          >
            {busy ? "Please wait..." : mode === "otp" && !otpSent ? "Send OTP" : "Sign In"}
          </Button>
        </form>

        {mode === "otp" && !otpSent && (
          <p className="mt-3 text-xs text-ink-muted">
            Use the same email or mobile number you used while registering or checkout.
          </p>
        )}

        <p className="mt-4 text-center text-sm text-ink-muted">
          <Link href="/forgot-password" className="text-gold-deep hover:underline">
            Forgot password?
          </Link>
        </p>

        <p className="mt-8 text-center text-sm text-ink-muted">
          New to Embr?{" "}
          <Link href="/register" className="text-gold-deep hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </ShopLayout>
  );
}
