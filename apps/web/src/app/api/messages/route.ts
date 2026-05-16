import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";
import { sendDiscordDM } from "@/lib/discord";
import { sendNewMessageEmail } from "@/lib/email";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://pokevault.app";

const MAX_MESSAGE_LENGTH = 2000;
const MESSAGES_LIST_LIMIT = 500; // Anti-DoS : un utilisateur très actif peut avoir des milliers de messages

// ─── GET /api/messages — liste des conversations ─────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const myId = session.user.id;

  // Charge les N messages les plus récents impliquant l'utilisateur,
  // suffisant pour reconstruire l'aperçu de toutes les conversations actives.
  const messages = await db.message.findMany({
    where: {
      OR: [{ fromUserId: myId }, { toUserId: myId }],
    },
    include: {
      from: { select: { id: true, name: true, image: true } },
      to: { select: { id: true, name: true, image: true } },
      tradeOffer: {
        select: {
          id: true,
          items: {
            take: 2,
            include: {
              card: { select: { name: true, imageSmall: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: MESSAGES_LIST_LIMIT,
  });

  // Regroupement par interlocuteur
  const convMap = new Map<
    string,
    {
      partner: { id: string; name: string | null; image: string | null };
      lastMessage: { content: string; createdAt: Date; isFromMe: boolean };
      unreadCount: number;
    }
  >();

  for (const msg of messages) {
    const isFromMe = msg.fromUserId === myId;
    const partner = isFromMe ? msg.to : msg.from;

    if (!convMap.has(partner.id)) {
      convMap.set(partner.id, {
        partner,
        lastMessage: {
          content: msg.content,
          createdAt: msg.createdAt,
          isFromMe,
        },
        unreadCount: 0,
      });
    }

    if (!msg.read && msg.toUserId === myId) {
      convMap.get(partner.id)!.unreadCount++;
    }
  }

  const totalUnread = [...convMap.values()].reduce(
    (s, c) => s + c.unreadCount,
    0
  );

  return NextResponse.json({
    conversations: Array.from(convMap.values()),
    totalUnread,
  });
}

// ─── POST /api/messages — envoyer un message ─────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await request.json();
  const { toUserId, content, tradeOfferId } = body as {
    toUserId: string;
    content: string;
    tradeOfferId?: string;
  };

  if (!toUserId || !content?.trim())
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

  if (toUserId === session.user.id)
    return NextResponse.json(
      { error: "Vous ne pouvez pas vous envoyer un message" },
      { status: 400 }
    );

  // Limite de longueur du contenu
  if (content.trim().length > MAX_MESSAGE_LENGTH)
    return NextResponse.json(
      { error: `Message trop long (max ${MAX_MESSAGE_LENGTH} caractères)` },
      { status: 400 }
    );

  try {
    // Vérification que le destinataire existe
    const recipient = await db.user.findUnique({
      where: { id: toUserId },
      select: { id: true, name: true, email: true, discordId: true, emailNotifications: true },
    });
    if (!recipient)
      return NextResponse.json({ error: "Destinataire introuvable" }, { status: 404 });

    const message = await db.message.create({
      data: {
        fromUserId: session.user.id,
        toUserId,
        content: content.trim(),
        tradeOfferId: tradeOfferId ?? null,
      },
      include: {
        from: { select: { id: true, name: true, image: true } },
      },
    });

    const senderName = session.user.name ?? "Quelqu'un";
    const preview = content.trim().slice(0, 120);

    // 🔔 Notification Discord (non-bloquant, mais loggue les erreurs pour debug)
    if (recipient.discordId) {
      const msg = [
        `💬 **Nouveau message de ${senderName} sur PokeVault !**`,
        ``,
        `"${preview}${content.length > 120 ? "..." : ""}"`,
        ``,
        `👉 Répondre : ${APP_URL}/messages`,
      ].join("\n");
      sendDiscordDM(recipient.discordId, msg).catch((err) => {
        console.warn("[Messages] Discord DM failed", {
          recipientId: recipient.id,
          err: err instanceof Error ? err.message : String(err),
        });
      });
    }

    // 📧 Notification email (non-bloquant)
    if (recipient.emailNotifications && recipient.email) {
      sendNewMessageEmail({
        to: recipient.email,
        senderName,
        preview: preview + (content.length > 120 ? "..." : ""),
      }).catch((err: unknown) => {
        console.warn("[Messages] Email send failed", {
          recipientId: recipient.id,
          err: err instanceof Error ? err.message : String(err),
        });
      });
    }

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("[Messages] Send error:", error);
    return NextResponse.json({ error: "Échec envoi du message" }, { status: 500 });
  }
}
