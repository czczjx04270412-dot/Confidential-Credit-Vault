import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isPhantom?: boolean;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    phantom?: {
      ethereum?: EthereumProvider;
    };
  }
}

type WalletState = {
  address: string | null;
  chainId: string | null;
  ethBalance: number | null;
  walletName: string;
  isEvmWalletAvailable: boolean;
  isConnecting: boolean;
  isBalanceLoading: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  switchToSepolia: () => Promise<void>;
};

const WalletContext = createContext<WalletState | null>(null);
const SEPOLIA_CHAIN_ID = "0xaa36a7";

export function getEvmProvider() {
  if (typeof window === "undefined") return undefined;
  return window.phantom?.ethereum ?? window.ethereum;
}

function detectWalletName(provider?: EthereumProvider) {
  if (provider?.isPhantom) return "Phantom EVM";
  if (provider?.isMetaMask) return "MetaMask";
  if (provider) return "EVM 钱包";
  return "未连接";
}

function shortAddress(address: string | null) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function weiHexToEth(balanceHex: string) {
  const wei = BigInt(balanceHex);
  const base = BigInt("1000000000000000000");
  const whole = wei / base;
  const fraction = wei % base;
  return Number(`${whole}.${fraction.toString().padStart(18, "0").slice(0, 6)}`);
}

export function formatAddress(address: string | null) {
  return shortAddress(address);
}

export function formatChain(chainId: string | null) {
  if (!chainId) return "未连接";
  if (chainId.toLowerCase() === SEPOLIA_CHAIN_ID) return "Sepolia 测试网";
  if (chainId.toLowerCase() === "0x1") return "以太坊主网";
  return chainId;
}

export function isSepolia(chainId: string | null) {
  return chainId?.toLowerCase() === SEPOLIA_CHAIN_ID;
}

export function EthereumWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [ethBalance, setEthBalance] = useState<number | null>(null);
  const [walletName, setWalletName] = useState("未连接");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEvmWalletAvailable, setIsEvmWalletAvailable] = useState(false);

  const refreshBalance = useCallback(async () => {
    const provider = getEvmProvider();
    if (!provider || !address) {
      setEthBalance(null);
      return;
    }

    setIsBalanceLoading(true);
    try {
      const currentChainId = (await provider.request({ method: "eth_chainId" })) as string;
      setChainId(currentChainId);
      const balanceHex = (await provider.request({
        method: "eth_getBalance",
        params: [address, "latest"]
      })) as string;
      setEthBalance(weiHexToEth(balanceHex));
    } catch (err) {
      const message = err instanceof Error ? err.message : "读取 Sepolia ETH 余额失败。";
      setError(message);
    } finally {
      setIsBalanceLoading(false);
    }
  }, [address]);

  useEffect(() => {
    const provider = getEvmProvider();
    setIsEvmWalletAvailable(Boolean(provider));
    setWalletName(detectWalletName(provider));
  }, []);

  useEffect(() => {
    const provider = getEvmProvider();
    if (!provider) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAddress(accounts?.[0] ?? null);
      setEthBalance(null);
    };
    const handleChainChanged = (...args: unknown[]) => {
      setChainId(String(args[0] ?? ""));
      setEthBalance(null);
    };

    provider.on?.("accountsChanged", handleAccountsChanged);
    provider.on?.("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  const connect = useCallback(async () => {
    setError(null);
    const provider = getEvmProvider();

    if (!provider) {
      setError("未检测到 EVM 钱包。请安装 Phantom EVM 或 MetaMask 后刷新页面。");
      return;
    }

    setWalletName(detectWalletName(provider));
    setIsConnecting(true);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const currentChainId = (await provider.request({ method: "eth_chainId" })) as string;
      setAddress(accounts[0] ?? null);
      setChainId(currentChainId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "钱包连接被拒绝。";
      setError(message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setEthBalance(null);
    setError(null);
  }, []);

  const switchToSepolia = useCallback(async () => {
    setError(null);
    const provider = getEvmProvider();

    if (!provider) {
      setError("未检测到 EVM 钱包。请安装 Phantom EVM 或 MetaMask 后刷新页面。");
      return;
    }

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }]
      });
      const currentChainId = (await provider.request({ method: "eth_chainId" })) as string;
      setChainId(currentChainId);
      setEthBalance(null);
    } catch (err) {
      const errorWithCode = err as { code?: number };

      if (errorWithCode.code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: SEPOLIA_CHAIN_ID,
              chainName: "Sepolia 测试网",
              nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://eth-sepolia.g.alchemy.com/v2/wE5PEtS-pj9TQ6Shq5Xo2"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"]
            }
          ]
        });
        return;
      }

      const message = err instanceof Error ? err.message : "切换 Sepolia 测试网失败。";
      setError(message);
    }
  }, []);

  const value = useMemo(
    () => ({
      address,
      chainId,
      ethBalance,
      walletName,
      isEvmWalletAvailable,
      isConnecting,
      isBalanceLoading,
      error,
      connect,
      disconnect,
      refreshBalance,
      switchToSepolia
    }),
    [
      address,
      chainId,
      connect,
      disconnect,
      error,
      ethBalance,
      isBalanceLoading,
      isConnecting,
      isEvmWalletAvailable,
      refreshBalance,
      switchToSepolia,
      walletName
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useEthereumWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useEthereumWallet must be used within EthereumWalletProvider");
  return context;
}
