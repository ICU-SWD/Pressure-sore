import Link from "next/link";
import { getSession } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

export default async function NavBar() {
  const session = await getSession();
  if (!session) return null;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/dashboard" className="text-lg font-bold text-brand-700">
          🛡️ Pressure Sore Guard
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/dashboard" className="rounded-lg px-3 py-2 hover:bg-slate-100">
            แดชบอร์ด
          </Link>
          <Link href="/my-beds" className="rounded-lg px-3 py-2 hover:bg-slate-100">
            เตียงของฉัน
          </Link>
          {session.role === "ADMIN" && (
            <Link href="/admin/beds" className="rounded-lg px-3 py-2 hover:bg-slate-100">
              จัดการระบบ
            </Link>
          )}
          <span className="ml-2 hidden text-slate-500 sm:inline">{session.name}</span>
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}
