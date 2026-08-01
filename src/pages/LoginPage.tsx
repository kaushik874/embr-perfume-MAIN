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
  const { login, loginWithGoogle } = useAuth();
  const [location, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await login(email.trim(), password);
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
          Access your saved addresses and order history.
        </p>

        {/* Google Sign-In — renders the real Google button or nothing */}
        <div className="mt-8">
          <GoogleSignInButton onCredential={handleGoogle} disabled={busy} text="signin_with" />
        </div>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-ink-muted">
          <span className="h-px flex-1 bg-border-light" />
          or
          <span className="h-px flex-1 bg-border-light" />
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-ink">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-border-light bg-white text-ink"
              placeholder="name@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-ink">Password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-border-light bg-white text-ink"
            />
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-gradient-gold text-charcoal hover:opacity-90"
          >
            {busy ? "Please wait..." : "Sign In"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-muted">
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
