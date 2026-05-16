"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/dashboard",  label: "Portfolio",  icon: "📊" },
  { href: "/market",     label: "Marché",     icon: "📈" },
  { href: "/explore",    label: "Explorer",   icon: "🔍" },
  { href: "/sets",       label: "Séries",     icon: "📦" },
  { href: "/binders",    label: "Classeurs",  icon: "📚" },
  { href: "/sealed",     label: "Scellés",    icon: "🎁" },
  { href: "/wishlist",   label: "Wishlist",   icon: "⭐" },
  { href: "/alerts",     label: "Alertes",    icon: "🔔" },
  { href: "/investor",   label: "Investisseur", icon: "💰" },
  { href: "/trades",     label: "Échanges",   icon: "🔄" },
  { href: "/messages",   label: "Messages",   icon: "💬" },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [unread, setUnread] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    const check = async () => {
      try {
        const res = await fetch("/api/messages");
        if (res.ok) setUnread((await res.json()).totalUnread ?? 0);
      } catch { /* silencieux */ }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [session?.user]);

  return (
    <header className={`sticky top-0 z-50 transition-all duration-200 ${scrolled ? "border-b border-[var(--border)] bg-[var(--background)]/95 shadow-lg shadow-black/20 backdrop-blur-md" : "border-b border-transparent bg-[var(--background)]/80 backdrop-blur-sm"}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-base transition-all group-hover:bg-[var(--primary)]/25">
            ⚡
          </div>
          <span className="text-lg font-bold text-white transition-colors group-hover:text-[var(--primary)]">
            Poke<span className="text-[var(--primary)]">Vault</span>
          </span>
        </Link>

        {/* Nav desktop */}
        <nav className="hidden items-center gap-0.5 lg:flex">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all ${active ? "bg-[var(--primary)]/12 text-[var(--primary)]" : "text-[var(--muted)] hover:bg-white/5 hover:text-white"}`}>
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
                {item.href === "/messages" && unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[9px] font-black text-black shadow">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
                {active && (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-[var(--primary)]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Utilisateur */}
        <div className="flex items-center gap-3">
          {session?.user ? (
            <>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold leading-tight">{session.user.name}</p>
                <p className="text-[10px] text-[var(--muted)]">
                  {session.user.premium ? (
                    <Link href="/premium" className="font-bold text-[var(--primary)] hover:underline">Premium</Link>
                  ) : (
                    <Link href="/premium" className="hover:text-[var(--primary)] transition-colors">Gratuit &middot; Upgrade</Link>
                  )}
                </p>
              </div>
              <Link href="/profile" className="group relative">
                {session.user.image ? (
                  <Image src={session.user.image} alt="Avatar" width={36} height={36}
                    className="rounded-full border-2 border-[var(--primary)]/30 transition-all group-hover:border-[var(--primary)] group-hover:shadow-lg group-hover:shadow-[var(--primary)]/20" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--primary)]/30 bg-[var(--card)] text-sm transition-all group-hover:border-[var(--primary)]">
                    👤
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--background)] bg-[var(--success)]" />
              </Link>
              <button onClick={() => signOut({ callbackUrl: "/" })}
                className="hidden rounded-lg px-3 py-1.5 text-xs text-[var(--muted)] transition-colors hover:text-[var(--danger)] sm:block">
                Déco
              </button>
            </>
          ) : (
            <Link href="/login"
              className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-bold text-black shadow shadow-[var(--primary)]/20 transition-all hover:bg-[var(--primary-hover)] hover:shadow-[var(--primary)]/30">
              Connexion
            </Link>
          )}

          {/* Burger mobile */}
          <button onClick={() => setMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] lg:hidden">
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {menuOpen && (
        <div className="border-t border-[var(--border)] bg-[var(--background)] px-6 py-4 lg:hidden">
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                  className={`relative flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${active ? "bg-[var(--primary)]/12 text-[var(--primary)]" : "bg-[var(--card)] text-[var(--muted)] hover:text-white"}`}>
                  <span>{item.icon}</span>
                  {item.label}
                  {item.href === "/messages" && unread > 0 && (
                    <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[9px] font-black text-black">{unread}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
