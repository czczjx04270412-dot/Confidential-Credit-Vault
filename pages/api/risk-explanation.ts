import type { NextApiRequest, NextApiResponse } from "next";

type RiskExplanationRequest = {
  applicationId: string;
  riskBand: string;
  riskScore: number;
  collateralRatio: number;
  requiredCollateralRatio: number;
  suggestedRate: string;
  termLabel?: string;
  estimatedInterest?: number;
  estimatedRepayment?: number;
  status: string;
};

type RiskExplanationResponse = {
  explanation?: string;
  error?: string;
};

const systemPrompt = `
You are a DeFi privacy credit risk explanation assistant for a Zama FHE-based confidential lending dApp.

Your task is NOT to recalculate credit scores or read the borrower's raw data. Your task is to explain the final risk assessment results already output by the smart contract, helping lenders understand the risk of this loan application.

You may ONLY use the following information: risk band, risk score, current collateral ratio, minimum collateral ratio, suggested APR, loan term, estimated interest, estimated repayment amount, and on-chain status.

You must NOT read, infer, or fabricate the borrower's raw income, credit history, debt pressure, asset sources, identity information, or any data not provided.

Please output exactly three sections in English:
1. Risk Conclusion
2. Lending Rationale
3. Privacy Note

Be concise and suitable for display in a dApp application card. Do not promise zero risk, do not guarantee returns, and do not fabricate data that was not provided.
`;

function buildUserPrompt(input: RiskExplanationRequest) {
  return `
Based on the following Zama contract output, generate a risk explanation for the lender:

Application ID: ${input.applicationId}
Risk Band: ${input.riskBand}
Encrypted Risk Score: ${input.riskScore}
Current Public Collateral Ratio: ${input.collateralRatio}%
Minimum Collateral Ratio: ${input.requiredCollateralRatio}%
Suggested APR: ${input.suggestedRate}
Loan Term: ${input.termLabel ?? "Not provided"}
Estimated Interest: ${input.estimatedInterest ?? "Not provided"} USDT
Estimated Repayment: ${input.estimatedRepayment ?? "Not provided"} USDT
Current Status: ${input.status}

Notes:
- This data represents the final output from the Zama FHE contract.
- The AI has no access to raw private data such as income, credit history, debt pressure, or asset sources.
- Only explain the results; do not speculate about the raw data.
`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<RiskExplanationResponse>) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST requests are supported" });
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured on the server" });
    return;
  }

  const input = req.body as RiskExplanationRequest;

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildUserPrompt(input) }
        ],
        temperature: 0.2,
        max_tokens: 420
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({ error: errorText || "DeepSeek request failed" });
      return;
    }

    const data = await response.json();
    const explanation = data?.choices?.[0]?.message?.content;

    if (!explanation) {
      res.status(502).json({ error: "DeepSeek did not return an explanation" });
      return;
    }

    res.status(200).json({ explanation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate explanation";
    res.status(500).json({ error: message });
  }
}
