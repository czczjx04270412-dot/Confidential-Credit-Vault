import Layout from "@/components/Layout";

const rules = [
  "借款人的财务评分以加密输入形式提交。",
  "合约在加密数值上计算风险等级、最低抵押率和建议利率。",
  "贷方根据最终风险结果和 DeepSeek 解释进行判断，不读取原始隐私数据。",
  "借款人提交抵押金，贷方放款后资金通过合约进入借款人钱包。",
  "借款人链上还款后，本息转给贷方，抵押金释放给借款人。"
];

export default function CompliancePage() {
  return (
    <Layout>
      <section className="rounded-md border border-line bg-panel p-5 shadow-glow">
        <p className="text-xs uppercase tracking-wide text-slate-500">Privacy And Compliance</p>
        <h1 className="mt-2 text-2xl font-semibold">数据最小化的隐私金融设计</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          产品围绕数据最小化设计：公众不能看到借款人的原始风控信号，贷方只看到放款决策所需的最终风险结果、抵押率、利率和还款信息。
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {rules.map((rule) => (
            <div key={rule} className="rounded-md border border-line bg-black/20 px-4 py-4 text-sm text-slate-300">
              {rule}
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-md border border-line bg-ink p-4">
          <p className="text-sm font-semibold text-slate-200">角色权限</p>
          <div className="mt-3 grid gap-3 text-sm text-slate-400 md:grid-cols-4">
            <span>公众：只能看到公开元数据</span>
            <span>借款人：提交加密资料并还款</span>
            <span>贷方：查看风险结果并放款</span>
            <span>合约：锁定抵押、转账、结算</span>
          </div>
        </div>
      </section>
    </Layout>
  );
}
