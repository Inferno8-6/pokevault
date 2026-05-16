import Link from "next/link";

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#050505]">

      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[var(--primary)]/8 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-blue-500/6 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-purple-500/5 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-base">⚡</div>
            <span className="text-lg font-bold">Poke<span className="text-[var(--primary)]">Vault</span></span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/explore" className="text-sm text-[var(--muted)] transition-colors hover:text-white">
              Explorer les cartes
            </Link>
            <Link href="/api/auth/signin"
              className="rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-bold text-black shadow-lg shadow-[var(--primary)]/20 transition-all hover:bg-[var(--primary-hover)] hover:shadow-[var(--primary)]/30">
              Commencer gratuitement
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col">

        {/* ── Hero ── */}
        <section className="flex flex-col items-center justify-center px-6 py-28 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/8 px-4 py-1.5 text-xs font-semibold text-[var(--primary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
            Prix en temps réel · 13 000+ cartes FR
          </div>
          <h1 className="mx-auto mb-6 max-w-4xl text-5xl font-black leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            Votre collection Pokémon,{" "}
            <span className="bg-gradient-to-r from-[var(--primary)] via-orange-400 to-yellow-300 bg-clip-text text-transparent">
              gérée comme un pro
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-[var(--muted)]">
            Suivez la valeur de chaque carte en temps réel, configurez des alertes de prix,
            trouvez des échanges automatiquement — le tout gratuitement.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/api/auth/signin"
              className="rounded-2xl bg-[var(--primary)] px-8 py-4 text-base font-bold text-black shadow-xl shadow-[var(--primary)]/25 transition-all hover:scale-105 hover:bg-[var(--primary-hover)] hover:shadow-[var(--primary)]/40">
              Connexion avec Discord →
            </Link>
            <Link href="/explore"
              className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-base font-semibold transition-all hover:bg-white/10 hover:border-white/20">
              Voir les cartes
            </Link>
          </div>

          {/* Social proof */}
          <div className="mt-12 flex items-center gap-6 text-sm text-[var(--muted)]">
            <div className="flex -space-x-2">
              {["🔴","🟡","🟢","🔵","🟣"].map((c, i) => (
                <div key={i} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#050505] bg-[var(--card)] text-sm">{c}</div>
              ))}
            </div>
            <p>+500 collectionneurs utilisent PokeVault</p>
          </div>
        </section>

        {/* ── Stats bar ── */}
        <section className="border-y border-white/5 bg-white/[0.02] py-8">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-12 px-6">
            {[
              { value: "13 000+", label: "Cartes TCG françaises" },
              { value: "Cardmarket", label: "Source de prix officielle" },
              { value: "Temps réel", label: "Mise à jour toutes les heures" },
              { value: "100% gratuit", label: "Aucune carte de crédit requise" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-xl font-black text-[var(--primary)]">{s.value}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section className="mx-auto w-full max-w-7xl px-6 py-24">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-black sm:text-4xl">Tout ce dont un collectionneur a besoin</h2>
            <p className="text-[var(--muted)]">De la gestion de collection à l&apos;investissement, en passant par les échanges.</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="border-t border-white/5 bg-white/[0.02] py-24">
          <div className="mx-auto max-w-4xl px-6">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-black">En 3 étapes</h2>
              <p className="text-[var(--muted)]">Démarrez en moins de 2 minutes</p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {[
                { step: "01", title: "Connectez-vous", desc: "Un clic avec Discord. Aucun formulaire, aucun mot de passe.", icon: "🔑" },
                { step: "02", title: "Ajoutez vos cartes", desc: "Importez une série entière ou scannez vos cartes en photo.", icon: "📸" },
                { step: "03", title: "Suivez en temps réel", desc: "Valeur, variation, alertes de prix — tout en un coup d'œil.", icon: "📈" },
              ].map((s) => (
                <div key={s.step} className="relative text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--primary)]/20 bg-[var(--primary)]/8 text-2xl">
                    {s.icon}
                  </div>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--primary)] px-2 py-0.5 text-[10px] font-black text-black">{s.step}</div>
                  <h3 className="mb-2 text-lg font-bold">{s.title}</h3>
                  <p className="text-sm text-[var(--muted)] leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA final ── */}
        <section className="py-24 text-center">
          <div className="mx-auto max-w-2xl px-6">
            <div className="relative overflow-hidden rounded-3xl border border-[var(--primary)]/20 bg-gradient-to-b from-[var(--primary)]/8 to-transparent p-12">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--primary)]/5 via-transparent to-blue-500/5" />
              <div className="relative">
                <p className="mb-3 text-4xl">⚡</p>
                <h2 className="mb-4 text-3xl font-black">Prêt à valoriser votre collection ?</h2>
                <p className="mb-8 text-[var(--muted)]">Rejoignez les collectionneurs qui gardent un œil sur leur investissement.</p>
                <Link href="/api/auth/signin"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] px-8 py-4 text-base font-black text-black shadow-xl shadow-[var(--primary)]/30 transition-all hover:scale-105 hover:shadow-[var(--primary)]/40">
                  Commencer gratuitement →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-xs text-[var(--muted)]">
        <p>© 2026 PokeVault · Données Cardmarket via TCGdex · Projet indépendant, non affilié à Nintendo / The Pokémon Company</p>
      </footer>
    </div>
  );
}

