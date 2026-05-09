export type RiskProfile = {
  incomeScore: number;
  creditScore: number;
  debtPressure: number;
  assetSource: number;
  credit: {
    repaidLoans: number;
    overdueCount: number;
    liquidationCount: number;
  };
  income: {
    continuousIncomeMonths: number;
    cashflowCoverage: number;
    incomeVolatility: number;
  };
  debt: {
    debtIncomeRatio: number;
    openLoans: number;
    repaymentIncomeRatio: number;
  };
  asset: {
    kycPassed: boolean;
    verifiedIncomeSource: boolean;
    highRiskInteractions: number;
    verifiedAddressAgeMonths: number;
  };
};

export type RiskProfileMode = "safe" | "normal" | "risky";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function hashSeed(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed: number) {
  let state = seed || 1;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

function intBetween(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function boolBy(rng: () => number, probability: number) {
  return rng() < probability;
}

function rangeByMode(mode: RiskProfileMode) {
  if (mode === "safe") {
    return {
      repaidLoans: [5, 10],
      overdueCount: [0, 1],
      liquidationCount: [0, 0],
      continuousIncomeMonths: [12, 36],
      cashflowCoverage: [75, 110],
      incomeVolatility: [3, 18],
      debtIncomeRatio: [8, 32],
      openLoans: [0, 1],
      repaymentIncomeRatio: [5, 22],
      kycProbability: 0.95,
      incomeSourceProbability: 0.9,
      highRiskInteractions: [0, 1],
      verifiedAddressAgeMonths: [12, 48]
    };
  }

  if (mode === "risky") {
    return {
      repaidLoans: [0, 2],
      overdueCount: [1, 4],
      liquidationCount: [0, 2],
      continuousIncomeMonths: [2, 10],
      cashflowCoverage: [25, 65],
      incomeVolatility: [20, 55],
      debtIncomeRatio: [55, 105],
      openLoans: [2, 5],
      repaymentIncomeRatio: [35, 75],
      kycProbability: 0.45,
      incomeSourceProbability: 0.45,
      highRiskInteractions: [1, 4],
      verifiedAddressAgeMonths: [1, 16]
    };
  }

  return {
    repaidLoans: [1, 6],
    overdueCount: [0, 2],
    liquidationCount: [0, 1],
    continuousIncomeMonths: [5, 20],
    cashflowCoverage: [45, 90],
    incomeVolatility: [8, 35],
    debtIncomeRatio: [25, 70],
    openLoans: [0, 3],
    repaymentIncomeRatio: [15, 50],
    kycProbability: 0.75,
    incomeSourceProbability: 0.7,
    highRiskInteractions: [0, 2],
    verifiedAddressAgeMonths: [4, 32]
  };
}

export function profileModeLabel(mode: RiskProfileMode) {
  if (mode === "safe") return "稳健型";
  if (mode === "normal") return "普通型";
  return "高风险型";
}

export function buildRiskProfile(address: string | null, mode: RiskProfileMode): RiskProfile | null {
  if (!address) return null;

  const rng = createRng(hashSeed(`${address.toLowerCase()}:${mode}`));
  const ranges = rangeByMode(mode);

  const credit = {
    repaidLoans: intBetween(rng, ranges.repaidLoans[0], ranges.repaidLoans[1]),
    overdueCount: intBetween(rng, ranges.overdueCount[0], ranges.overdueCount[1]),
    liquidationCount: intBetween(rng, ranges.liquidationCount[0], ranges.liquidationCount[1])
  };

  const income = {
    continuousIncomeMonths: intBetween(rng, ranges.continuousIncomeMonths[0], ranges.continuousIncomeMonths[1]),
    cashflowCoverage: intBetween(rng, ranges.cashflowCoverage[0], ranges.cashflowCoverage[1]),
    incomeVolatility: intBetween(rng, ranges.incomeVolatility[0], ranges.incomeVolatility[1])
  };

  const debt = {
    debtIncomeRatio: intBetween(rng, ranges.debtIncomeRatio[0], ranges.debtIncomeRatio[1]),
    openLoans: intBetween(rng, ranges.openLoans[0], ranges.openLoans[1]),
    repaymentIncomeRatio: intBetween(rng, ranges.repaymentIncomeRatio[0], ranges.repaymentIncomeRatio[1])
  };

  const asset = {
    kycPassed: boolBy(rng, ranges.kycProbability),
    verifiedIncomeSource: boolBy(rng, ranges.incomeSourceProbability),
    highRiskInteractions: intBetween(rng, ranges.highRiskInteractions[0], ranges.highRiskInteractions[1]),
    verifiedAddressAgeMonths: intBetween(rng, ranges.verifiedAddressAgeMonths[0], ranges.verifiedAddressAgeMonths[1])
  };

  const creditScore = clamp(70 + credit.repaidLoans * 5 - credit.overdueCount * 15 - credit.liquidationCount * 25);
  const incomeScore = clamp(income.continuousIncomeMonths * 3 + income.cashflowCoverage - income.incomeVolatility);
  const debtPressure = clamp(debt.debtIncomeRatio * 0.6 + debt.openLoans * 10 + debt.repaymentIncomeRatio * 0.4);
  const assetSource = clamp(
    45 +
      (asset.kycPassed ? 20 : 0) +
      (asset.verifiedIncomeSource ? 15 : 0) +
      Math.min(asset.verifiedAddressAgeMonths, 24) * 0.8 -
      asset.highRiskInteractions * 20
  );

  return { incomeScore, creditScore, debtPressure, assetSource, credit, income, debt, asset };
}
