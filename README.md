# Confidential Credit Vault

Confidential Credit Vault is a Zama FHEVM based privacy lending demo. It shows how an on-chain lending product can use encrypted borrower risk signals to price collateral and interest, while still keeping the borrower's raw financial profile private.

The demo contains both a Solidity smart contract and a Next.js frontend. It runs on Ethereum Sepolia and uses real wallet transactions for application submission, collateral locking, lender funding, and borrower repayment.

## What It Demonstrates

Public DeFi lending usually exposes too much user behavior. A lender needs risk information, but the borrower should not have to reveal raw income, credit, debt pressure, or asset-source signals to the whole market.

This project demonstrates a practical middle ground:

- Borrowers submit encrypted risk inputs through the Zama Relayer SDK.
- The smart contract computes the risk score, risk band, minimum collateral ratio, and suggested interest rate with FHE operations.
- Lenders see only the final risk result needed for a funding decision.
- DeepSeek explains the Zama contract result in plain language for the lender.
- The lender can fund the loan from a second wallet.
- The borrower receives SepoliaETH from the contract and later repays principal plus interest.
- The collateral locked by the borrower is released after repayment.

## Current Sepolia Contract

```text
ConfidentialCreditVault: 0x8eC4fAE45e3eDCD6aF3026022109E31ee6397C8f
Deployer / compliance officer: 0xD85a389004F5c59fd991C98376e27F9aD6f75996
Network: Ethereum Sepolia
```

The current contract version supports:

- payable borrower application submission with collateral deposit
- lender funding without a separate borrower-to-lender authorization step
- direct funding transfer from the contract to the borrower
- borrower repayment through `repayLoan`
- repayment transfer to the lender
- collateral release to the borrower after repayment

## User Flow

1. Borrower wallet opens `/borrow`.
2. Borrower enters loan amount and loan term.
3. The frontend builds a deterministic demo risk profile for the wallet.
4. The Zama Relayer SDK encrypts four private inputs:
   - income stability score
   - credit history score
   - debt pressure score
   - asset source score
5. Borrower submits the application on Sepolia and locks collateral in the contract.
6. Lender wallet opens `/lend`.
7. Lender reviews the public loan data and calls DeepSeek for a risk explanation.
8. Lender decides based on the AI explanation and funds the loan on-chain.
9. The contract forwards the funded SepoliaETH to the borrower wallet.
10. Borrower returns to `/borrow` and repays the exact on-chain repayment amount.
11. The contract sends principal plus interest to the lender and releases collateral to the borrower.

## Why Zama Is Used

The contract uses FHE so private borrower signals can be processed without revealing the raw values.

The main contract is:

```text
contracts/ConfidentialCreditVault.sol
```

Zama/FHEVM primitives used:

```solidity
externalEuint64
euint64
ebool
FHE.fromExternal
FHE.add
FHE.sub
FHE.mul
FHE.div
FHE.ge
FHE.select
FHE.allow
FHE.allowThis
```

Frontend encryption logic is in:

```text
lib/zamaContract.ts
```

The frontend creates encrypted inputs with:

```ts
const { createInstance, initSDK, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");
await initSDK();

const relayer = await createInstance({
  ...SepoliaConfig,
  network: ethereumProvider
});

const encryptedInput = relayer.createEncryptedInput(contractAddress, userAddress);
encryptedInput.add64(incomeScore);
encryptedInput.add64(creditScore);
encryptedInput.add64(debtPressure);
encryptedInput.add64(assetSource);

const encrypted = await encryptedInput.encrypt();
```

The encrypted handles and proof are then sent to:

```solidity
submitApplication(
  clearAmount,
  clearCollateral,
  encryptedIncomeScore,
  encryptedCreditScore,
  encryptedDebtPressure,
  encryptedAssetSourceScore,
  inputProof,
  clearTermDays,
  clearSuggestedRateBps
)
```

## Risk Model

The demo risk model is intentionally simple and readable for judging:

```text
riskScore =
creditHistoryScore * 40%
+ incomeStabilityScore * 30%
+ assetSourceScore * 20%
- debtPressureScore * 10%
```

