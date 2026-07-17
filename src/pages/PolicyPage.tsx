import { ContentLayout } from "@/components/layout/ContentLayout";
import { useSiteContent } from "@/hooks/use-site-content";

export function PolicyPage() {
  const { getVal } = useSiteContent();

  return (
    <ContentLayout eyebrow="— POLICY" title="Privacy Policy">
      <div className="whitespace-pre-wrap">
        {getVal("page_policy", `We collect name, email, phone, and shipping address only to fulfil your order and send delivery updates. Payment details are processed securely by Razorpay; we do not store card or UPI credentials on our servers.\n\nWe do not sell your personal information. You may contact us to update or delete your account details, subject to legal and order-record requirements.\n\nLast updated: June 2026.`)}
      </div>
    </ContentLayout>
  );
}
