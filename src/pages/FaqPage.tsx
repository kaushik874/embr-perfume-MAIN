import { ContentLayout } from "@/components/layout/ContentLayout";
import { useSiteContent } from "@/hooks/use-site-content";

export function FaqPage() {
  const { getVal } = useSiteContent();
  return (
    <ContentLayout eyebrow={getVal("faq_eyebrow", "— FAQ")} title={getVal("faq_title", "Questions")}>
      <p>
        <strong className="text-ink">{getVal("faq_q1", "How long does the scent last?")}</strong>
        <br />
        {getVal("faq_a1", "Milky Way is an extrait concentration — typically 8–12 hours on skin depending on climate and application.")}
      </p>
      <p>
        <strong className="text-ink">{getVal("faq_q2", "Do I need an account to checkout?")}</strong>
        <br />
        {getVal("faq_a2", "No. Enter your details at checkout and your order will be placed directly.")}
      </p>
      <p>
        <strong className="text-ink">{getVal("faq_q3", "Where can I see my orders?")}</strong>
        <br />
        {getVal("faq_a3", "After checkout, open the menu and tap Orders, or visit your account page when signed in.")}
      </p>
    </ContentLayout>
  );
}
