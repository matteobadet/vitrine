import type { APIRoute } from 'astro';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ContactPayload {
  name?: string;
  email?: string;
  message?: string;
  company?: string; // honeypot
}

export const POST: APIRoute = async ({ request }) => {
  let body: ContactPayload;

  try {
    body = await request.json();
  } catch {
    return jsonError('Requête invalide.', 400);
  }

  const { name, email, message, company } = body;

  // Honeypot rempli => probable bot, on répond succès sans rien envoyer.
  if (company) {
    return json({ ok: true });
  }

  if (!name || !email || !message) {
    return jsonError('Merci de remplir tous les champs.', 400);
  }

  if (name.length > 100 || message.length > 4000 || !EMAIL_RE.test(email)) {
    return jsonError('Champs invalides.', 400);
  }

  const apiKey = import.meta.env.RESEND_API_KEY;
  const toAddress = import.meta.env.CONTACT_EMAIL_TO;
  const fromAddress = import.meta.env.CONTACT_EMAIL_FROM;

  if (!apiKey || !toAddress || !fromAddress) {
    console.error('Contact form: variables Resend manquantes (RESEND_API_KEY / CONTACT_EMAIL_TO / CONTACT_EMAIL_FROM).');
    return jsonError("Le service d'envoi n'est pas configuré.", 500);
  }

  const escapedMessage = escapeHtml(message).replace(/\n/g, '<br>');

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [toAddress],
        reply_to: email,
        subject: `Nouveau message de ${name} — mbadet.fr`,
        html: `<p><strong>Nom :</strong> ${escapeHtml(name)}</p>
<p><strong>Email :</strong> ${escapeHtml(email)}</p>
<p><strong>Message :</strong></p>
<p>${escapedMessage}</p>`,
      }),
    });

    if (!resendResponse.ok) {
      const errBody = await resendResponse.text();
      console.error('Resend API error:', resendResponse.status, errBody);
      return jsonError("Échec de l'envoi du message.", 502);
    }
  } catch (err) {
    console.error('Resend request failed:', err);
    return jsonError("Échec de l'envoi du message.", 502);
  }

  return json({ ok: true });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status: number): Response {
  return json({ error: message }, status);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
