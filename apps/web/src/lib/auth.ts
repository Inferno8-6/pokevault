import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@pokemon/db";

/**
 * Fail-fast au démarrage si les credentials OAuth Discord ne sont pas configurés.
 * Sinon, on aurait un comportement obscur : NextAuth génère une URL de redirection
 * avec `client_id=undefined` qui se solde par "invalid_client" côté Discord.
 */
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
  throw new Error(
    "[auth] DISCORD_CLIENT_ID et DISCORD_CLIENT_SECRET doivent être définis dans .env",
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as NextAuthOptions["adapter"],
  providers: [
    DiscordProvider({
      clientId: DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        try {
          const dbUser = await db.user.findUnique({
            where: { id: user.id },
            select: { premium: true, email: true },
          });
          const adminEmails = [process.env.ADMIN_EMAIL].filter(Boolean) as string[];
          const isAdmin = !!dbUser?.email && adminEmails.includes(dbUser.email);
          session.user.premium = dbUser?.premium || isAdmin;
        } catch {
          session.user.premium = false;
        }
      }
      return session;
    },
  },
  events: {
    // Sauvegarde l'ID Discord dès la première connexion.
    // Erreur logguée mais non-bloquante : le login doit aboutir même si la sync
    // échoue (ex : autre user a déjà cet discordId à cause d'une migration ratée).
    async signIn({ user, account }) {
      if (account?.provider !== "discord" || !account.providerAccountId) return;
      try {
        await db.user.update({
          where: { id: user.id },
          data: { discordId: account.providerAccountId },
        });
      } catch (err) {
        console.error("[auth] Échec sync discordId", {
          userId: user.id,
          discordId: account.providerAccountId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    },
  },
  pages: {
    signIn: "/login",
  },
};

// Extend next-auth types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      premium: boolean;
    };
  }
}
