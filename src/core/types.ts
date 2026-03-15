export interface UnsignedTx {
  to: string;
  data: string;
  value: string;
  chainId: number;
  gas?: string;
  gasLimit?: string;
  description?: string;
}
