import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useSiteContent() {
  const { data, isLoading } = useQuery({
    queryKey: ["site-content"],
    queryFn: () => api.getContent(),
    staleTime: 5 * 60 * 1000, // Cache for 5 mins
  });

  const isReady = !isLoading && Boolean(data);
  const content = data?.content || {};
  const sections = data?.sections || {};

  // Show fallback values immediately on first render for fast perceived loading.
  // Once API data arrives, use the admin-managed values.
  const getVal = (key: string, fallback: string) => content[key] || fallback;
  const isHidden = (key: string) => isReady ? sections[key] === true : false;

  return { content, sections, getVal, isHidden, isLoading, isReady };
}

