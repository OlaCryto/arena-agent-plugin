/** Unsigned transaction ready to be signed and broadcast */
export interface UnsignedTx {
  to: string;
  data: string;
  value: string;
  chainId: number;
  gas?: string;
  gasLimit?: string;
  description?: string;
}

/** Intent for calling a smart contract method */
export interface CallIntent {
  /** Contract address */
  contract: string;
  /** Human-readable ABI (e.g. ["function transfer(address,uint256) returns (bool)"]) */
  abi: string[];
  /** Method name to call */
  method: string;
  /** Method arguments */
  args?: any[];
  /** Native token value to send (human-readable, e.g. "0.1") */
  value?: string;
  /** Gas limit override */
  gasLimit?: string;
}

/** Result from execute() or call() */
export interface TransactionResult {
  hash: string;
  receipt: {
    status: number;
    blockNumber: number;
    gasUsed: string;
    transactionHash: string;
  };
}
