import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode } from "react";
import ConnectWalletButton from "./ConnectWalletButton";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/borrow", label: "Borrow" },
  { href: "/lend", label: "Lend" },
  { href: "/compliance", label: "Compliance" }
];

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <header className="border-b border-line/80 bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-aqua/40 bg-aqua/10 font-semibold text-aqua">
              ZC
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-wide">Zama Confidential Credit Vault</span>
              <span className="block truncate text-xs text-slate-400">Private risk pricing for collateral lending with FHE</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active = router.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-2 text-sm transition ${
                    active ? "bg-aqua/12 text-aqua" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <ConnectWalletButton />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-7">{children}</main>
    </div>
  );
}