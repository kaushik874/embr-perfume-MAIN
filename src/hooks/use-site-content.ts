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

  // Admin-managed content should not show fallback values before settings load.
  const getVal = (key: string, fallback: string) => isReady ? (content[key] || fallback) : "";
  const isHidden = (key: string) => !isReady || sections[key] === true;

  return { content, sections, getVal, isHidden, isLoading, isReady };
}
