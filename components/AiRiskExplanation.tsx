import { useState } from "react";
import { createStaticRiskExplanation } from "@/lib/aiExplanation";
import { CreditApplication, riskBandLabel } from "@/lib/creditVault";

type AiRiskExplanationProps = {
  application: CreditApplication | null;
};

export default function AiRiskExplanation({ application }: AiRiskExplanationProps) {
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateExplanation() {
    if (!application) return;

    setLoading(true);
    setError("");
    setExplanation("");

    try {
      setExplanation(createStaticRiskExplanation(application));
    } catch {
      setError("AI risk explanation generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-md border border-line bg-panel p-5 shadow-glow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">AI Risk Explanation</p>
          <h2 className="mt-2 text-xl font-semibold">Generate lender explanation from Zama results</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            AI only reads the risk level, collateral ratio, interest rate, and repayment amount output by the Zama contract. It does not read raw privacy data such as income, credit history, or debt pressure.
          </p>
        </div>
        <button
          onClick={generateExplanation}
          disabled={!application || loading}
          className="rounded-md bg-aqua px-4 py-3 text-sm font-bold text-ink transition hover:bg-aqua/90 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
        >
          {loading ? "Generating..." : "Generate AI Risk Explanation"}
        </button>
      </div>

      {application ? (
        <div className="mt-5 grid gap-3 text-sm text-slate-300 md:grid-cols-4">
          <span>Application: {application.id}</span>
          <span>Risk: {riskBandLabel(application.riskBand)}</span>
          <span>Current Collateral Ratio: {application.collateralRatio}%</span>
          <span>Min Collateral Ratio: {application.requiredCollateralRatio}%</span>
        </div>
      ) : (
        <p className="mt-5 text-sm text-slate-500">No application to explain.</p>
      )}

      {error ? <p className="mt-5 rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error}</p> : null}

      {explanation ? (
        <div className="mt-5 whitespace-pre-wrap rounded-md border border-line bg-black/20 p-4 text-sm leading-6 text-slate-200">
          {explanation}
        </div>
      ) : null}
    </section>
  );
}
