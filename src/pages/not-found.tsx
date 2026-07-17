import { Link } from "wouter";
import { ShopLayout } from "@/components/layout/ShopLayout";

export default function NotFound() {
  return (
    <ShopLayout>
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-32 text-center">
        <p className="font-display text-xs tracking-[0.4em] text-gold-deep">— 404</p>
        <h1 className="mt-3 font-serif text-4xl text-ink">Page not found</h1>
        <p className="mt-4 text-sm text-ink-muted">
          This scent trail leads nowhere. Return to the collection.
        </p>
        <Link
          href="/"
          className="mt-8 rounded-full border-2 border-ink px-10 py-3 text-sm tracking-widest text-ink hover:bg-ink hover:text-white"
        >
          BACK HOME
        </Link>
      </div>
    </ShopLayout>
  );
}
