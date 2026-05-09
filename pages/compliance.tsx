import Layout from "@/components/Layout";

const rules = [
  "借款人的财务评分以加密输入形式提交。",
  "合约在加密数值上计算风险等级、最低抵押率和建议利率。",
  "借款人可以查看自己的完整计算结果。",
  "贷方只看到抵押是否满足授权后的风险要求。",
  "合规方可以在授权情况下做个案审查，但原始数据不会公开。"
];

export default function CompliancePage() {
  return (
    <Layout>
      <section className="rounded-md border border-line bg-panel p-5 shadow-glow">
        <p className="text-xs uppercase tracking-wide text-slate-500">合规友好的隐私设计</p>
        <h1 className="mt-2 text-2xl font-semibold">选择性披露机制</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          产品围绕数据最小化设计：公众不能看到隐私风控信号，借款人、贷方和授权审查方只能看到各自角色所需的信息。
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
            <span>公众：只看元数据</span>
            <span>借款人：查看自己的完整结果</span>
            <span>贷方：查看抵押要求和利率</span>
            <span>合规方：授权后审查</span>
          </div>
        </div>
      </section>
    </Layout>
  );
}
