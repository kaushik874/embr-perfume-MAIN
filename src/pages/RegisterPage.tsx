import { useMemo, useState } from "react";

import { Link, useLocation } from "wouter";

import { useAuth } from "@/contexts/AuthContext";

import { ShopLayout } from "@/components/layout/ShopLayout";

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { toast } from "sonner";



export function RegisterPage() {

  const { register, loginWithGoogle } = useAuth();

  const [location, setLocation] = useLocation();

  const [name, setName] = useState("");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);



  const next = useMemo(() => {

    const url = new URL(location, window.location.origin);

    const n = url.searchParams.get("next");

    return n && n.startsWith("/") ? n : "/";

  }, [location]);



  const finishRegister = () => {

    toast.success("Account created");

    setLocation(next);

  };



  const onSubmit = async (e: React.FormEvent) => {

    e.preventDefault();

    setBusy(true);

    try {

      await register(name, email, password);

      finishRegister();

    } catch (err) {

      toast.error(err instanceof Error ? err.message : "Registration failed");

    } finally {

      setBusy(false);

    }

  };



  const handleGoogle = async (credential: string) => {

    setBusy(true);

    try {

      await loginWithGoogle(credential);

      finishRegister();

    } catch (err) {

      toast.error(err instanceof Error ? err.message : "Google sign-in failed");

    } finally {

      setBusy(false);

    }

  };



  return (

    <ShopLayout promo="Join Embr — save favourites & track orders">

      <div className="mx-auto flex max-w-md flex-col px-6 py-16">

        <p className="font-display text-xs tracking-[0.4em] text-gold-deep">- JOIN EMBR</p>

        <h1 className="mt-3 font-serif text-4xl text-ink">Create Account</h1>

        <p className="mt-2 text-sm text-ink-muted">

          Save your favourites and track every order.

        </p>



        <div className="mt-8">

          <GoogleSignInButton onCredential={handleGoogle} disabled={busy} text="signup_with" />

        </div>



        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-ink-muted">

          <span className="h-px flex-1 bg-border-light" />

          or

          <span className="h-px flex-1 bg-border-light" />

        </div>



        <form onSubmit={onSubmit} className="mt-2 space-y-5">

          <div className="space-y-2">

            <Label htmlFor="name" className="text-ink">

              Full name

            </Label>

            <Input

              id="name"

              required

              value={name}

              onChange={(e) => setName(e.target.value)}

              className="border-border-light bg-white text-ink"

            />

          </div>

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

            />

          </div>

          <div className="space-y-2">

            <Label htmlFor="password" className="text-ink">

              Password (min 6 characters)

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

          <Button

            type="submit"

            disabled={busy}

            className="w-full rounded-full bg-gradient-gold text-charcoal hover:opacity-90"

          >

            {busy ? "Creating..." : "Register"}

          </Button>

        </form>



        <p className="mt-8 text-center text-sm text-ink-muted">

          Already have an account?{" "}

          <Link href="/login" className="text-gold-deep hover:underline">

            Sign in

          </Link>

        </p>

      </div>

    </ShopLayout>

  );

}

