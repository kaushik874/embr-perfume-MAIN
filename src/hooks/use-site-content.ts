import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const CACHE_KEY = "embr_site_content_cache";

function getCachedSiteContent() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return undefined;
}

export function useSiteContent() {
  const { data, isLoading } = useQuery({
    queryKey: ["site-content"],
    queryFn: async () => {
      const res = await api.getContent();
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(res));
      } catch {}
      return res;
    },
    initialData: getCachedSiteContent,
    staleTime: 1000 * 60 * 5,
  });

  const isReady = Boolean(data);
  const content = data?.content || {};
  const sections = data?.sections || {};

  const getVal = (key: string, fallback: string) => content[key] || fallback;
  const isHidden = (key: string) => {
    if (sections[key] === true) return true;
    if (sections[key] === false) return false;
    return !isReady;
  };

  return { content, sections, getVal, isHidden, isLoading, isReady };
}


