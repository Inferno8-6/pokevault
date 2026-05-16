"use client";

import { useSession } from "next-auth/react";
import { FREE_LIMITS, PREMIUM_LIMITS, type PlanLimits } from "@/lib/premium";

const ADMIN_EMAILS = [process.env.NEXT_PUBLIC_ADMIN_EMAIL].filter(Boolean);

export function usePremium(): { isPremium: boolean; limits: PlanLimits; loading: boolean } {
  const { data: session, status } = useSession();
  const isAdmin = !!session?.user?.email && ADMIN_EMAILS.includes(session.user.email);
  const isPremium = session?.user?.premium === true || isAdmin;
  return {
    isPremium,
    limits: isPremium ? PREMIUM_LIMITS : FREE_LIMITS,
    loading: status === "loading",
  };
}
