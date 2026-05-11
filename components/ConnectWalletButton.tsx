import { formatAddress, formatChain, useEthereumWallet } from "@/lib/ethereum";

export default function ConnectWalletButton() {
  const { address, chainId, connect, disconnect, error, isConnecting, isEvmWalletAvailable, walletName } = useEthereumWallet();

  return (
    <div className="flex items-center gap-3">
      {address ? (
        <span className="hidden rounded-md border border-line bg-panel px-3 py-2 text-xs text-slate-300 sm:inline">
          {walletName} / {formatAddress(address)} / {formatChain(chainId)}
        </span>
      ) : null}
      <button
        onClick={address ? disconnect : connect}
        disabled={isConnecting}
        className="rounded-md bg-aqua px-4 py-3 text-sm font-bold text-ink transition hover:bg-aqua/90 disabled:cursor-wait disabled:bg-slate-600"
      >
        {isConnecting ? "Connecting..." : address ? "Disconnect" : "Connect EVM Wallet"}
      </button>
      {!isEvmWalletAvailable || error ? (
        <span className="hidden max-w-56 text-xs text-amber md:inline">{error ?? "No Phantom EVM / MetaMask detected"}</span>
      ) : null}
    </div>
  );
}
