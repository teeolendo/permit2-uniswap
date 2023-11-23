/* eslint-disable @typescript-eslint/consistent-type-imports */
declare global {
  interface Window {
    ethereum: import('ethers').providers.ExternalProvider
  }
}
