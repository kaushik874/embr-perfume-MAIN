import { ContentLayout } from "@/components/layout/ContentLayout";
import { useSiteContent } from "@/hooks/use-site-content";

export function ShippingPage() {
  const { getVal } = useSiteContent();
  
  return (
    <ContentLayout eyebrow="— SHIPPING" title="Shipping Information">
      <div className="whitespace-pre-wrap">
        {getVal("page_shipping", `Orders ship within 1–2 business days across India. Standard delivery takes 3–7 business days depending on your pincode.\n\nFree shipping on orders above ₹999. Tracking details are sent to your email and phone once dispatched.\n\nCash on delivery is not available. All orders are prepaid via UPI, cards, or net banking.`)}
      </div>
    </ContentLayout>
  );
}
