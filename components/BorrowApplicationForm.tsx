import { useMemo, useState } from "react";
import { formatChain, isSepolia, useEthereumWallet } from "@/lib/ethereum";
import {
  computeRisk,
  CreditApplication,
  CreditApplicationInput,
  LoanTermUnit,
  riskBandLabel,
  statusLabel,
  useCreditVault
} from "@/lib/creditVault";
import { buildRiskProfile, profileModeLabel, RiskProfileMode } from "@/lib/riskProfile";
import { hasConfiguredVault, submitEncryptedApplicationToZama } from "@/lib/zamaContract";

const ETH_TO_TEST_USDT = 3000;
const PAGE_SIZE = 3;

function formatUsdt(value: number) {
  return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 2, minimumFractionDigits: value % 1 ? 2 : 0 })} USDT`;
}

function ApplicationCard({ application }: { application: CreditApplication }) {
  const resultTone = application.approved
    ? "border-lime/30 bg-lime/5"
    : application.collateralOk
      ? "border-amber/30 bg-amber/5"
      : "border-danger/30 bg-danger/5";

  return (
    <div className={`rounded-md border ${resultTone} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">申请编号</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-100">{application.id}</h3>
        </div>
        <span
          className={`rounded-md px-3 py-2 text-sm font-semibold ${
            application.approved ? "bg-lime/10 text-lime" : application.collateralOk ? "bg-amber/10 text-amber" : "bg-danger/10 text-danger"
          }`}
        >
          {statusLabel(application.status)}
        </span>
      </div>

      {application.chainTxHash ? (
        <div className="mt-4 rounded-md border border-aqua/20 bg-aqua/10 p-3 text-xs leading-5 text-aqua">
          链上申请 #{application.chainApplicationId || "unknown"} / {application.chainTxHash.slice(0, 10)}...
          {application.chainTxHash.slice(-8)}
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-amber/20 bg-amber/10 p-3 text-xs leading-5 text-amber">
          本地演示记录
        </div>
      )}

      <div className="mt-5 grid gap-4 text-sm text-slate-300 md:grid-cols-3">
        <div className="rounded-md bg-ink p-4">
          <p className="text-xs text-slate-500">借款人</p>
          <p className="mt-2 font-semibold text-slate-100">{application.borrower}</p>
        </div>
        <div className="rounded-md bg-ink p-4">
          <p className="text-xs text-slate-500">借款金额</p>
          <p className="mt-2 font-semibold text-slate-100">{formatUsdt(application.amount)}</p>
        </div>
        <div className="rounded-md bg-ink p-4">
          <p className="text-xs text-slate-500">建议抵押净值</p>
          <p className="mt-2 font-semibold text-aqua">{formatUsdt(application.requiredCollateralValue)}</p>
        </div>
        <div className="rounded-md bg-ink p-4">
          <p className="text-xs text-slate-500">风险结果</p>
          <p className="mt-2 font-semibold text-slate-100">
            {application.riskScore} / {riskBandLabel(application.riskBand)}
          </p>
        </div>
        <div className="rounded-md bg-ink p-4">
          <p className="text-xs text-slate-500">抵押规则</p>
          <p className="mt-2 font-semibold text-slate-100">
            当前 {application.collateralRatio}% / 最低 {application.requiredCollateralRatio}%
          </p>
        </div>
        <div className="rounded-md bg-ink p-4">
          <p className="text-xs text-slate-500">到期应还</p>
          <p className="mt-2 font-semibold text-slate-100">{formatUsdt(application.estimatedRepayment)}</p>
        </div>
      </div>
    </div>
  );
}

