import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const ADMIN_EMAILS = [
  process.env.ADMIN_EMAIL,
].filter(Boolean) as string[];

export const FREE_LIMITS = {
  maxCards: 500,
  maxBinders: 2,
  maxAlerts: 0,
  investorMode: false,
  export: false,
  priceHistoryDays: 30,
} as const;

export const PREMIUM_LIMITS = {
  maxCards: Infinity,
  maxBinders: Infinity,
  maxAlerts: 50,
  investorMode: true,
  export: true,
  priceHistoryDays: 365,
} as const;

export const ADMIN_LIMITS = {
  maxCards: Infinity,
  maxBinders: Infinity,
  maxAlerts: Infinity,
  investorMode: true,
  export: true,
  priceHistoryDays: Infinity,
} as const;

export interface PlanLimits {
  maxCards: number;
  maxBinders: number;
  maxAlerts: number;
  investorMode: boolean;
  export: boolean;
  priceHistoryDays: number;
}

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
