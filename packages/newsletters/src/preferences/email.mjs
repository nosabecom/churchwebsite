function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character],
  );
}

export function createResendMailer({ apiKey, from, reviewEmail, fetchImpl = fetch }) {
  if (!apiKey || !from || !reviewEmail) {
    throw new Error("Resend newsletter email configuration is incomplete.");
  }

  async function send({ to, subject, text, html, idempotencyKey }) {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "User-Agent": "churchwebsite-newsletter-preferences/1.0",
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) throw new Error("Transactional email delivery failed.");
    return await response.json();
  }

  return {
    async sendVerification({ requestId, email, firstName, verificationUrl, expiresMinutes }) {
      const safeName = escapeHtml(firstName);
      const safeUrl = escapeHtml(verificationUrl);
      return await send({
        to: email,
        subject: "Confirm your newsletter preference",
        idempotencyKey: `newsletter-verification-${requestId}`,
        text: `Hi ${firstName},\n\nConfirm your newsletter preference by opening this link within ${expiresMinutes} minutes:\n${verificationUrl}\n\nIf you did not make this request, you can ignore this email.`,
        html: `<p>Hi ${safeName},</p><p>Confirm your newsletter preference by opening the secure link below within ${expiresMinutes} minutes.</p><p><a href="${safeUrl}">Confirm my newsletter preference</a></p><p>If you did not make this request, you can ignore this email.</p>`,
      });
    },

    async sendReviewNotice({ requestId, reason, firstName, lastName, email, preference }) {
      const details = [
        `Request: ${requestId}`,
        `Reason: ${reason}`,
        `Name: ${firstName} ${lastName}`,
        `Email: ${email}`,
        `Preference: ${preference}`,
      ].join("\n");
      return await send({
        to: reviewEmail,
        subject: `Newsletter preference needs review (${requestId})`,
        idempotencyKey: `newsletter-review-${requestId}`,
        text: `${details}\n\nThe email address was verified. Review the matching Breeze profiles without guessing between shared addresses.`,
        html: `<p>A verified newsletter preference request needs staff review.</p><pre>${escapeHtml(details)}</pre><p>Review the matching Breeze profiles without guessing between shared addresses.</p>`,
      });
    },
  };
}
