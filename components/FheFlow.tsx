const steps = [
  {
    title: "1. 加密借款人风控信号",
    body: "借款人把收入稳定性、信用历史、负债压力和资产来源评分转换成 externalEuint64 密文。"
  },
  {
    title: "2. 提交输入证明",
    body: "前端把密文句柄和 Zama 输入证明提交给 FHE 合约的 submitApplication 方法。"
  },
  {
    title: "3. 在密文上计算风险",
    body: "合约使用 FHE.add、FHE.mul、FHE.div、FHE.ge 和 FHE.select 计算风险等级、最低抵押率和利率。"
  },
  {
    title: "4. 按权限展示结果",
    body: "贷方只能看到抵押规则和授权结果，不能看到借款人的原始财务信号。"
  }
];

export default function FheFlow() {
  return (
    <section className="rounded-md border border-line bg-panel p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">FHE 架构</p>
      <h2 className="mt-2 text-xl font-semibold">这个 dApp 如何使用 Zama</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {steps.map((step) => (
          <div key={step.title} className="rounded-md bg-black/20 p-4">
            <p className="text-sm font-semibold text-aqua">{step.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
