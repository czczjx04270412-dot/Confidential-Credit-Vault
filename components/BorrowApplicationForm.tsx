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
import { hasConfiguredVault, repayLoanOnZama, submitEncryptedApplicationToZama } from "@/lib/zamaContract";

const ETH_TO_TEST_USDT = 3000;
const PAGE_SIZE = 3;

function formatEth(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: value % 1 ? 2 : 0 })} ETH`;
}

function formatUsdt(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: value % 1 ? 2 : 0 })} USDT`;
}

function ApplicationCard({
  application,
  currentAddress,
  onRepay
}: {
  application: CreditApplication;
  currentAddress: string | null;
  onRepay: (id: string, chain?: Pick<CreditApplication, "repayTxHash">) => void;
}) {
  const [repayStatus, setRepayStatus] = useState("");
  const [repayError, setRepayError] = useState("");
  const [isRepaying, setIsRepaying] = useState(false);
  const resultTone = application.approved
    ? "border-lime/30 bg-lime/5"
    : application.collateralOk
      ? "border-amber/30 bg-amber/5"
      : "border-danger/30 bg-danger/5";
  const isBorrowerWallet =
    Boolean(currentAddress && application.borrowerAddress) && currentAddress?.toLowerCase() === application.borrowerAddress?.toLowerCase();
  const repaymentEth = Math.max(application.estimatedRepayment / ETH_TO_TEST_USDT, 0.000001).toFixed(6);
  const canRepay = application.status === "Funded" && Boolean(application.chainApplicationId) && application.chainApplicationId !== "unknown" && isBorrowerWallet;

  async function handleRepay() {
    if (!canRepay || !application.chainApplicationId) return;
    setRepayError("");
    setRepayStatus("");
    setIsRepaying(true);

    try {
      const chain = await repayLoanOnZama(application.chainApplicationId);
      onRepay(application.id, { repayTxHash: chain.transactionHash });
      setRepayStatus("Repaid on-chain, collateral released");
    } catch (err) {
      setRepayError(err instanceof Error ? err.message : "On-chain repayment failed");
    } finally {
      setIsRepaying(false);
    }
  }

  return (
    <div className={`rounded-md border ${resultTone} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Application ID</p>
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
          On-chain #{application.chainApplicationId || "unknown"} / {application.chainTxHash.slice(0, 10)}...
          {application.chainTxHash.slice(-8)}
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-amber/20 bg-amber/10 p-3 text-xs leading-5 text-amber">
          Local demo record
        </div>
      )}

      <div className="mt-5 grid gap-4 text-sm text-slate-300 md:grid-cols-3">
        <div className="rounded-md bg-ink p-4">
          <p className="text-xs text-slate-500">Borrower</p>
          <p className="mt-2 font-semibold text-slate-100">{application.borrower}</p>
        </div>
        <div className="rounded-md bg-ink p-4">
          <p className="text-xs text-slate-500">Loan Amount</p>
          <p className="mt-2 font-semibold text-slate-100">{formatUsdt(application.amount)}</p>
        </div>
        <div className="rounded-md bg-ink p-4">
          <p className="text-xs text-slate-500">Required Collateral</p>
          <p className="mt-2 font-semibold text-aqua">{formatUsdt(application.requiredCollateralValue)}</p>
        </div>
        <div className="rounded-md bg-ink p-4">
          <p className="text-xs text-slate-500">Risk Result</p>
          <p className="mt-2 font-semibold text-slate-100">
            {application.riskScore} / {riskBandLabel(application.riskBand)}
          </p>
        </div>
        <div className="rounded-md bg-ink p-4">
          <p className="text-xs text-slate-500">Collateral Rule</p>
          <p className="mt-2 font-semibold text-slate-100">
            Current {application.collateralRatio}% / Min {application.requiredCollateralRatio}%
          </p>
        </div>
        <div className="rounded-md bg-ink p-4">
          <p className="text-xs text-slate-500">Repayment Due</p>
          <p className="mt-2 font-semibold text-slate-100">
            {formatUsdt(application.estimatedRepayment)}
          </p>
          <p className="mt-1 text-xs text-slate-500">≈ {formatEth(application.estimatedRepayment / ETH_TO_TEST_USDT)}</p>
        </div>
      </div>
      <div className="mt-5 rounded-md border border-line bg-black/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm leading-6 text-slate-300">
            <p className="font-semibold text-slate-100">Borrower Repayment</p>
            <p>Repayment is initiated from the borrower's wallet. After principal and interest are transferred to the lender, the contract releases the locked collateral.</p>
          </div>
          <button
            onClick={handleRepay}
            disabled={!canRepay || isRepaying}
            className="rounded-md border border-lime/40 px-4 py-2 text-sm font-semibold text-lime transition hover:bg-lime/10 disabled:cursor-not-allowed disabled:border-line disabled:text-slate-500"
          >
            {isRepaying ? "Repaying..." : application.status === "Repaid" ? "Repaid" : canRepay ? "Repay On-Chain" : "Waiting to Repay"}
          </button>
        </div>
        {application.repayTxHash ? (
          <p className="mt-3 text-xs text-lime">
            Repayment Tx: {application.repayTxHash.slice(0, 10)}...{application.repayTxHash.slice(-8)}
          </p>
        ) : null}
        {repayStatus ? <p className="mt-3 text-sm text-lime">{repayStatus}</p> : null}
        {repayError ? <p className="mt-3 text-sm text-danger">{repayError}</p> : null}
      </div>
    </div>
  );
}

export default function BorrowApplicationForm() {
  const { address, chainId, connect, ethBalance, isBalanceLoading, refreshBalance, switchToSepolia } = useEthereumWallet();
  const { applications, submitApplication, repayLoan } = useCreditVault();
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
  const collateralEth = collateralNeeded ? (collateralNeeded / ETH_TO_TEST_USDT).toFixed(6) : "0";
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
      collateralEth,
      incomeScore: riskProfile.incomeScore,
      creditScore: riskProfile.creditScore,
      debtPressure: riskProfile.debtPressure,
      assetSource: riskProfile.assetSource,
      termValue: parsedTermValue,
      termUnit,
      termDays: previewRisk.termDays,
      annualInterestRate: previewRisk.annualInterestRate
    };

    setSubmitError("");
    setIsSubmitting(true);

    try {
      if (isChainMode) {
        setSubmitStatus("Encrypting...");
        const chain = await submitEncryptedApplicationToZama(input, address);
        submitApplication(input, address, {
          chainTxHash: chain.transactionHash,
          chainApplicationId: chain.applicationId,
          contractAddress: chain.contractAddress
        });
        setSubmitStatus("Submitted on-chain");
      } else {
        submitApplication(input, address);
        setSubmitStatus("Local application created");
      }
      setPage(1);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
      setSubmitStatus("");
    } finally {
      setIsSubmitting(false);
    }
  }

  function submitButtonText() {
    if (isSubmitting) return isChainMode ? "Submitting..." : "Generating...";
    if (!address) return "Connect EVM Wallet";
    if (!isOnSepolia) return "Switch to Sepolia";
    if (!parsedTermValue) return "Enter loan term";
    if (previewRisk?.riskBand === "Reject") return "Risk too high";
    if (!hasEnoughCollateral) return "Insufficient balance";
    return isChainMode ? "Encrypt & Submit" : "Generate Application";
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-line bg-panel p-5 shadow-glow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Borrower</p>
            <h1 className="mt-2 text-2xl font-semibold">Borrow Application</h1>
          </div>
          <span className={isChainMode ? "rounded-md bg-aqua/10 px-3 py-2 text-sm text-aqua" : "rounded-md bg-amber/10 px-3 py-2 text-sm text-amber"}>
            {isChainMode ? "Zama On-Chain Mode" : "Local Demo Mode"}
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Wallet Network</p>
            <p className="mt-2 text-lg font-semibold text-slate-100">{formatChain(chainId)}</p>
          </div>
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">SepoliaETH</p>
            <p className="mt-2 text-lg font-semibold text-aqua">
              {isBalanceLoading ? "Loading..." : `${(ethBalance ?? 0).toFixed(6)} ETH`}
            </p>
          </div>
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Available Collateral</p>
            <p className={hasEnoughCollateral ? "mt-2 text-lg font-semibold text-lime" : "mt-2 text-lg font-semibold text-amber"}>
              {availableTestUsdt.toFixed(2)} USDT
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {address && !isOnSepolia ? (
            <button onClick={switchToSepolia} className="rounded-md border border-amber/50 px-3 py-2 text-xs font-semibold text-amber">
              Switch to Sepolia
            </button>
          ) : null}
          <button onClick={refreshBalance} className="rounded-md border border-aqua/40 px-3 py-2 text-xs font-semibold text-aqua">
            Refresh Balance
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-300">Loan Amount</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-2 w-full rounded-md border border-line bg-ink px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-aqua"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-300">Loan Term</span>
            <input
              value={termValue}
              onChange={(event) => setTermValue(event.target.value)}
              className="mt-2 w-full rounded-md border border-line bg-ink px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-aqua"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-300">Term Unit</span>
            <select
              value={termUnit}
              onChange={(event) => setTermUnit(event.target.value as LoanTermUnit)}
              className="mt-2 w-full rounded-md border border-line bg-ink px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-aqua"
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
            </select>
          </label>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Risk Score</p>
            <p className="mt-2 text-xl font-semibold text-aqua">{previewRisk?.riskScore ?? "--"}</p>
          </div>
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Risk Level</p>
            <p className="mt-2 text-xl font-semibold text-slate-100">{previewRisk ? riskBandLabel(previewRisk.riskBand) : "--"}</p>
          </div>
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Min Collateral</p>
            <p className="mt-2 text-xl font-semibold text-amber">{previewRisk ? `${previewRisk.requiredCollateralRatio}%` : "--"}</p>
          </div>
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">APR</p>
            <p className="mt-2 text-xl font-semibold text-slate-100">{previewRisk?.suggestedRate ?? "--"}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Required Collateral</p>
            <p className="mt-2 text-xl font-semibold text-aqua">{collateralNeeded ? formatUsdt(collateralNeeded) : "--"}</p>
          </div>
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Interest Days</p>
            <p className="mt-2 text-xl font-semibold text-slate-100">{previewRisk ? `${previewRisk.termDays} days` : "--"}</p>
          </div>
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Est. Interest</p>
            <p className="mt-2 text-xl font-semibold text-amber">{previewRisk ? formatUsdt(previewRisk.estimatedInterest) : "--"}</p>
          </div>
          <div className="rounded-md border border-line bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Repayment</p>
            <p className="mt-2 text-xl font-semibold text-lime">{previewRisk ? formatUsdt(previewRisk.estimatedRepayment) : "--"}</p>
          </div>
        </div>

        <div className="mt-6 rounded-md border border-line bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm font-semibold text-slate-200">Risk Profile</p>
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
                <p className="text-xs text-slate-500">Credit History</p>
                <p className="mt-2 text-xl font-semibold text-aqua">{riskProfile.creditScore}</p>
              </div>
              <div className="rounded-md bg-ink p-4">
                <p className="text-xs text-slate-500">Income Stability</p>
                <p className="mt-2 text-xl font-semibold text-aqua">{riskProfile.incomeScore}</p>
              </div>
              <div className="rounded-md bg-ink p-4">
                <p className="text-xs text-slate-500">Debt Pressure</p>
                <p className="mt-2 text-xl font-semibold text-amber">{riskProfile.debtPressure}</p>
              </div>
              <div className="rounded-md bg-ink p-4">
                <p className="text-xs text-slate-500">Asset Source</p>
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
            <h2 className="mt-2 text-xl font-semibold">My Applications</h2>
          </div>
          <span className="rounded-md bg-aqua/10 px-3 py-2 text-sm text-aqua">{applications.length} records</span>
        </div>

        <div className="mt-5 space-y-4">
          {visibleApplications.map((application) => (
            <ApplicationCard key={application.id} application={application} currentAddress={address} onRepay={repayLoan} />
          ))}
        </div>

        {applications.length > PAGE_SIZE ? (
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4 text-sm text-slate-400">
            <span>
              Page {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-md border border-line px-3 py-2 font-semibold text-slate-300 disabled:cursor-not-allowed disabled:text-slate-600"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-line px-3 py-2 font-semibold text-slate-300 disabled:cursor-not-allowed disabled:text-slate-600"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}