import { createContext, ReactNode, useContext, useMemo, useState } from "react";

export type ApplicationStatus = "Encrypted review" | "Approved" | "Needs review" | "Funded" | "Repaid";
export type RiskBand = "Low" | "Medium" | "High" | "Reject";
export type LoanTermUnit = "day" | "week" | "month" | "year";

export type CreditApplicationInput = {
  amount: number;
  collateral: number;
  incomeScore: number;
  creditScore: number;
  debtPressure: number;
  assetSource: number;
  termValue: number;
  termUnit: LoanTermUnit;
};

export type RiskResult = {
  riskScore: number;
  riskBand: RiskBand;
  collateralRatio: number;
  requiredCollateralRatio: number;
  requiredCollateralValue: number;
  collateralOk: boolean;
  approved: boolean;
  suggestedRate: string;
  annualInterestRate: number;
  termDays: number;
  termLabel: string;
  estimatedInterest: number;
  estimatedRepayment: number;
};

export type CreditApplication = CreditApplicationInput &
  RiskResult & {
    id: string;
    borrower: string;
    submittedAt: string;
    encryptedHandles: Record<"incomeScore" | "creditScore" | "debtPressure" | "assetSource", string>;
    status: ApplicationStatus;
    lenderAccess: boolean;
    chainTxHash?: string;
    chainApplicationId?: string;
    contractAddress?: string;
    fundTxHash?: string;
  };

type CreditVaultContextValue = {
  applications: CreditApplication[];
  submitApplication: (
    input: CreditApplicationInput,
    borrower: string,
    chain?: Pick<CreditApplication, "chainTxHash" | "chainApplicationId" | "contractAddress">
  ) => CreditApplication;
  grantLenderAccess: (id: string) => void;
  fundLoan: (id: string, chain?: Pick<CreditApplication, "fundTxHash">) => void;
};

