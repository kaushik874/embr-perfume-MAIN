import { ContentLayout } from "@/components/layout/ContentLayout";
import { useSiteContent } from "@/hooks/use-site-content";

export function ReturnsPage() {
  const { getVal } = useSiteContent();

  return (
    <ContentLayout eyebrow="— RETURNS" title="Return Policy">
      <div className="whitespace-pre-wrap">
        {getVal("page_returns", `Unopened fragrances in original packaging may be returned within 7 days of delivery. Opened or used products cannot be returned for hygiene reasons.\n\nTo start a return, email us with your order number and reason. Once approved, we will arrange pickup or provide return instructions. Refunds are processed within 5–7 business days after we receive the product.\n\nDamaged or wrong items received must be reported within 48 hours of delivery.`)}
      </div>
    </ContentLayout>
  );
}
