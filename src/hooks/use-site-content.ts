import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useSiteContent() {
  const { data, isLoading } = useQuery({
    queryKey: ["site-content"],
    queryFn: () => api.getContent(),
    staleTime: 5 * 60 * 1000, // Cache for 5 mins
  });

  const content = data?.content || {};
  const sections = data?.sections || {};

  // Helper to fallback safely
  const getVal = (key: string, fallback: string) => content[key] || fallback;
  const isHidden = (key: string) => sections[key] === true;

  return { content, sections, getVal, isHidden, isLoading };
}
