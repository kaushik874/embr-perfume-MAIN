import { useState } from "react";
import { Link } from "wouter";
import { ShopLayout } from "@/components/layout/ShopLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

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
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email" className="text-ink">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-border-light bg-white text-ink"
              placeholder="name@example.com"
            />
          </div>

          <Button
            type="submit"
            className="w-full rounded-full bg-ink text-white hover:bg-ink/90"
          >
            Send reset link
          </Button>
        </form>

        {sent && (
          <p className="mt-6 rounded-lg border border-border-light bg-white p-4 text-sm text-ink">
            If an account exists for this email, a reset link will be sent shortly.
          </p>
        )}

        <p className="mt-8 text-center text-sm text-ink-muted">
          <Link href="/login" className="text-gold-deep hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </ShopLayout>
  );
}
