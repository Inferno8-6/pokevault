// Plain constants + types — safe to import from client and server.
// No server-only dependencies (no next-auth, no Prisma).

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
