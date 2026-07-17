import nodemailer from "nodemailer";

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function deliverOtp(
  channel: "email" | "mobile",
  destination: string,
  otp: string,
): Promise<{ delivered: boolean; message: string }> {
  if (channel === "email" && smtpConfigured()) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: destination,
      subject: "Your Embr Perfume verification code",
      text: `Your verification code is ${otp}. It expires in 10 minutes.`,
      html: `<p>Your verification code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
    });

    return { delivered: true, message: "OTP sent to your email" };
  }

  if (channel === "mobile") {
    console.info(`[OTP] Mobile OTP for ${destination}: ${otp}`);
    return {
      delivered: false,
      message: "SMS is not configured. Use the verification code shown on screen.",
    };
  }

  console.info(`[OTP] Email OTP for ${destination}: ${otp}`);
  return {
    delivered: false,
    message: "Email delivery is not configured. Use the verification code shown on screen.",
  };
}
