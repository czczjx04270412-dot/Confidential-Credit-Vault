const contractHighlights = [
  "Uses externalEuint64 to receive encrypted risk inputs",
  "Uses euint64 to store encrypted risk scores, min collateral ratios, and suggested rates",
  "Uses FHE.select to choose risk levels and collateral requirements under ciphertext conditions",
  "Uses FHE.allow / FHE.allowThis to control which contracts and accounts can access encrypted results"
];

export default function ContractPanel() {
  return (
    <section className="rounded-md border border-line bg-panel p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">Smart Contract</p>
      <h2 className="mt-2 text-xl font-semibold">Confidential Credit Vault Contract</h2>
      <div className="mt-5 space-y-3">
        {contractHighlights.map((item) => (
          <div key={item} className="rounded-md bg-black/20 px-3 py-3 text-sm text-slate-300">
            {item}
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-md border border-line bg-ink p-4 font-mono text-xs leading-6 text-slate-300">
        Risk Score = Credit*40% + Income*30% + Asset Source*20% - Debt Pressure*10%
        <br />
        Min Collateral Ratio = FHE.select(risk level, 120%, 150%, 180%)
        <br />
        Approved = Risk Score {'>='} 50 AND Current Collateral Ratio {'>='} Min Collateral Ratio
      </div>
    </section>
  );
}