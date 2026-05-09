import { BrowserProvider, Contract, Interface, TransactionReceipt, getAddress, isAddress, parseEther } from "ethers";
import { CreditApplicationInput } from "./creditVault";
import { EthereumProvider, getEvmProvider } from "./ethereum";

export const CONFIDENTIAL_CREDIT_VAULT_ADDRESS = process.env.NEXT_PUBLIC_CONFIDENTIAL_CREDIT_VAULT ?? "";

const VAULT_ABI = [
  "function submitApplication(uint64 clearAmount,uint64 clearCollateral,bytes32 encryptedIncomeScore,bytes32 encryptedCreditScore,bytes32 encryptedDebtPressure,bytes32 encryptedAssetSourceScore,bytes inputProof) external returns (uint256)",
  "function getPublicApplication(uint256 applicationId) external view returns (address borrower,uint64 clearAmount,uint64 clearCollateral,uint8 status,uint256 createdAt)",
  "function fundLoan(uint256 applicationId) external payable",
  "event ApplicationSubmitted(uint256 indexed applicationId,address indexed borrower,uint64 clearAmount,uint64 clearCollateral)"
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
    encrypted.inputProof
  );
  const receipt = await tx.wait();

  return {
    contractAddress: checkedContractAddress,
    transactionHash: tx.hash,
    applicationId: parseApplicationId(receipt) || "unknown"
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
  const vault = new Contract(getAddress(CONFIDENTIAL_CREDIT_VAULT_ADDRESS), VAULT_ABI, signer);
  const tx = await vault.fundLoan(BigInt(applicationId), {
    value: parseEther(fundingEth)
  });
  const receipt = await tx.wait();

  return {
    transactionHash: tx.hash,
    blockNumber: receipt?.blockNumber?.toString() ?? ""
  };
}
