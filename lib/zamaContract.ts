import { BrowserProvider, Contract, Interface, TransactionReceipt, ZeroAddress, getAddress, isAddress, parseEther } from "ethers";
import { CreditApplicationInput } from "./creditVault";
import { EthereumProvider, getEvmProvider } from "./ethereum";

export const CONFIDENTIAL_CREDIT_VAULT_ADDRESS = process.env.NEXT_PUBLIC_CONFIDENTIAL_CREDIT_VAULT ?? "";

const VAULT_ABI = [
  "function submitApplication(uint64 clearAmount,uint64 clearCollateral,bytes32 encryptedIncomeScore,bytes32 encryptedCreditScore,bytes32 encryptedDebtPressure,bytes32 encryptedAssetSourceScore,bytes inputProof,uint64 clearTermDays,uint64 clearSuggestedRateBps) external payable returns (uint256)",
  "function getPublicApplication(uint256 applicationId) external view returns (address borrower,uint64 clearAmount,uint64 clearCollateral,uint8 status,uint256 createdAt)",
  "function getLoanTerms(uint256 applicationId) external view returns (address lender,uint256 collateralAmount,uint256 fundedAmount,uint256 repaymentDue,uint256 dueAt)",
  "function fundLoan(uint256 applicationId) external payable",
  "function repayLoan(uint256 applicationId) external payable",
  "event ApplicationSubmitted(uint256 indexed applicationId,address indexed borrower,uint64 clearAmount,uint64 clearCollateral)",
] as const;

const vaultInterface = new Interface(VAULT_ABI);

export type ChainSubmissionResult = {
  contractAddress: string;
  transactionHash: string;
  applicationId: string;
};

function ensureWallet() {
  const provider = getEvmProvider();
  if (!provider) {
    throw new Error("未检测到 Phantom EVM 或 MetaMask，无法提交链上交易。");
  }
  return provider as EthereumProvider;
}

function parseApplicationId(receipt: TransactionReceipt) {
  for (const log of receipt.logs) {
    try {
      const parsed = vaultInterface.parseLog(log);
      if (parsed?.name === "ApplicationSubmitted") {
        return parsed.args.applicationId.toString();
      }
    } catch {
      // Ignore logs from other contracts.
    }
  }
  return "";
}

export function hasConfiguredVault() {
  return Boolean(CONFIDENTIAL_CREDIT_VAULT_ADDRESS);
}

