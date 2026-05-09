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
你是一个 DeFi 隐私风控解释助手。
你不能读取借款人的原始隐私数据，例如收入、信用历史、负债压力、资产来源等字段。
你只能基于 Zama FHE 合约已经授权披露的最终结果进行解释。

你的任务不是决定是否放款，也不是替代智能合约或贷方判断。
你的任务是把合约输出的风险等级、风险分、最低抵押率、当前抵押率、建议利率、预计利息和状态，解释成贷方能快速理解的风险摘要。

输出要求：
1. 使用中文。
2. 简洁，适合放在申请卡片里。
3. 明确说明 AI 没有读取原始隐私数据。
4. 不要编造借款人的收入、信用历史、资产来源等原始信息。
5. 不要承诺无风险。
`;

function buildUserPrompt(input: RiskExplanationRequest) {
  return `
请基于以下 Zama 合约授权输出，生成一段贷方风险解释：

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
- 这些数据是 Zama FHE 合约授权披露后的最终结果。
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
