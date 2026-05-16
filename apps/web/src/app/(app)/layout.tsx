import { Navbar } from "@/components/navbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
