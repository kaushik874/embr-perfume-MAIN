import https from "node:https";
import type { IncomingHttpHeaders } from "node:http";

const BREVO_SEND_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";

type BrevoResponse = {
  status: number;
  statusText: string;
  headers: IncomingHttpHeaders;
  body: string;
};

type SendEmailResult = {
  success: boolean;
  message: string;
};

function cleanHeaderValue(value: string | undefined) {
  return value?.replace(/[\r\n]+/g, " ").trim();
}

function parseEmailFrom(value: string | undefined) {
  const raw = cleanHeaderValue(value) || "";
  const angleMatch = raw.match(/^(?:"?([^"<]*)"?\s*)?<([^<>]+)>$/);

  if (angleMatch) {
    return {
      email: angleMatch[2].trim(),
      name: cleanHeaderValue(angleMatch[1]),
      raw,
    };
  }

  return {
    email: raw.replace(/^mailto:/i, "").replace(/^['"]|['"]$/g, "").trim(),
    name: undefined,
    raw,
  };
}

function isEmailAddress(value: string) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

function normalizeHtmlContent(htmlContent: string) {
  const sanitized = String(htmlContent || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();

  if (!sanitized) {
    return "<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>";
  }

  if (/<html[\s>]/i.test(sanitized)) {
    return sanitized;
  }

  return `<!doctype html><html><head><meta charset="utf-8"></head><body>${sanitized}</body></html>`;
}

function redactOtp(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/\b\d{6}\b/g, "[redacted-otp]");
  }

  if (Array.isArray(value)) {
    return value.map(redactOtp);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        redactOtp(nestedValue),
      ]),
    );
  }

  return value;
}

function postJson(url: string, apiKey: string, payload: unknown): Promise<BrevoResponse> {
  const requestUrl = new URL(url);
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const request = https.request(
      requestUrl,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": apiKey,
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        response.on("end", () => {
          resolve({
            status: response.statusCode || 0,
            statusText: response.statusMessage || "",
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    request.setTimeout(30_000, () => {
      request.destroy(new Error("Brevo request timed out after 30000ms"));
    });

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function logDiagnostics(args: {
  payload: unknown;
  response?: BrevoResponse;
  error?: unknown;
  senderRaw: string;
  senderEmail: string;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  const diagnostics = {
    nodeVersion: process.version,
    globalFetchSupported: typeof globalThis.fetch === "function",
    environmentVariablesLoaded: {
      BREVO_API_KEY: apiKey ? `loaded and used (length ${apiKey.length})` : "missing",
      EMAIL_FROM: args.senderRaw || "missing",
      EMAIL_FROM_NAME: cleanHeaderValue(process.env.EMAIL_FROM_NAME) || "missing",
      EMAIL_FROM_NORMALIZED: args.senderEmail || "missing",
    },
    request: {
      url: BREVO_SEND_EMAIL_URL,
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": "[redacted]",
        "content-type": "application/json",
      },
      payload: redactOtp(args.payload),
    },
    response: args.response
      ? {
          httpStatus: args.response.status,
          statusText: args.response.statusText,
          headers: args.response.headers,
          fullBody: args.response.body,
        }
      : undefined,
    stackTrace:
      args.error instanceof Error
        ? args.error.stack
        : args.error
          ? String(args.error)
          : undefined,
  };

  console.error("[Email] Brevo diagnostics:", JSON.stringify(diagnostics, null, 2));
}

export async function sendEmail(
  to: string,
  toName: string | undefined,
  subject: string,
  htmlContent: string
): Promise<SendEmailResult> {
  const apiKey = cleanHeaderValue(process.env.BREVO_API_KEY);
  const parsedSender = parseEmailFrom(process.env.EMAIL_FROM || "noreply@embrperfume.com");
  const senderEmail = parsedSender.email;
  const senderName =
    cleanHeaderValue(process.env.EMAIL_FROM_NAME) ||
    parsedSender.name ||
    "Embr Perfume";
  const recipientEmail = cleanHeaderValue(to)?.toLowerCase() || "";
  const recipientName = cleanHeaderValue(toName);

  if (!apiKey) {
    console.warn("[Email] BREVO_API_KEY not configured. Skipping email send to:", recipientEmail || to);
    return { success: false, message: "Unable to send email. Please try again later." };
  }

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [
      recipientName
        ? { email: recipientEmail, name: recipientName }
        : { email: recipientEmail },
    ],
    subject: cleanHeaderValue(subject) || "Embr Perfume",
    htmlContent: normalizeHtmlContent(htmlContent),
  };

  console.log(`[Email] Sending to: ${recipientEmail}, Subject: "${payload.subject}", Sender: ${senderName} <${senderEmail}>`);

  if (!isEmailAddress(senderEmail)) {
    const error = new Error(`EMAIL_FROM must be a plain verified sender email address. Received: ${parsedSender.raw || "[empty]"}`);
    logDiagnostics({ payload, error, senderRaw: parsedSender.raw, senderEmail });
    return { success: false, message: "Unable to send email. Please try again later." };
  }

  if (!isEmailAddress(recipientEmail)) {
    const error = new Error(`Recipient email is invalid: ${to}`);
    logDiagnostics({ payload, error, senderRaw: parsedSender.raw, senderEmail });
    return { success: false, message: "Unable to send email. Please try again later." };
  }

  try {
    const response = await postJson(BREVO_SEND_EMAIL_URL, apiKey, payload);

    if (response.status < 200 || response.status >= 300) {
      const error = new Error(`Brevo API error (${response.status}): ${response.body}`);
      logDiagnostics({ payload, response, error, senderRaw: parsedSender.raw, senderEmail });
      console.error("[Email] Brevo provider error:", error.stack);
      return { success: false, message: "Unable to send email. Please try again later." };
    }

    logDiagnostics({ payload, response, senderRaw: parsedSender.raw, senderEmail });

    let messageId = "";
    try {
      const parsed = JSON.parse(response.body) as { messageId?: string; messageIds?: string[] };
      messageId = parsed.messageId || parsed.messageIds?.join(", ") || "";
    } catch {
      messageId = response.body;
    }

    console.log("[Email] Sent successfully:", messageId || response.body);
    return { success: true, message: "Email sent successfully." };
  } catch (error) {
    logDiagnostics({ payload, error, senderRaw: parsedSender.raw, senderEmail });
    console.error("[Email] Network/HTTP Error:", error);
    return { success: false, message: "Unable to send email. Please try again later." };
  }
}
