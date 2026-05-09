import { useState } from "react";
import { CreditApplication, riskBandLabel, statusLabel, useCreditVault } from "@/lib/creditVault";
import { fundLoanOnZama } from "@/lib/zamaContract";

const ETH_TO_TEST_USDT = 3000;

function formatUsdt(value: number) {
  return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 2, minimumFractionDigits: value % 1 ? 2 : 0 })} USDT`;
}

function riskTone(application: CreditApplication) {
  if (application.riskBand === "Low") return "text-lime";
  if (application.riskBand === "Medium") return "text-amber";
  return "text-danger";
}

function targetYield(application: CreditApplication) {
  const low = Math.max(application.annualInterestRate - 6, 0);
  const high = application.annualInterestRate;
  return `${low.toFixed(0)}% - ${high.toFixed(0)}%`;
}

function lenderFundingEth(application: CreditApplication) {
  return Math.max(application.amount / ETH_TO_TEST_USDT, 0.000001).toFixed(6);
}

function LenderCard({
  application,
  onFund
}: {
  application: CreditApplication;
  onFund: (id: string, chain?: Pick<CreditApplication, "fundTxHash">) => void;
}) {
  const [explanation, setExplanation] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [fundLoading, setFundLoading] = useState(false);
  const [error, setError] = useState("");

  const isFunded = application.status === "Funded";
  const isChainApplication = Boolean(application.chainApplicationId && application.chainApplicationId !== "unknown");
  const canFund = application.approved && !isFunded && isChainApplication;
  const fundingEth = lenderFundingEth(application);

  async function generateAiExplanation() {
    setAiLoading(true);
    setError("");

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
          termLabel: application.termLabel,
          estimatedInterest: application.estimatedInterest,
          estimatedRepayment: application.estimatedRepayment,
          status: statusLabel(application.status)
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "DeepSeek 风险解释生成失败");
      setExplanation(data.explanation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "DeepSeek 风险解释生成失败");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleFund() {
    if (!canFund || !application.chainApplicationId) return;
    setError("");
    setFundLoading(true);

    try {
      const chain = await fundLoanOnZama(application.chainApplicationId, fundingEth);
      onFund(application.id, { fundTxHash: chain.transactionHash });
    } catch (err) {
      setError(err instanceof Error ? err.message : "链上放款失败");
    } finally {
      setFundLoading(false);
    }
  }

  return (
    <article className="rounded-md border border-line bg-panel p-5 shadow-glow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">借款人</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-100">{application.borrower}</h2>
        </div>
        <span className={`rounded-md bg-ink px-3 py-2 text-sm font-semibold ${riskTone(application)}`}>
          {riskBandLabel(application.riskBand)}
        </span>
      </div>

      <div className="mt-5 rounded-md border border-line bg-ink p-4">
        <p className="text-xs text-slate-500">后台状态</p>
        <p className={`mt-2 text-lg font-semibold ${application.approved ? "text-aqua" : "text-amber"}`}>
          {isFunded ? "已放款，资金进入 Vault" : application.approved ? "可发起链上放款" : "需要复核"}
        </p>
        {application.fundTxHash ? (
          <p className="mt-2 text-xs text-aqua">
            放款交易：{application.fundTxHash.slice(0, 10)}...{application.fundTxHash.slice(-8)}
          </p>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 text-sm md:grid-cols-3">
        <div>
          <p className="text-slate-500">借款金额</p>
          <p className="mt-2 text-lg font-semibold text-slate-100">{formatUsdt(application.amount)}</p>
        </div>
        <div>
          <p className="text-slate-500">公开抵押率</p>
          <p className="mt-2 text-lg font-semibold text-slate-100">{application.collateralRatio}%</p>
        </div>
        <div>
          <p className="text-slate-500">贷方目标收益</p>
          <p className="mt-2 text-lg font-semibold text-slate-100">{targetYield(application)}</p>
        </div>
      </div>

      <div className="mt-5 rounded-md bg-ink p-4 text-sm leading-6 text-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-slate-100">AI 风险解释</p>
          <button
            onClick={generateAiExplanation}
            disabled={aiLoading}
            className="rounded-md border border-aqua/40 px-3 py-2 text-xs font-semibold text-aqua transition hover:bg-aqua/10 disabled:cursor-wait disabled:border-line disabled:text-slate-500"
          >
            {aiLoading ? "生成中..." : explanation ? "刷新 DeepSeek 解释" : "调用 DeepSeek"}
          </button>
        </div>
        <p className="mt-3 whitespace-pre-wrap">
          {explanation ||
            "点击按钮后，将把 Zama 合约授权披露的最终风险结果发送给 DeepSeek 生成解释。AI 不读取原始收入、信用历史、负债压力和资产来源。"}
        </p>
      </div>

      <div className="mt-4 rounded-md border border-line bg-black/20 p-4 text-sm leading-6 text-slate-300">
        公开信息：借款金额、抵押率、风险等级、目标收益、期限和预计利息。隐私保护：收益能力、策略暴露、违约历史、市场波动等细节只进入后台风控，不向贷方展示原始数据。
      </div>

      <div className="mt-4 rounded-md border border-line bg-black/20 p-4">
        <p className="text-sm font-semibold text-slate-100">贷方判断</p>
        <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
          <p>最好情况：收回本金 {formatUsdt(application.amount)} + 利息 {formatUsdt(application.estimatedInterest)}。</p>
          <p>最坏情况：抵押物价格下跌后触发清算，本金由抵押净值优先覆盖。</p>
          <p>判断重点：本金保护、利息是否达标、是否容易清算、资金锁定 {application.termLabel}。</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-400">
          <span>期限：{application.termLabel}</span>
          <span className="mx-2 text-slate-600">/</span>
          <span>到期应还：{formatUsdt(application.estimatedRepayment)}</span>
          <span className="mx-2 text-slate-600">/</span>
          <span>本次链上放款：{fundingEth} SepoliaETH</span>
        </div>
        <button
          onClick={handleFund}
          disabled={!canFund || fundLoading}
          className="rounded-md border border-aqua/40 px-4 py-2 text-sm font-semibold text-aqua transition hover:bg-aqua/10 disabled:cursor-not-allowed disabled:border-line disabled:text-slate-500"
        >
          {fundLoading ? "等待钱包确认..." : isFunded ? "已放款" : isChainApplication ? "链上放款" : "仅本地演示"}
        </button>
      </div>

      {error ? <p className="mt-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
    </article>
  );
}

export default function ApplicationTable() {
  const { applications, fundLoan } = useCreditVault();

  return (
    <section>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-aqua">Lender Market</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-100">贷方视角</h1>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-400">
          贷方重点查看本金保护、目标收益、风险等级和 AI 风控解释。链上申请可以由另一个 EVM 钱包发起放款交易，资金会进入合约 Vault。
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {applications.map((application) => (
          <LenderCard key={application.id} application={application} onFund={fundLoan} />
        ))}
      </div>
    </section>
  );
}