The contract maps the encrypted risk score to final lending terms:

```text
Low risk:    minimum collateral ratio 120%, suggested APR 18%
Medium risk: minimum collateral ratio 150%, suggested APR 36%
High risk:   minimum collateral ratio 180%, suggested APR 72%
Reject:      not eligible for funding
```

Interest is calculated by term:

```text
estimatedInterest = loanAmount * APR * termDays / 365
repaymentDue = fundedAmount + on-chain interest
```

## DeepSeek Role

DeepSeek is not used to read or infer raw private borrower data.

It receives only the final result needed by the lender:

- risk band
- risk score
- public collateral ratio
- required collateral ratio
- suggested APR
- term
- estimated interest
- estimated repayment
- current status

Its role is to generate a lender-facing explanation. The lender makes the decision based on the Zama contract result plus the AI explanation.

## Pages

```text
/dashboard    overview
/borrow       borrower application and repayment
/lend         lender market and AI-assisted funding
/compliance   compliance explanation
```

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```env
SEPOLIA_RPC_URL=your_sepolia_rpc_url
PRIVATE_KEY=your_deployment_wallet_private_key
NEXT_PUBLIC_CONFIDENTIAL_CREDIT_VAULT=0x8eC4fAE45e3eDCD6aF3026022109E31ee6397C8f
DEEPSEEK_API_KEY=your_deepseek_api_key
```

Run the frontend:

```bash
npm run dev
```

Open:

```text
http://localhost:3000/dashboard
```

For the full DeepSeek API route, use the Next.js dev server. Static export is useful for local demo hosting, but normal Next.js server mode is the simplest way to run API routes.

## Compile And Deploy

Compile contracts:

```bash
npm run compile:contracts
```

Deploy to Sepolia:

```bash
npm run deploy:sepolia
```

After deployment, copy the printed contract address into `.env.local`:

```env
NEXT_PUBLIC_CONFIDENTIAL_CREDIT_VAULT=0x...
```

Then rebuild or restart the frontend.

## Demo Checklist

1. Open `/borrow` with wallet 1.
2. Switch wallet 1 to Sepolia.
3. Enter a loan amount and term.
4. Submit the encrypted application and confirm the wallet transaction.
5. Switch to wallet 2.
6. Open `/lend`.
7. Click `Call DeepSeek` to generate the lender explanation.
8. Click `Fund on-chain based on AI analysis`.
9. Confirm that wallet 2 pays SepoliaETH and wallet 1 receives the funding.
10. Switch back to wallet 1.
11. Open `/borrow`.
12. Click `Repay on-chain`.
13. Confirm that the lender receives repayment and the borrower receives collateral back.

## Privacy Boundary

Encrypted / protected:

- income stability score
- credit history score
- debt pressure score
- asset source score
- risk computation
- risk band computation
- required collateral ratio computation
- suggested rate computation

Public or lender-facing:

- loan amount
- public collateral ratio
- term
- estimated repayment
- final risk band
- suggested APR
- transaction hashes
- funding and repayment status

## Demo Assumptions

This is a hackathon/demo project, so it uses a few practical simplifications:

- SepoliaETH is used as the demo asset.
- USDT values in the UI are demo accounting units.
- A fixed demo conversion rate is used: `1 SepoliaETH = 3000 test USDT`.
- The risk profile is generated deterministically from the wallet and selected mode to simulate external credit data.
- The current version focuses on encrypted risk pricing, lender funding, repayment, and collateral release.
- A production version should add ERC20 stablecoin support, oracle pricing, liquidation logic, stronger event indexing, and formal compliance workflows.

## Tech Stack

- Next.js
- React
- TypeScript
- Solidity
- Hardhat
- Ethers v6
- Zama FHEVM Solidity
- Zama Relayer SDK
- DeepSeek API

## One-Sentence Summary

Confidential Credit Vault shows how Zama FHE can make privacy-preserving lending practical: borrowers keep sensitive risk inputs encrypted, the contract computes lending terms over ciphertext, DeepSeek explains only the final risk result, and lenders can fund and settle loans through real Sepolia transactions.
