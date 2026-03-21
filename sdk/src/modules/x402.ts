import { ethers, JsonRpcProvider } from "ethers";
import type { UnsignedTx } from "../types.js";

const ARENAPAY_API = "https://arenapay.ai";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

const X402_ABI = [
  "function payNativeFor(bytes32 sessionId, address merchant) payable",
  "function payFor(bytes32 sessionId, address merchant, address token, uint256 amount)",
];

const ERC20_APPROVE_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
];

export interface X402PaymentInfo {
  session_id: string;
  contract: string;
  amount_wei: string;
  merchant_wallet: string;
  token_address: string;
  network: { chain_id: number; name: string };
  calls: {
    native: { fn: string; value: string; args: string[] };
    erc20_approve_then_pay: {
      approve: { spender: string; amount: string };
      payFor: { fn: string; args: string[] };
    };
  };
}

export class X402Module {
  constructor(private provider: JsonRpcProvider) {}

  /** Create a new x402 paywalled API endpoint */
  async createApi(opts: {
    name?: string;
    description?: string;
    apiUrl: string;
    merchantWallet: string;
    tokenAddress: string;
    amountWei: string;
    validForSec: number;
    chainId?: number;
    feeBpsSnapshot?: number;
    webhookUri?: string;
  }): Promise<{ apiId: string }> {
    const body: any = {
      p_name: opts.name,
      p_description: opts.description,
      p_api_url: opts.apiUrl,
      p_merchant_wallet: opts.merchantWallet,
      p_token_address: opts.tokenAddress,
      p_amount_wei: opts.amountWei,
      p_valid_for_sec: opts.validForSec,
      p_chain_id: opts.chainId ?? 43114,
    };
    if (opts.feeBpsSnapshot !== undefined) body.p_fee_bps_snapshot = opts.feeBpsSnapshot;
    if (opts.webhookUri) body.p_webhook_uri = opts.webhookUri;

    const res = await fetch(`${ARENAPAY_API}/api/402/apis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || `x402 create failed (${res.status})`);
    return data;
  }

  /** Access an x402 endpoint — returns 402 payment info or 200 content */
  async access(apiId: string, sessionId?: string): Promise<{ status: number; body: any }> {
    const headers: Record<string, string> = {};
    if (sessionId) headers["X-402-Session"] = sessionId;

    const res = await fetch(`${ARENAPAY_API}/api/${apiId}`, { headers });
    const body = await res.json();
    return { status: res.status, body };
  }

  /** Build on-chain payment tx for native AVAX x402 payment */
  buildPayNative(payment: X402PaymentInfo): { transactions: UnsignedTx[] } {
    const iface = new ethers.Interface(X402_ABI);
    const data = iface.encodeFunctionData("payNativeFor", [
      payment.session_id,
      payment.merchant_wallet,
    ]);
    return {
      transactions: [{
        to: payment.contract,
        data,
        value: payment.amount_wei,
        chainId: 43114,
      }],
    };
  }

  /** Build on-chain payment txs for ERC-20 x402 payment (approve + payFor) */
  buildPayErc20(payment: X402PaymentInfo): { transactions: UnsignedTx[] } {
    const approveIface = new ethers.Interface(ERC20_APPROVE_ABI);
    const approveData = approveIface.encodeFunctionData("approve", [
      payment.contract,
      payment.amount_wei,
    ]);

    const payIface = new ethers.Interface(X402_ABI);
    const payData = payIface.encodeFunctionData("payFor", [
      payment.session_id,
      payment.merchant_wallet,
      payment.token_address,
      payment.amount_wei,
    ]);

    return {
      transactions: [
        {
          to: payment.token_address,
          data: approveData,
          value: "0",
          chainId: 43114,
        },
        {
          to: payment.contract,
          data: payData,
          value: "0",
          chainId: 43114,
        },
      ],
    };
  }

  /** Full flow: access endpoint, pay on-chain, return payment txs to execute */
  buildPayment(paymentInfo: X402PaymentInfo): { transactions: UnsignedTx[] } {
    const isNative = paymentInfo.token_address === ZERO_ADDR;
    return isNative
      ? this.buildPayNative(paymentInfo)
      : this.buildPayErc20(paymentInfo);
  }
}
