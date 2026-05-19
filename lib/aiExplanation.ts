import { CreditApplication, riskBandLabel, statusLabel } from "@/lib/creditVault";

function formatUsdt(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: value % 1 ? 2 : 0 })} USDT`;
}

export function createStaticRiskExplanation(application: CreditApplication) {
  const riskLabel = riskBandLabel(application.riskBand);
  const status = statusLabel(application.status);
  const collateralGap = application.collateralRatio - application.requiredCollateralRatio;
  const collateralView =
    collateralGap >= 0
      ? `Collateral coverage is ${collateralGap}% above the minimum rule.`
      : `Collateral coverage is ${Math.abs(collateralGap)}% below the minimum rule.`;

  return [
    `Application ${application.id} is currently marked ${status} with a ${riskLabel} contract result.`,
    `The lender can review a risk score of ${application.riskScore}, a public collateral ratio of ${application.collateralRatio}%, and a required minimum collateral ratio of ${application.requiredCollateralRatio}%. ${collateralView}`,
    `The suggested APR is ${application.suggestedRate} for ${application.termLabel}. Estimated interest is ${formatUsdt(application.estimatedInterest)}, making the expected repayment ${formatUsdt(application.estimatedRepayment)}.`,
    "This explanation is generated only from final Zama contract outputs. It does not expose the borrower's raw income, credit history, debt pressure, or asset-source scores."
  ].join("\n\n");
}