export async function submitEncryptedApplicationToZama(
  input: CreditApplicationInput,
  userAddress: string
): Promise<ChainSubmissionResult> {
  if (!CONFIDENTIAL_CREDIT_VAULT_ADDRESS) {
    throw new Error("未配置 NEXT_PUBLIC_CONFIDENTIAL_CREDIT_VAULT，当前只能使用本地演示模式。");
  }

  const ethereum = ensureWallet();
  if (!isAddress(userAddress)) {
    throw new Error(`当前钱包返回的不是 EVM 地址：${userAddress || "空地址"}。请确认 Phantom 切到 Ethereum/Sepolia 账户。`);
  }
  const checkedUserAddress = getAddress(userAddress);
  const checkedContractAddress = getAddress(CONFIDENTIAL_CREDIT_VAULT_ADDRESS);
  const { createInstance, initSDK, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");
  await initSDK();
  const relayer = await createInstance({
    ...SepoliaConfig,
    network: ethereum
  });

  const encryptedInput = relayer.createEncryptedInput(checkedContractAddress, checkedUserAddress);
  encryptedInput.add64(BigInt(input.incomeScore));
  encryptedInput.add64(BigInt(input.creditScore));
  encryptedInput.add64(BigInt(input.debtPressure));
  encryptedInput.add64(BigInt(input.assetSource));
  const encrypted = await encryptedInput.encrypt();

  const provider = new BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const vault = new Contract(checkedContractAddress, VAULT_ABI, signer);
  const tx = await vault.submitApplication(
    BigInt(Math.round(input.amount)),
    BigInt(Math.round(input.collateral)),
    encrypted.handles[0],
    encrypted.handles[1],
    encrypted.handles[2],
    encrypted.handles[3],
    encrypted.inputProof,
    BigInt(input.termDays ?? 0),
    BigInt(Math.round((input.annualInterestRate ?? 0) * 100)),
    {
      value: parseEther(input.collateralEth ?? "0")
    }
  );
  const receipt = await tx.wait();

  return {
    contractAddress: checkedContractAddress,
    transactionHash: tx.hash,
    applicationId: parseApplicationId(receipt) || "unknown"
  };
}

export async function repayLoanOnZama(applicationId: string) {
  if (!CONFIDENTIAL_CREDIT_VAULT_ADDRESS) {
    throw new Error("未配置 NEXT_PUBLIC_CONFIDENTIAL_CREDIT_VAULT，无法发起链上还款。");
  }
  if (!applicationId || applicationId === "unknown") {
    throw new Error("该申请没有链上 applicationId，不能执行真实链上还款。");
  }

  const ethereum = ensureWallet();
  const provider = new BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const vault = new Contract(getAddress(CONFIDENTIAL_CREDIT_VAULT_ADDRESS), VAULT_ABI, signer);
  const [, , , repaymentDue] = await vault.getLoanTerms(BigInt(applicationId));
  if (repaymentDue <= BigInt(0)) {
    throw new Error("链上没有可还款金额，请确认这笔申请已经完成放款。");
  }
  const tx = await vault.repayLoan(BigInt(applicationId), {
    value: repaymentDue
  });
  const receipt = await tx.wait();

  return {
    transactionHash: tx.hash,
    blockNumber: receipt?.blockNumber?.toString() ?? ""
  };
}

export async function fundLoanOnZama(applicationId: string, fundingEth: string) {
  if (!CONFIDENTIAL_CREDIT_VAULT_ADDRESS) {
    throw new Error("未配置 NEXT_PUBLIC_CONFIDENTIAL_CREDIT_VAULT，无法发起链上放款。");
  }
  if (!applicationId || applicationId === "unknown") {
    throw new Error("该申请没有链上 applicationId，不能执行真实链上放款。");
  }

  const ethereum = ensureWallet();
  const provider = new BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const lenderAddress = getAddress(await signer.getAddress());
  const vault = new Contract(getAddress(CONFIDENTIAL_CREDIT_VAULT_ADDRESS), VAULT_ABI, signer);

  let publicApplication: {
    borrower: string;
    status: bigint | number;
  };

  try {
    const [borrower, , , status] = await vault.getPublicApplication(BigInt(applicationId));
    publicApplication = { borrower: getAddress(borrower), status };
  } catch {
    throw new Error(`链上读取申请 #${applicationId} 失败，请确认合约地址和 applicationId 是否正确。`);
  }

  if (publicApplication.borrower === ZeroAddress) {
    throw new Error(`链上不存在申请 #${applicationId}，请先用借款页重新提交链上申请。`);
  }
  if (publicApplication.borrower.toLowerCase() === lenderAddress.toLowerCase()) {
    throw new Error("当前钱包是该申请的借款人，不能给自己的申请放款。请切换另一个 EVM 钱包作为贷方。");
  }
  if (Number(publicApplication.status) !== 1) {
    const statusLabel = Number(publicApplication.status) === 2 ? "已放款" : Number(publicApplication.status) === 3 ? "已还款" : "不可放款";
    throw new Error(`链上申请 #${applicationId} 当前状态是“${statusLabel}”，不能再次放款。`);
  }

  let tx;
  try {
    tx = await vault.fundLoan(BigInt(applicationId), {
      value: parseEther(fundingEth)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("missing revert data") || message.includes("CALL_EXCEPTION")) {
      throw new Error("链上放款预估 Gas 失败。请确认当前钱包有足够 SepoliaETH，并且合约地址是最新部署版本。");
    }
    throw err;
  }
  const receipt = await tx.wait();

  return {
    transactionHash: tx.hash,
    blockNumber: receipt?.blockNumber?.toString() ?? ""
  };
}
