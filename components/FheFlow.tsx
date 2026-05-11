const steps = [
  {
    title: "1. Encrypt Borrower Risk Signals",
    body: "The borrower converts income stability, credit history, debt pressure, and asset source scores into externalEuint64 ciphertexts."
  },
  {
    title: "2. Submit Input Proof",
    body: "The frontend submits the ciphertext handles and Zama input proofs to the FHE contract via submitApplication."
  },
  {
    title: "3. Compute Risk on Ciphertexts",
    body: "The contract uses FHE.add, FHE.mul, FHE.div, FHE.ge, and FHE.select to compute risk level, minimum collateral ratio, and interest rate."
  },
  {
    title: "4. Reveal Only the Final Result",
    body: "Lenders see the risk level, collateral rules, and interest rate explanation, but not the borrower's original financial signals."
  }
];

export default function FheFlow() {
  return (
    <section className="rounded-md border border-line bg-panel p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">FHE Architecture</p>
      <h2 className="mt-2 text-xl font-semibold">How This dApp Uses Zama</h2>
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