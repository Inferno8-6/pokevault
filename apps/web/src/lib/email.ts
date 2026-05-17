/**
 * Service d'envoi d'emails via Resend
 * Nécessite RESEND_API_KEY dans .env
 * Domaine expéditeur : configuré dans le dashboard Resend (ex: noreply@pokevault.app)
 */

import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const FROM = process.env.EMAIL_FROM ?? "PokeVault <noreply@pokevault.app>";
const APP_URL = process.env.NEXTAUTH_URL ?? "https://pokevault.app";

// ─── Alerte de prix ──────────────────────────────────────────────────────────

export async function sendPriceAlertEmail({
  to,
  cardName,
  currentPrice,
  threshold,
  condition,
}: {
  to: string;
  cardName: string;
  currentPrice: number;
  threshold: number;
  condition: "above" | "below";
}) {
  const conditionText = condition === "above" ? "au-dessus de" : "en-dessous de";

  const resend = getResend();
  if (!resend) return;
  return resend.emails.send({
    from: FROM,
    to,
    subject: `🔔 Alerte prix : ${esc(cardName)} est ${conditionText} ${threshold.toFixed(2)} €`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;background:#0a0a0a;color:#fff;border-radius:16px;padding:32px;border:1px solid #2a2a2a">
        <h1 style="color:#f59e0b;font-size:20px;margin-bottom:8px">🔔 Alerte de prix déclenchée</h1>
        <p style="color:#a3a3a3;margin-bottom:24px">sur <strong style="color:#fff">PokeVault</strong></p>

        <div style="background:#141414;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #2a2a2a">
          <p style="font-size:18px;font-weight:700;margin:0 0 8px">${esc(cardName)}</p>
          <p style="color:#f59e0b;font-size:24px;font-weight:800;margin:0">${currentPrice.toFixed(2)} €</p>
          <p style="color:#a3a3a3;font-size:13px;margin:4px 0 0">
            Votre seuil : ${conditionText} <strong style="color:#fff">${threshold.toFixed(2)} €</strong>
          </p>
        </div>

        <a href="${APP_URL}/alerts" style="display:inline-block;background:#f59e0b;color:#000;font-weight:700;padding:12px 24px;border-radius:12px;text-decoration:none;font-size:14px">
          Voir mes alertes →
        </a>

        <p style="color:#525252;font-size:11px;margin-top:24px">
          Pour ne plus recevoir ces emails, désactivez les notifications dans votre <a href="${APP_URL}/profile" style="color:#a3a3a3">profil</a>.
        </p>
      </div>
    `,
  }).catch(() => {}); // Ne jamais bloquer si l'email échoue
}

// ─── Nouveau message ─────────────────────────────────────────────────────────

export async function sendNewMessageEmail({
  to,
  senderName,
  preview,
}: {
  to: string;
  senderName: string;
  preview: string;
}) {
  const resend = getResend();
  if (!resend) return;
  return resend.emails.send({
    from: FROM,
    to,
    subject: `💬 Nouveau message de ${esc(senderName)} sur PokeVault`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;background:#0a0a0a;color:#fff;border-radius:16px;padding:32px;border:1px solid #2a2a2a">
        <h1 style="color:#f59e0b;font-size:20px;margin-bottom:8px">💬 Nouveau message</h1>
        <p style="color:#a3a3a3;margin-bottom:24px">de <strong style="color:#fff">${esc(senderName)}</strong></p>

        <div style="background:#141414;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #2a2a2a;border-left:3px solid #f59e0b">
          <p style="color:#a3a3a3;font-style:italic;margin:0">"${esc(preview)}"</p>
        </div>

        <a href="${APP_URL}/messages" style="display:inline-block;background:#f59e0b;color:#000;font-weight:700;padding:12px 24px;border-radius:12px;text-decoration:none;font-size:14px">
          Répondre →
        </a>

        <p style="color:#525252;font-size:11px;margin-top:24px">
          Pour ne plus recevoir ces emails, désactivez les notifications dans votre <a href="${APP_URL}/profile" style="color:#a3a3a3">profil</a>.
        </p>
      </div>
    `,
  }).catch(() => {});
}
