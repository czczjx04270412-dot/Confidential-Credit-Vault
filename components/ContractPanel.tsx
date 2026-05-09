const contractHighlights = [
  "使用 externalEuint64 接收隐私风控输入",
  "使用 euint64 保存加密风险分、最低抵押率和建议利率",
  "使用 FHE.select 在密文条件下选择风险等级和抵押要求",
  "使用 FHE.allow / FHE.allowThis 控制借款人、贷方和合规方权限"
];

export default function ContractPanel() {
  return (
    <section className="rounded-md border border-line bg-panel p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">智能合约</p>
      <h2 className="mt-2 text-xl font-semibold">隐私抵押率优化合约</h2>
      <div className="mt-5 space-y-3">
        {contractHighlights.map((item) => (
          <div key={item} className="rounded-md bg-black/20 px-3 py-3 text-sm text-slate-300">
            {item}
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-md border border-line bg-ink p-4 font-mono text-xs leading-6 text-slate-300">
        风险分 = 信用*40% + 收入*30% + 资产来源*20% - 负债压力*10%
        <br />
        最低抵押率 = FHE.select(风险等级, 120%, 150%, 180%)
        <br />
        是否通过 = 风险分 &gt;= 50 且 当前抵押率 &gt;= 最低抵押率
      </div>
    </section>
  );
}
