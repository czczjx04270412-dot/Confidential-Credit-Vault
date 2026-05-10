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
你是一个 DeFi 隐私信贷风控解释助手，服务于基于 Zama FHE 的隐私借贷 dApp。

你的任务不是重新计算信用分，也不是读取借款人的原始资料。你的任务是解释智能合约已经输出的最终风控结果，帮助贷方理解这笔借款申请的风险。

你只能使用以下信息：风险等级、风险分、当前抵押率、最低抵押率、建议年化利率、借款期限、预计利息、到期应还金额、链上状态。

你不能读取、推测或编造借款人的原始收入、信用历史、负债压力、资产来源、身份信息或任何未提供的数据。

请用中文输出三段：
1. 风险结论
2. 放款依据
3. 隐私说明

表达要简洁，适合展示在 dApp 申请卡片中。不要承诺无风险，不要保证收益，不要编造未提供的数据。
`;

function buildUserPrompt(input: RiskExplanationRequest) {
  return `
请基于以下 Zama 合约输出，为贷方生成一段风险解释：

申请编号：${input.applicationId}
风险等级：${input.riskBand}
加密风险分：${input.riskScore}
当前公开抵押率：${input.collateralRatio}%
最低抵押率：${input.requiredCollateralRatio}%
建议年化利率：${input.suggestedRate}
借款期限：${input.termLabel ?? "未提供"}
预计利息：${input.estimatedInterest ?? "未提供"} USDT
预计到期应还：${input.estimatedRepayment ?? "未提供"} USDT
当前状态：${input.status}

注意：
- 这些数据是 Zama FHE 合约输出后的最终结果。
- AI 没有访问收入、信用历史、负债压力、资产来源等原始隐私数据。
- 请只解释结果，不要推测原始数据。
`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<RiskExplanationResponse>) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "只支持 POST 请求" });
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "服务端未配置 DEEPSEEK_API_KEY" });
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
      res.status(response.status).json({ error: errorText || "DeepSeek 请求失败" });
      return;
    }

    const data = await response.json();
    const explanation = data?.choices?.[0]?.message?.content;

    if (!explanation) {
      res.status(502).json({ error: "DeepSeek 没有返回解释内容" });
      return;
    }

    res.status(200).json({ explanation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成解释失败";
    res.status(500).json({ error: message });
  }
}
