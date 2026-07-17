import type { ReactNode } from "react";
import { ShopLayout } from "@/components/layout/ShopLayout";

type ContentLayoutProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
};

export function ContentLayout({ eyebrow, title, children }: ContentLayoutProps) {
  return (
    <ShopLayout>
      <article className="mx-auto max-w-2xl px-6 py-12 md:py-16">
        <p className="font-display text-xs tracking-[0.4em] text-gold-deep">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl text-ink md:text-5xl">{title}</h1>
        <div className="prose prose-sm mt-8 max-w-none space-y-4 text-ink-muted leading-relaxed">
          {children}
        </div>
      </article>
    </ShopLayout>
  );
}
