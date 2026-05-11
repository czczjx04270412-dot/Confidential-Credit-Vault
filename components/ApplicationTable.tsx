import { useState } from "react";
import { CreditApplication, riskBandLabel, statusLabel, useCreditVault } from "@/lib/creditVault";
import { useEthereumWallet } from "@/lib/ethereum";
import { fundLoanOnZama } from "@/lib/zamaContract";

const ETH_TO_TEST_USDT = 3000;

function formatEth(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: value % 1 ? 2 : 0 })} ETH`;
}

function formatUsdt(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: value % 1 ? 2 : 0 })} USDT`;
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
  onFund: (id: string, chain?: Pick<CreditApplication, "fundTxHash" | "fundedTo">) => void;
}) {
  const { address } = useEthereumWallet();
  const [explanation, setExplanation] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [fundLoading, setFundLoading] = useState(false);
  const [error, setError] = useState("");

  const isFunded = application.status === "Funded";
  const isChainApplication = Boolean(application.chainApplicationId && application.chainApplicationId !== "unknown");
  const isBorrowerWallet =
    Boolean(address && application.borrowerAddress) && address?.toLowerCase() === application.borrowerAddress?.toLowerCase();
  const canFund = application.approved && !isFunded && isChainApplication && !isBorrowerWallet;
  const fundingEth = lenderFundingEth(application);
  const repaymentEth = Math.max(application.estimatedRepayment / ETH_TO_TEST_USDT, 0.000001).toFixed(6);

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
      if (!response.ok) throw new Error(data.error || "DeepSeek risk explanation generation failed");
      setExplanation(data.explanation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "DeepSeek risk explanation generation failed");
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
      onFund(application.id, { fundTxHash: chain.transactionHash, fundedTo: application.borrowerAddress });
    } catch (err) {
      setError(err instanceof Error ? err.message : "On-chain funding failed");
    } finally {
      setFundLoading(false);
    }
  }

  return (
    <article className="rounded-md border border-line bg-panel p-5 shadow-glow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Borrower</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-100">{application.borrower}</h2>
        </div>
        <span className={`rounded-md bg-ink px-3 py-2 text-sm font-semibold ${riskTone(application)}`}>
          {riskBandLabel(application.riskBand)}
        </span>
      </div>

      <div className="mt-5 rounded-md border border-line bg-ink p-4">
        <p className="text-xs text-slate-500">On-Chain Status</p>
        <p className={`mt-2 text-lg font-semibold ${application.approved ? "text-aqua" : "text-amber"}`}>
          {isFunded ? "Funded, funds transferred to borrower" : application.approved ? "Ready to fund based on AI risk explanation" : "Needs review"}
        </p>
        {application.fundTxHash ? (
          <div className="mt-2 text-xs leading-5 text-aqua">
            <p>
              Funding Tx: {application.fundTxHash.slice(0, 10)}...{application.fundTxHash.slice(-8)}
            </p>
            {application.fundedTo ? (
              <p>
                Funds transferred to borrower wallet: {application.fundedTo.slice(0, 6)}...{application.fundedTo.slice(-4)}
              </p>
            ) : null}
            <a
              href={`https://sepolia.etherscan.io/tx/${application.fundTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline underline-offset-4"
            >
              View Sepolia Tx
            </a>
          </div>
        ) : null}
        {application.repayTxHash ? (
          <p className="mt-2 text-xs text-lime">
            Repayment Tx: {application.repayTxHash.slice(0, 10)}...{application.repayTxHash.slice(-8)}, collateral released to borrower
          </p>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 text-sm md:grid-cols-3">
        <div>
           <p className="text-slate-500">Loan Amount</p>
           <p className="mt-2 text-lg font-semibold text-slate-100">{formatUsdt(application.amount)}</p>
        </div>
        <div>
          <p className="text-slate-500">Public Collateral Ratio</p>
          <p className="mt-2 text-lg font-semibold text-slate-100">{application.collateralRatio}%</p>
        </div>
        <div>
          <p className="text-slate-500">Lender Target Yield</p>
          <p className="mt-2 text-lg font-semibold text-slate-100">{targetYield(application)}</p>
        </div>
      </div>

      <div className="mt-5 rounded-md bg-ink p-4 text-sm leading-6 text-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-slate-100">DeepSeek Risk Explanation</p>
          <button
            onClick={generateAiExplanation}
            disabled={aiLoading}
            className="rounded-md border border-aqua/40 px-3 py-2 text-xs font-semibold text-aqua transition hover:bg-aqua/10 disabled:cursor-wait disabled:border-line disabled:text-slate-500"
          >
            {aiLoading ? "Generating..." : explanation ? "Refresh DeepSeek" : "Call DeepSeek"}
          </button>
        </div>
        <p className="mt-3 whitespace-pre-wrap">
          {explanation ||
            "Click the button to have DeepSeek generate a lender explanation based on risk level, risk score, collateral ratio, suggested rate, and repayment amount. AI does not read raw income, credit history, debt pressure, or asset source data."}
        </p>
      </div>

      <div className="mt-4 rounded-md border border-line bg-black/20 p-4 text-sm leading-6 text-slate-300">
        Lender decision logic: first review the risk results output by the Zama contract, then use DeepSeek explanations to decide whether to fund. The borrower's raw private data is not displayed to the lender.
      </div>

      <div className="mt-4 rounded-md border border-line bg-black/20 p-4">
        <p className="text-sm font-semibold text-slate-100">Lender Assessment</p>
        <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
          <p>
              Best case: Borrower repays principal {formatUsdt(application.amount)} + interest {formatUsdt(application.estimatedInterest)} on time.
          </p>
          <p>Worst case: If the borrower defaults or is overdue, the lender needs to monitor collateral coverage and principal protection.</p>
          <p>Key points: principal protection, interest target met, funds locked for {application.termLabel}, clear repayment amount.</p>
          <p>
            Repayment: Borrower repays {formatUsdt(application.estimatedRepayment)}.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-400">
          <span>Term: {application.termLabel}</span>
          <span className="mx-2 text-slate-600">/</span>
           <span>Repayment: {formatUsdt(application.estimatedRepayment)}</span>
          <span className="mx-2 text-slate-600">/</span>
          <span>
            Funding Amount: {formatUsdt(application.amount)}
          </span>
        </div>
        <button
          onClick={handleFund}
          disabled={!canFund || fundLoading}
          className="rounded-md border border-aqua/40 px-4 py-2 text-sm font-semibold text-aqua transition hover:bg-aqua/10 disabled:cursor-not-allowed disabled:border-line disabled:text-slate-500"
        >
          {fundLoading ? "Waiting for wallet..." : isFunded ? "Funded" : isBorrowerWallet ? "Cannot self-lend" : "Fund via AI Analysis"}
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
        <h1 className="mt-3 text-3xl font-semibold text-slate-100">Lender View</h1>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-400">
          Lenders review borrowing applications here. First call DeepSeek for a risk explanation, then decide whether to fund on-chain using your wallet. Funds are transferred directly to the borrower's wallet via the contract.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {applications.length ? (
          applications.map((application) => <LenderCard key={application.id} application={application} onFund={fundLoan} />)
        ) : (
          <div className="rounded-md border border-line bg-panel p-5 text-sm leading-6 text-slate-300 shadow-glow xl:col-span-2">
            <p className="font-semibold text-slate-100">No applications available</p>
            <p className="mt-2">Switch to the borrower wallet first and create an on-chain application on the Borrow page. Then switch back to the lender wallet to view AI analysis and fund.</p>
          </div>
        )}
      </div>
    </section>
  );
}