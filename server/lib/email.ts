export async function sendEmail(
  to: string,
  toName: string | undefined,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; message: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("[Email] BREVO_API_KEY not configured. Skipping email send to:", to);
    return { success: false, message: "Email delivery is not configured." };
  }

  const senderEmail = process.env.EMAIL_FROM || "noreply@embrperfume.com";
  const senderName = process.env.EMAIL_FROM_NAME || "Embr Perfume";

  console.log(`[Email] Sending to: ${to}, Subject: "${subject}", Sender: ${senderName} <${senderEmail}>`);

  try {
    const payload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to, name: toName || to }],
      subject: subject,
      htmlContent: htmlContent,
    };

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[Email] Brevo API Error (HTTP ${response.status}):`, errorData);
      console.error(`[Email] This usually means:`);
      if (response.status === 401) {
        console.error(`  → BREVO_API_KEY is invalid or expired`);
      } else if (response.status === 400) {
        console.error(`  → Sender email "${senderEmail}" may not be verified in Brevo`);
        console.error(`  → Go to https://app.brevo.com/senders to verify your sender`);
      }
      return { success: false, message: `Brevo API error (${response.status}): ${errorData}` };
    }

    const result = await response.json();
    console.log("[Email] Sent successfully:", result);
    return { success: true, message: "Email sent successfully." };
  } catch (error) {
    console.error("[Email] Network/Fetch Error:", error);
    return { success: false, message: "Error communicating with email provider." };
  }
}
