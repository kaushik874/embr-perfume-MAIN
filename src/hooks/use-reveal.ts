import { useEffect } from "react";

function isInViewport(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const vw = window.innerWidth || document.documentElement.clientWidth;
  return r.bottom >= 0 && r.right >= 0 && r.top <= vh && r.left <= vw;
}

export function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 },
    );

    const observe = (el: HTMLElement) => {
      if (el.classList.contains("in")) return;
      // If it's already visible (common with async-rendered grids), reveal immediately.
      if (isInViewport(el)) {
        el.classList.add("in");
        return;
      }
      io.observe(el);
    };

    // Initial pass
    document.querySelectorAll<HTMLElement>(".reveal").forEach(observe);

    // Observe future .reveal nodes (e.g., products after API load)
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.classList.contains("reveal")) observe(node);
          node.querySelectorAll?.<HTMLElement>(".reveal").forEach(observe);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Also handle hash navigation (/#collection) on first load.
    const onHash = () => {
      document.querySelectorAll<HTMLElement>(".reveal").forEach((el) => {
        if (!el.classList.contains("in") && isInViewport(el)) el.classList.add("in");
      });
    };
    window.addEventListener("hashchange", onHash);
    setTimeout(onHash, 0);

    return () => {
      window.removeEventListener("hashchange", onHash);
      mo.disconnect();
      io.disconnect();
    };
  }, []);
}
