const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const SEND_TIMEOUT_MS = 8000;

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "AlgoMind";

  if (!apiKey || !senderEmail) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email provider is not configured (BREVO_API_KEY / BREVO_SENDER_EMAIL)");
    }
    // Local development without a provider: print the code instead.
    console.log(`\n[DEV] Verification code for ${to}: ${otp}\n`);
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject: `${otp} is your AlgoMind verification code`,
        textContent:
          `Your AlgoMind verification code is ${otp}. ` +
          `It expires in 10 minutes. If you didn't request this, ignore this email.`,
        htmlContent:
          `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto">` +
          `<h2 style="color:#1B2A4A">AlgoMind</h2>` +
          `<p>Your verification code is</p>` +
          `<p style="font-size:32px;letter-spacing:6px;font-weight:bold">${otp}</p>` +
          `<p style="color:#666">It expires in 10 minutes. If you didn't request this, ignore this email.</p>` +
          `</div>`,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Brevo responded ${res.status}: ${detail.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}