const CreditVaultContext = createContext<CreditVaultContextValue | null>(null);

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function makeHandle(label: string, id: string) {
  const hex = `${label}:${id}`
    .split("")
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex.slice(0, 24).padEnd(24, "0")}...`;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function rateByBand(riskBand: RiskBand) {
  if (riskBand === "Low") return 18;
  if (riskBand === "Medium") return 36;
  if (riskBand === "High") return 72;
  return 0;
}

export function termUnitLabel(unit: LoanTermUnit) {
  if (unit === "day") return "天";
  if (unit === "week") return "周";
  if (unit === "month") return "个月";
  return "年";
}

export function termToDays(value: number, unit: LoanTermUnit) {
  const safeValue = Math.max(value || 0, 0);
  if (unit === "day") return safeValue;
  if (unit === "week") return safeValue * 7;
  if (unit === "month") return safeValue * 30;
  return safeValue * 365;
}

export function computeRisk(input: CreditApplicationInput): RiskResult {
  const score = input.creditScore * 0.4 + input.incomeScore * 0.3 + input.assetSource * 0.2 - input.debtPressure * 0.1;
  const riskScore = Math.max(0, Math.min(100, Math.round(score)));
  const collateralRatio = Math.round((input.collateral / Math.max(input.amount, 1)) * 100);
  const riskBand: RiskBand = riskScore >= 85 ? "Low" : riskScore >= 70 ? "Medium" : riskScore >= 50 ? "High" : "Reject";
  const requiredCollateralRatio =
    riskBand === "Low" ? 120 : riskBand === "Medium" ? 150 : riskBand === "High" ? 180 : 999;
  const requiredCollateralValue = Math.ceil(input.amount * (requiredCollateralRatio / 100));
  const collateralOk = collateralRatio >= requiredCollateralRatio;
  const approved = riskBand !== "Reject" && collateralOk;
  const annualInterestRate = rateByBand(riskBand);
  const suggestedRate = annualInterestRate ? `${annualInterestRate.toFixed(1)}%` : "无";
  const termDays = termToDays(input.termValue, input.termUnit);
  const estimatedInterest = roundCurrency(input.amount * (annualInterestRate / 100) * (termDays / 365));
  const estimatedRepayment = roundCurrency(input.amount + estimatedInterest);
  const termLabel = `${input.termValue} ${termUnitLabel(input.termUnit)}`;

  return {
    riskScore,
    approved,
    riskBand,
    suggestedRate,
    annualInterestRate,
    termDays,
    termLabel,
    estimatedInterest,
    estimatedRepayment,
    collateralRatio,
    requiredCollateralRatio,
    requiredCollateralValue,
    collateralOk
  };
}

const seedApplications: CreditApplication[] = [
  {
    id: "APP-001",
    borrower: "0x8f3a...91c2",
    amount: 1200,
    collateral: 2100,
    incomeScore: 88,
    creditScore: 92,
    debtPressure: 20,
    assetSource: 86,
    termValue: 3,
    termUnit: "month",
    submittedAt: "演示数据",
    encryptedHandles: {
      incomeScore: "0x656e635f696e636f6d65...",
      creditScore: "0x656e635f637265646974...",
      debtPressure: "0x656e635f646562745f70...",
      assetSource: "0x656e635f617373657473..."
    },
    riskScore: 78,
    riskBand: "Medium",
    collateralRatio: 175,
    requiredCollateralRatio: 150,
    requiredCollateralValue: 1800,
    collateralOk: true,
    approved: true,
    suggestedRate: "36.0%",
    annualInterestRate: 36,
    termDays: 90,
    termLabel: "3 个月",
    estimatedInterest: 106.52,
    estimatedRepayment: 1306.52,
    status: "Approved",
    lenderAccess: true
  }
];

export const protectedFields = [
  "收入稳定性评分",
  "信用历史评分",
  "负债压力评分",
  "资产来源评分",
  "加密风险分",
  "最低抵押率",
  "建议利率",
  "预计利息",
  "审批结果"
];

export function riskBandLabel(riskBand: RiskBand) {
  if (riskBand === "Low") return "低风险";
  if (riskBand === "Medium") return "中风险";
  if (riskBand === "High") return "高风险";
  return "拒绝";
}

export function statusLabel(status: ApplicationStatus) {
  if (status === "Encrypted review") return "加密审核中";
  if (status === "Approved") return "已通过";
  if (status === "Needs review") return "需要复核";
  if (status === "Funded") return "已放款";
  return "已还款";
}

export function CreditVaultProvider({ children }: { children: ReactNode }) {
  const [applications, setApplications] = useState<CreditApplication[]>(seedApplications);

  const value = useMemo<CreditVaultContextValue>(
    () => ({
      applications,
      submitApplication(input, borrower, chain) {
        const id = `APP-${String(applications.length + 1).padStart(3, "0")}`;
        const result = computeRisk(input);
        const application: CreditApplication = {
          id,
          borrower: shortAddress(borrower),
          ...input,
          ...result,
          submittedAt: new Date().toLocaleString(),
          encryptedHandles: {
            incomeScore: makeHandle("income", id),
            creditScore: makeHandle("credit", id),
            debtPressure: makeHandle("debt", id),
            assetSource: makeHandle("asset", id)
          },
          status: result.approved ? "Approved" : "Needs review",
          lenderAccess: result.approved,
          ...chain
        };
        setApplications((current) => [application, ...current]);
        return application;
      },
      grantLenderAccess(id) {
        setApplications((current) =>
          current.map((application) => (application.id === id ? { ...application, lenderAccess: true } : application))
        );
      },
      fundLoan(id, chain) {
        setApplications((current) =>
          current.map((application) => (application.id === id ? { ...application, status: "Funded", ...chain } : application))
        );
      }
    }),
    [applications]
  );

  return <CreditVaultContext.Provider value={value}>{children}</CreditVaultContext.Provider>;
}

export function useCreditVault() {
  const context = useContext(CreditVaultContext);
  if (!context) throw new Error("useCreditVault must be used within CreditVaultProvider");
  return context;
}
