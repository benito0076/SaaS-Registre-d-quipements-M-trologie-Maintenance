import Link from "next/link";
import { Gauge } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2 text-lg font-semibold">
        <Gauge className="size-6" /> Registre Métrologie
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
