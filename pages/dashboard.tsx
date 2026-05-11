import Layout from "@/components/Layout";
import MetricCard from "@/components/MetricCard";
import { protectedFields, riskBandLabel, statusLabel, useCreditVault } from "@/lib/creditVault";

function formatEth(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: value % 1 ? 2 : 0 })} ETH`;
}

export default function DashboardPage() {
  const { applications } = useCreditVault();
  const approved = applications.filter((application) => application.approved).length;
  const funded = applications.filter((application) => application.status === "Funded").length;
  const totalBorrowed = applications.reduce((sum, application) => sum + application.amount, 0);
  const latestApplications = applications.slice(0, 5);

  return (
    <Layout>
      <section className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-aqua">Dashboard</p>
          <h1 className="mt-3 text-3xl font-semibold">Overview</h1>
        </div>
        <span className="rounded-md border border-aqua/30 bg-aqua/10 px-3 py-2 text-sm text-aqua">Sepolia / Zama</span>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Applications" value={String(applications.length)} />
        <MetricCard label="Approved" value={String(approved)} tone="lime" />
        <MetricCard label="Funded" value={String(funded)} tone="amber" />
        <MetricCard label="Total Borrowed" value={formatEth(totalBorrowed)} tone="aqua" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-md border border-line bg-panel p-5 shadow-glow">
          <p className="text-xs uppercase tracking-wide text-slate-500">Protected Fields</p>
          <h2 className="mt-2 text-xl font-semibold">Encrypted Fields</h2>
          <div className="mt-5 space-y-3">
            {protectedFields.map((field) => (
              <div key={field} className="flex items-center justify-between rounded-md bg-black/20 px-3 py-3">
                <span className="text-sm text-slate-300">{field}</span>
                <span className="rounded-md bg-aqua/10 px-2 py-1 text-xs text-aqua">FHE</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-line bg-panel p-5 shadow-glow">
          <p className="text-xs uppercase tracking-wide text-slate-500">Latest</p>
          <h2 className="mt-2 text-xl font-semibold">Recent Applications</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-3 pr-4">ID</th>
                  <th className="py-3 pr-4">Borrower</th>
                  <th className="py-3 pr-4">Amount</th>
                  <th className="py-3 pr-4">Risk</th>
                  <th className="py-3 pr-4">Collateral</th>
                  <th className="py-3 pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {latestApplications.length ? (
                  latestApplications.map((application) => (
                    <tr key={application.id}>
                      <td className="py-4 pr-4 font-semibold text-slate-100">{application.id}</td>
                      <td className="py-4 pr-4 text-slate-300">{application.borrower}</td>
                      <td className="py-4 pr-4 text-slate-300">{formatEth(application.amount)}</td>
                      <td className="py-4 pr-4 text-aqua">
                        {application.riskScore} / {riskBandLabel(application.riskBand)}
                      </td>
                      <td className="py-4 pr-4 text-slate-300">
                        {application.collateralRatio}% / {application.requiredCollateralRatio}%
                      </td>
                      <td className="py-4 pr-4 text-slate-300">{statusLabel(application.status)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-4 pr-4 text-slate-500" colSpan={6}>
                      No applications yet. Go to the Borrow page to create one on-chain.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Layout>
  );
}