export default function BorrowApplicationForm() {
  const { address, chainId, connect, ethBalance, isBalanceLoading, refreshBalance, switchToSepolia } = useEthereumWallet();
  const { applications, submitApplication } = useCreditVault();
  const [profileMode, setProfileMode] = useState<RiskProfileMode>("safe");
  const [amount, setAmount] = useState("1500");
  const [termValue, setTermValue] = useState("30");
  const [termUnit, setTermUnit] = useState<LoanTermUnit>("day");
  const [page, setPage] = useState(1);
  const [submitStatus, setSubmitStatus] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const riskProfile = useMemo(() => buildRiskProfile(address, profileMode), [address, profileMode]);
  const borrowAmount = Math.max(Number(amount) || 0, 0);
  const parsedTermValue = Math.max(Number(termValue) || 0, 0);
  const previewRisk = useMemo(() => {
    if (!riskProfile || !borrowAmount || !parsedTermValue) return null;
    return computeRisk({
      amount: borrowAmount,
      collateral: 0,
      incomeScore: riskProfile.incomeScore,
      creditScore: riskProfile.creditScore,
      debtPressure: riskProfile.debtPressure,
      assetSource: riskProfile.assetSource,
      termValue: parsedTermValue,
      termUnit
    });
  }, [borrowAmount, parsedTermValue, riskProfile, termUnit]);

  const collateralNeeded = previewRisk?.requiredCollateralValue ?? 0;
  const availableTestUsdt = Math.floor((ethBalance ?? 0) * ETH_TO_TEST_USDT * 100) / 100;
  const isOnSepolia = isSepolia(chainId);
  const hasEnoughCollateral = Boolean(address) && isOnSepolia && collateralNeeded > 0 && availableTestUsdt >= collateralNeeded;
  const canSubmit = Boolean(address && riskProfile && previewRisk && hasEnoughCollateral && previewRisk.riskBand !== "Reject");
  const totalPages = Math.max(1, Math.ceil(applications.length / PAGE_SIZE));
  const visibleApplications = applications.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const isChainMode = hasConfiguredVault();

  async function handleSubmit() {
    if (!address) {
      connect();
      return;
    }
    if (!canSubmit || !riskProfile || !previewRisk) return;

    const input: CreditApplicationInput = {
      amount: borrowAmount,
      collateral: previewRisk.requiredCollateralValue,
      incomeScore: riskProfile.incomeScore,
      creditScore: riskProfile.creditScore,
      debtPressure: riskProfile.debtPressure,
      assetSource: riskProfile.assetSource,
      termValue: parsedTermValue,
      termUnit
    };

    setSubmitError("");
    setIsSubmitting(true);

    try {
      if (isChainMode) {
        setSubmitStatus("加密中...");
        const chain = await submitEncryptedApplicationToZama(input, address);
        submitApplication(input, address, {
          chainTxHash: chain.transactionHash,
          chainApplicationId: chain.applicationId,
          contractAddress: chain.contractAddress
        });
        setSubmitStatus("已提交链上申请");
      } else {
        submitApplication(input, address);
        setSubmitStatus("已生成本地申请");
      }
      setPage(1);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "提交失败");
      setSubmitStatus("");
    } finally {
      setIsSubmitting(false);
    }
  }

  function submitButtonText() {
    if (isSubmitting) return isChainMode ? "提交中..." : "生成中...";
    if (!address) return "连接 EVM 钱包";
    if (!isOnSepolia) return "切换 Sepolia";
    if (!parsedTermValue) return "填写期限";
    if (previewRisk?.riskBand === "Reject") return "风险过高";
    if (!hasEnoughCollateral) return "余额不足";
    return isChainMode ? "加密并提交" : "生成申请";
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-line bg-panel p-5 shadow-glow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Borrower</p>
            <h1 className="mt-2 text-2xl font-semibold">借款申请</h1>
          </div>
          <span className={isChainMode ? "rounded-md bg-aqua/10 px-3 py-2 text-sm text-aqua" : "rounded-md bg-amber/10 px-3 py-2 text-sm text-amber"}>
            {isChainMode ? "Zama 链上模式" : "本地演示模式"}
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">钱包网络</p>
            <p className="mt-2 text-lg font-semibold text-slate-100">{formatChain(chainId)}</p>
          </div>
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">SepoliaETH</p>
            <p className="mt-2 text-lg font-semibold text-aqua">
              {isBalanceLoading ? "读取中..." : `${(ethBalance ?? 0).toFixed(6)} ETH`}
            </p>
          </div>
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">可用抵押额度</p>
            <p className={hasEnoughCollateral ? "mt-2 text-lg font-semibold text-lime" : "mt-2 text-lg font-semibold text-amber"}>
              {availableTestUsdt.toFixed(2)} USDT
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {address && !isOnSepolia ? (
            <button onClick={switchToSepolia} className="rounded-md border border-amber/50 px-3 py-2 text-xs font-semibold text-amber">
              切换 Sepolia
            </button>
          ) : null}
          <button onClick={refreshBalance} className="rounded-md border border-aqua/40 px-3 py-2 text-xs font-semibold text-aqua">
            刷新余额
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-300">借款金额</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-2 w-full rounded-md border border-line bg-ink px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-aqua"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-300">借款期限</span>
            <input
              value={termValue}
              onChange={(event) => setTermValue(event.target.value)}
              className="mt-2 w-full rounded-md border border-line bg-ink px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-aqua"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-300">期限单位</span>
            <select
              value={termUnit}
              onChange={(event) => setTermUnit(event.target.value as LoanTermUnit)}
              className="mt-2 w-full rounded-md border border-line bg-ink px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-aqua"
            >
              <option value="day">天</option>
              <option value="week">周</option>
              <option value="month">月</option>
              <option value="year">年</option>
            </select>
          </label>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">风险分</p>
            <p className="mt-2 text-xl font-semibold text-aqua">{previewRisk?.riskScore ?? "--"}</p>
          </div>
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">风险等级</p>
            <p className="mt-2 text-xl font-semibold text-slate-100">{previewRisk ? riskBandLabel(previewRisk.riskBand) : "--"}</p>
          </div>
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">最低抵押率</p>
            <p className="mt-2 text-xl font-semibold text-amber">{previewRisk ? `${previewRisk.requiredCollateralRatio}%` : "--"}</p>
          </div>
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">年化利率</p>
            <p className="mt-2 text-xl font-semibold text-slate-100">{previewRisk?.suggestedRate ?? "--"}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">建议抵押净值</p>
            <p className="mt-2 text-xl font-semibold text-aqua">{collateralNeeded ? formatUsdt(collateralNeeded) : "--"}</p>
          </div>
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">计息天数</p>
            <p className="mt-2 text-xl font-semibold text-slate-100">{previewRisk ? `${previewRisk.termDays} 天` : "--"}</p>
          </div>
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">预计利息</p>
            <p className="mt-2 text-xl font-semibold text-amber">{previewRisk ? formatUsdt(previewRisk.estimatedInterest) : "--"}</p>
          </div>
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">到期应还</p>
            <p className="mt-2 text-xl font-semibold text-lime">{previewRisk ? formatUsdt(previewRisk.estimatedRepayment) : "--"}</p>
          </div>
        </div>

        <div className="mt-6 rounded-md border border-line bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm font-semibold text-slate-200">风险画像</p>
            <div className="flex rounded-md border border-line bg-ink p-1">
              {(["safe", "normal", "risky"] as RiskProfileMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setProfileMode(mode)}
                  className={`rounded px-3 py-2 text-sm font-semibold transition ${
                    profileMode === mode ? "bg-aqua text-ink" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                  }`}
                >
                  {profileModeLabel(mode)}
                </button>
              ))}
            </div>
          </div>

          {riskProfile ? (
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div className="rounded-md bg-ink p-4">
                <p className="text-xs text-slate-500">信用历史</p>
                <p className="mt-2 text-xl font-semibold text-aqua">{riskProfile.creditScore}</p>
              </div>
              <div className="rounded-md bg-ink p-4">
                <p className="text-xs text-slate-500">收入稳定性</p>
                <p className="mt-2 text-xl font-semibold text-aqua">{riskProfile.incomeScore}</p>
              </div>
              <div className="rounded-md bg-ink p-4">
                <p className="text-xs text-slate-500">负债压力</p>
                <p className="mt-2 text-xl font-semibold text-amber">{riskProfile.debtPressure}</p>
              </div>
              <div className="rounded-md bg-ink p-4">
                <p className="text-xs text-slate-500">资产来源</p>
                <p className="mt-2 text-xl font-semibold text-aqua">{riskProfile.assetSource}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={Boolean(address) && (!canSubmit || isSubmitting)}
            className="rounded-md bg-aqua px-4 py-3 text-sm font-bold text-ink transition hover:bg-aqua/90 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
          >
            {submitButtonText()}
          </button>
          {submitStatus ? <span className="text-sm text-aqua">{submitStatus}</span> : null}
          {submitError ? <span className="text-sm text-danger">{submitError}</span> : null}
        </div>
      </section>

      <section className="rounded-md border border-line bg-panel p-5 shadow-glow">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Records</p>
            <h2 className="mt-2 text-xl font-semibold">我的申请</h2>
          </div>
          <span className="rounded-md bg-aqua/10 px-3 py-2 text-sm text-aqua">共 {applications.length} 条</span>
        </div>

        <div className="mt-5 space-y-4">
          {visibleApplications.map((application) => (
            <ApplicationCard key={application.id} application={application} />
          ))}
        </div>

        {applications.length > PAGE_SIZE ? (
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4 text-sm text-slate-400">
            <span>
              第 {page} / {totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-md border border-line px-3 py-2 font-semibold text-slate-300 disabled:cursor-not-allowed disabled:text-slate-600"
              >
                上一页
              </button>
              <button
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-line px-3 py-2 font-semibold text-slate-300 disabled:cursor-not-allowed disabled:text-slate-600"
              >
                下一页
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
