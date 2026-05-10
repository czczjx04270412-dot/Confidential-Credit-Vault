# Confidential Credit Vault - 2 Minute Demo Script

## 0:00 - 0:15 Introduction

Hello, this project is Confidential Credit Vault, a privacy lending demo built with Zama FHEVM.

The problem is simple: on-chain lending needs risk assessment, but a borrower should not have to publicly reveal income quality, credit history, debt pressure, or asset-source signals.

## 0:15 - 0:35 Core Idea

This project uses Zama FHE to compute credit risk over encrypted borrower data.

The borrower still locks collateral, but the required collateral ratio and suggested interest rate are not fixed. They are calculated from encrypted risk inputs inside the smart contract.

## 0:35 - 0:55 Borrower Flow

On the borrow page, wallet 1 connects to Sepolia, enters a loan amount and a term, and submits an application.

The frontend uses the Zama Relayer SDK to encrypt four private inputs: income stability, credit history, debt pressure, and asset source. The borrower confirms a wallet transaction, and the application is written to the Zama FHEVM contract with collateral locked.

## 0:55 - 1:20 Zama Implementation

The Solidity contract receives `externalEuint64` encrypted inputs and uses FHE operations such as `FHE.add`, `FHE.sub`, `FHE.mul`, `FHE.div`, `FHE.ge`, and `FHE.select`.

The contract computes a risk score, risk band, minimum collateral ratio, suggested APR, and approval result. Raw risk inputs are not publicly exposed.

## 1:20 - 1:40 Lender And AI Analysis

On the lender page, wallet 2 reviews the loan request. The lender sees only the final risk result, collateral ratio, target return, and repayment amount.

DeepSeek is used as an explanation layer. It does not receive the raw private inputs. It only explains the Zama contract result so the lender can make a clearer funding decision.

## 1:40 - 1:55 Real Funding And Repayment

If the lender accepts the risk, wallet 2 calls `fundLoan` and sends SepoliaETH through the contract to wallet 1.

After funding, wallet 1 can repay on-chain. The contract sends principal plus interest to the lender and releases the locked collateral back to the borrower.

## 1:55 - 2:00 Closing

Confidential Credit Vault demonstrates real value for privacy finance: encrypted risk calculation, AI-assisted lender explanation, real wallet funding, repayment, and collateral release, all without exposing the borrower's raw financial profile.
