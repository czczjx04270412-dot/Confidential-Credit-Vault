import Link from "next/link";
import FheFlow from "@/components/FheFlow";
import Layout from "@/components/Layout";
import MetricCard from "@/components/MetricCard";
import { protectedFields, riskBandLabel, statusLabel, useCreditVault } from "@/lib/creditVault";

function formatEth(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: value % 1 ? 2 : 0 })} ETH`;
}

const contractFacts = [
  ["Network", "Ethereum Sepolia"],
  ["Contract", "0x8eC4...7C8f"],
  ["Privacy Layer", "Zama FHEVM"],
  ["Signals", "4 encrypted borrower fields"]
];

export default function HomePage() {
  const { applications } = useCreditVault();
  const approved = applications.filter((application) => application.approved).length;
  const funded = applications.filter((application) => application.status === "Funded").length;
  const totalBorrowed = applications.reduce((sum, application) => sum + application.amount, 0);
  const latestApplication = applications[0];

  return (
    <Layout>
      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <div className="rounded-md border border-line bg-panel p-6 shadow-glow">
          <p className="text-xs font-semibold uppercase tracking-wide text-aqua">Zama FHEVM Lending Demo</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight text-slate-50 md:text-5xl">
            Confidential Credit Vault
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300">
            A privacy lending interface where borrowers submit encrypted risk signals, the smart contract computes lending terms with FHE, and lenders see only the final decision data needed to fund a loan.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/borrow" className="rounded-md bg-aqua px-4 py-3 text-sm font-bold text-ink transition hover:bg-aqua/90">
              Open Borrower Flow
            </Link>
            <Link href="/lend" className="rounded-md border border-aqua/40 px-4 py-3 text-sm font-semibold text-aqua transition hover:bg-aqua/10">
              Review Lender Market
            </Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {contractFacts.map(([label, value]) => (
              <div key={label} className="rounded-md border border-line bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-2 text-sm font-semibold text-slate-100">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-line bg-ink p-5">
          <div className="grid min-h-full content-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Live Demo Snapshot</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <MetricCard label="Applications" value={String(applications.length)} />
                <MetricCard label="Approved" value={String(approved)} tone="lime" />
                <MetricCard label="Funded" value={String(funded)} tone="amber" />
                <MetricCard label="Total Borrowed" value={formatEth(totalBorrowed)} tone="aqua" />
              </div>
            </div>
            <div className="rounded-md border border-line bg-panel p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Latest Result</p>
              {latestApplication ? (
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <p className="font-semibold text-slate-100">{latestApplication.id} / {latestApplication.borrower}</p>
                  <p>Risk: {latestApplication.riskScore} / {riskBandLabel(latestApplication.riskBand)}</p>
                  <p>Collateral: {latestApplication.collateralRatio}% / {latestApplication.requiredCollateralRatio}%</p>
                  <p>Status: {statusLabel(latestApplication.status)}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  No local applications yet. Create one from the Borrow page and this snapshot will update in the browser.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="rounded-md border border-line bg-panel p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Protected Data</p>
          <h2 className="mt-2 text-xl font-semibold">Encrypted Risk Surface</h2>
          <div className="mt-5 grid gap-3">
            {protectedFields.slice(0, 6).map((field) => (
              <div key={field} className="flex items-center justify-between rounded-md bg-black/20 px-3 py-3">
                <span className="text-sm text-slate-300">{field}</span>
                <span className="rounded-md bg-aqua/10 px-2 py-1 text-xs font-semibold text-aqua">FHE</span>
              </div>
            ))}
          </div>
        </div>
        <FheFlow />
      </section>
    </Layout>
  );
}
