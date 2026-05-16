"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// next-auth v4 uses localStorage internally which crashes SSR in Next.js 15.
// Loading it client-only prevents the server from ever executing that code.
const SessionProvider = dynamic(
  () => import("next-auth/react").then((m) => m.SessionProvider),
  { ssr: false }
);

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
