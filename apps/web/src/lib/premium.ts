import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  FREE_LIMITS,
  PREMIUM_LIMITS,
  ADMIN_LIMITS,
  type PlanLimits,
} from "@/lib/plan-limits";

// Re-export so existing server-side imports keep working unchanged.
export { FREE_LIMITS, PREMIUM_LIMITS, ADMIN_LIMITS, type PlanLimits };

const ADMIN_EMAILS = [
  process.env.ADMIN_EMAIL,
].filter(Boolean) as string[];

export async function getUserLimits(): Promise<{
  isPremium: boolean;
  isAdmin: boolean;
  limits: PlanLimits;
  userId: string | null;
}> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { isPremium: false, isAdmin: false, limits: FREE_LIMITS, userId: null };
  }

  const isAdmin = !!session.user.email && ADMIN_EMAILS.includes(session.user.email);
  const isPremium = session.user.premium || isAdmin;

  return {
    isPremium,
    isAdmin,
    limits: isAdmin ? ADMIN_LIMITS : isPremium ? PREMIUM_LIMITS : FREE_LIMITS,
    userId: session.user.id,
  };
}