/* ─── Feature data ───────────────────────────────────────────────────────── */

const features = [
  {
    title: "Portfolio en temps réel",
    desc: "Valeur totale, variation 24h, P&L par carte. Graphique d'évolution sur 30 jours avec données Cardmarket.",
    icon: "💼",
    accent: "#f59e0b",
    badge: "Phare",
  },
  {
    title: "Top Movers",
    desc: "Voyez instantanément quelles cartes de votre collection ont le plus monté ou baissé dans les dernières 24h.",
    icon: "🚀",
    accent: "#22c55e",
  },
  {
    title: "Composition du portfolio",
    desc: "Visualisez la répartition de votre collection par série ou par rareté avec un donut chart interactif.",
    icon: "🥧",
    accent: "#8b5cf6",
  },
  {
    title: "Alertes de prix Discord",
    desc: "Configurez un seuil au-dessus ou en dessous duquel vous recevez une notification directement dans Discord.",
    icon: "🔔",
    accent: "#3b82f6",
  },
  {
    title: "Échanges automatiques",
    desc: "Postez ce que vous cherchez et ce que vous offrez. L'algorithme trouve les matches parfaits dans la communauté.",
    icon: "🔄",
    accent: "#ec4899",
  },
  {
    title: "Scan de carte par photo",
    desc: "Prenez une photo d'une carte et l'IA (GPT-4o mini) l'identifie et l'ajoute à votre portfolio en un clic.",
    icon: "📷",
    accent: "#06b6d4",
  },
];

function FeatureCard({ title, desc, icon, accent, badge }: {
  title: string; desc: string; icon: string; accent: string; badge?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/6 bg-[var(--card)] p-7 transition-all hover:-translate-y-1 hover:border-white/12 hover:shadow-xl"
      style={{ boxShadow: `0 0 0 0 ${accent}` }}>
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: `radial-gradient(ellipse at top left, ${accent}0a, transparent 60%)` }} />
      {badge && (
        <span className="absolute right-4 top-4 rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: `${accent}20`, color: accent }}>
          {badge}
        </span>
      )}
      <div className="relative">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition-transform group-hover:scale-110"
          style={{ background: `${accent}15` }}>
          {icon}
        </div>
        <h3 className="mb-2 text-lg font-bold">{title}</h3>
        <p className="text-sm leading-relaxed text-[var(--muted)]">{desc}</p>
      </div>
    </div>
  );
}
