import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ShopLayout } from "@/components/layout/ShopLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function ForgotPasswordPage() {
  const { forgotPassword, resetPassword } = useAuth();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [displayOtp, setDisplayOtp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <ShopLayout promo="Reset your password">
      <div className="mx-auto flex max-w-md flex-col px-6 py-16">
        <p className="font-display text-xs tracking-[0.4em] text-gold-deep">- HELP</p>
        <h1 className="mt-3 font-serif text-4xl text-ink">Forgot password</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Enter your email address and we will send you reset instructions.
        </p>

        <form
          className="mt-10 space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              if (mode === "email") {
                const result = await forgotPassword(email);
                setMode("otp");
                setOtpMessage(result.message);
                setDisplayOtp(result.demoOtp ?? null);
                if (result.demoOtp) {
                  setOtp(result.demoOtp);
                }
                toast.success(result.demoOtp ? "Verification code ready" : result.message);
              } else {
                await resetPassword(email, otp, password);
                toast.success("Password reset successful. Please login.");
                setLocation("/login");
              }
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Request failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === "email" && (
            <div className="space-y-2">
              <Label htmlFor="email" className="text-ink">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="border-border-light bg-white text-ink" placeholder="name@example.com" />
            </div>
          )}

          {mode === "otp" && (
            <>
              <div className="rounded-lg border border-gold-deep/30 bg-gold-deep/10 p-4 text-sm text-ink">
                <p className="font-medium text-gold-deep">Reset code</p>
                {displayOtp ? (
                  <p className="mt-2 font-display text-2xl tracking-[0.3em]">{displayOtp}</p>
                ) : (
                  <p className="mt-2 text-ink-muted">Check your email ({email}) for the 6-digit code.</p>
                )}
                {otpMessage && <p className="mt-2 text-xs text-ink-muted">{otpMessage}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-ink">6 digit code</Label>
                <Input id="otp" inputMode="numeric" required maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} className="border-border-light bg-white text-ink" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-ink">New Password (min 6 characters)</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="border-border-light bg-white text-ink" />
              </div>
            </>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-ink text-white hover:bg-ink/90"
          >
            {busy ? "Please wait..." : mode === "email" ? "Send reset link" : "Reset password"}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-ink-muted">
          <Link href="/login" className="text-gold-deep hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </ShopLayout>
  );
}
