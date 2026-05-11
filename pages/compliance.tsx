import Layout from "@/components/Layout";

const rules = [
  "Borrower's financial scores are submitted as encrypted inputs.",
  "The contract computes risk level, minimum collateral ratio, and suggested rate on ciphertexts.",
  "Lenders judge based on final risk results and DeepSeek explanations, without accessing raw private data.",
  "Borrower deposits collateral; after the lender funds, the loan is transferred to the borrower's wallet via the contract.",
  "When the borrower repays on-chain, principal and interest go to the lender, and the collateral is released back to the borrower."
];

export default function CompliancePage() {
  return (
    <Layout>
      <section className="rounded-md border border-line bg-panel p-5 shadow-glow">
        <p className="text-xs uppercase tracking-wide text-slate-500">Privacy And Compliance</p>
        <h1 className="mt-2 text-2xl font-semibold">Data-Minimized Privacy Finance Design</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          The product is designed around data minimization: the public cannot see the borrower's raw risk signals;
          lenders only see the final risk results, collateral ratio, interest rate, and repayment information needed for lending decisions.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {rules.map((rule) => (
            <div key={rule} className="rounded-md border border-line bg-black/20 px-4 py-4 text-sm text-slate-300">
              {rule}
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-md border border-line bg-ink p-4">
          <p className="text-sm font-semibold text-slate-200">Role Permissions</p>
          <div className="mt-3 grid gap-3 text-sm text-slate-400 md:grid-cols-4">
            <span>Public: can only see public metadata</span>
            <span>Borrower: submits encrypted data and repays</span>
            <span>Lender: views risk results and funds loans</span>
            <span>Contract: locks collateral, transfers, settles</span>
          </div>
        </div>
      </section>
    </Layout>
  );
}