import type { AppProps } from "next/app";
import "@/styles/globals.css";
import { EthereumWalletProvider } from "@/lib/ethereum";
import { CreditVaultProvider } from "@/lib/creditVault";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <EthereumWalletProvider>
      <CreditVaultProvider>
        <Component {...pageProps} />
      </CreditVaultProvider>
    </EthereumWalletProvider>
  );
}
