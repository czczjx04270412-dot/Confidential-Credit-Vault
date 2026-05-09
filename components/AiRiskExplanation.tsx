import { useState } from "react";
import { CreditApplication, riskBandLabel, statusLabel } from "@/lib/creditVault";

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
      const response = await fetch("/api/risk-explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: application.id,
          riskBand: riskBandLabel(application.riskBand),
          riskScore: application.riskScore,
          collateralRatio: application.collateralRatio,
          requiredCollateralRatio: application.requiredCollateralRatio,
          suggestedRate: application.suggestedRate,
          status: statusLabel(application.status)
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "AI 风控解释生成失败");
      }

      setExplanation(data.explanation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 风控解释生成失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-md border border-line bg-panel p-5 shadow-glow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">AI 风控解释层</p>
          <h2 className="mt-2 text-xl font-semibold">基于授权结果生成贷方说明</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            AI 只读取 Zama 合约授权披露的风险等级、抵押率和利率，不读取收入、信用历史、负债压力等原始隐私数据。
          </p>
        </div>
        <button
          onClick={generateExplanation}
          disabled={!application || loading}
          className="rounded-md bg-aqua px-4 py-3 text-sm font-bold text-ink transition hover:bg-aqua/90 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
        >
          {loading ? "生成中..." : "生成 AI 风控解释"}
        </button>
      </div>

      {application ? (
        <div className="mt-5 grid gap-3 text-sm text-slate-300 md:grid-cols-4">
          <span>申请：{application.id}</span>
          <span>风险：{riskBandLabel(application.riskBand)}</span>
          <span>当前抵押率：{application.collateralRatio}%</span>
          <span>最低抵押率：{application.requiredCollateralRatio}%</span>
        </div>
      ) : (
        <p className="mt-5 text-sm text-slate-500">暂无可解释的申请。</p>
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
