import { ethers } from "ethers";
import type { UnsignedTx } from "./types.js";

/** Spending policy configuration */
export interface SpendingPolicy {
  /** Max native token (e.g. AVAX) per single transaction in human-readable units */
  maxPerTx?: string;
  /** Max native token spend per hour */
  maxPerHour?: string;
  /** Max native token spend per day (24h rolling) */
  maxPerDay?: string;
  /** Allowed contract addresses (if set, only these can be called) */
  allowedContracts?: string[];
  /** Blocked contract addresses (rejected even if in allowedContracts) */
  blockedContracts?: string[];
  /** Simulate (eth_call) before sending — catches reverts before spending gas */
  simulateBeforeSend?: boolean;
  /** Dry run mode — simulate everything, broadcast nothing */
  dryRun?: boolean;
}

interface SpendRecord {
  amount: bigint;
  timestamp: number;
}

export class PolicyEngine {
  private policy: SpendingPolicy;
  private spendLog: SpendRecord[] = [];

  constructor(policy: SpendingPolicy = {}) {
    this.policy = policy;
  }

  getPolicy(): SpendingPolicy { return { ...this.policy }; }

  setPolicy(policy: SpendingPolicy): void {
    this.policy = policy;
  }

  updatePolicy(updates: Partial<SpendingPolicy>): void {
    this.policy = { ...this.policy, ...updates };
  }

  /** Check a transaction against the policy. Throws if rejected. */
  check(tx: UnsignedTx): void {
    const value = tx.value ? BigInt(tx.value) : 0n;

    // Per-tx limit
    if (this.policy.maxPerTx) {
      const max = ethers.parseEther(this.policy.maxPerTx);
      if (value > max) {
        throw new PolicyError(
          `Transaction value ${ethers.formatEther(value)} exceeds per-tx limit of ${this.policy.maxPerTx}`,
          "MAX_PER_TX_EXCEEDED",
        );
      }
    }

    // Contract allowlist
    if (this.policy.allowedContracts && this.policy.allowedContracts.length > 0) {
      const to = tx.to.toLowerCase();
      const allowed = this.policy.allowedContracts.map(a => a.toLowerCase());
      if (!allowed.includes(to)) {
        throw new PolicyError(
          `Contract ${tx.to} not in allowlist`,
          "CONTRACT_NOT_ALLOWED",
        );
      }
    }

    // Contract blocklist
    if (this.policy.blockedContracts && this.policy.blockedContracts.length > 0) {
      const to = tx.to.toLowerCase();
      const blocked = this.policy.blockedContracts.map(b => b.toLowerCase());
      if (blocked.includes(to)) {
        throw new PolicyError(
          `Contract ${tx.to} is blocked`,
          "CONTRACT_BLOCKED",
        );
      }
    }

    // Hourly budget
    if (this.policy.maxPerHour) {
      const max = ethers.parseEther(this.policy.maxPerHour);
      const hourSpend = this.getSpendSince(Date.now() - 3_600_000);
      if (hourSpend + value > max) {
        throw new PolicyError(
          `Would exceed hourly budget of ${this.policy.maxPerHour} AVAX (spent ${ethers.formatEther(hourSpend)} this hour)`,
          "HOURLY_BUDGET_EXCEEDED",
        );
      }
    }

    // Daily budget
    if (this.policy.maxPerDay) {
      const max = ethers.parseEther(this.policy.maxPerDay);
      const daySpend = this.getSpendSince(Date.now() - 86_400_000);
      if (daySpend + value > max) {
        throw new PolicyError(
          `Would exceed daily budget of ${this.policy.maxPerDay} AVAX (spent ${ethers.formatEther(daySpend)} today)`,
          "DAILY_BUDGET_EXCEEDED",
        );
      }
    }
  }

  /** Record a spend after successful broadcast */
  recordSpend(value: bigint): void {
    this.spendLog.push({ amount: value, timestamp: Date.now() });
    // Prune records older than 24h
    const cutoff = Date.now() - 86_400_000;
    this.spendLog = this.spendLog.filter(r => r.timestamp > cutoff);
  }

  /** Get budget status */
  getBudgetStatus(): { spentLastHour: string; spentLast24h: string; remainingHour: string | null; remainingDay: string | null } {
    const hourSpend = this.getSpendSince(Date.now() - 3_600_000);
    const daySpend = this.getSpendSince(Date.now() - 86_400_000);
    return {
      spentLastHour: ethers.formatEther(hourSpend),
      spentLast24h: ethers.formatEther(daySpend),
      remainingHour: this.policy.maxPerHour
        ? ethers.formatEther(ethers.parseEther(this.policy.maxPerHour) - hourSpend)
        : null,
      remainingDay: this.policy.maxPerDay
        ? ethers.formatEther(ethers.parseEther(this.policy.maxPerDay) - daySpend)
        : null,
    };
  }

  get shouldSimulate(): boolean { return this.policy.simulateBeforeSend ?? false; }
  get isDryRun(): boolean { return this.policy.dryRun ?? false; }

  private getSpendSince(since: number): bigint {
    return this.spendLog
      .filter(r => r.timestamp > since)
      .reduce((sum, r) => sum + r.amount, 0n);
  }
}

export type PolicyErrorCode =
  | "MAX_PER_TX_EXCEEDED"
  | "HOURLY_BUDGET_EXCEEDED"
  | "DAILY_BUDGET_EXCEEDED"
  | "CONTRACT_NOT_ALLOWED"
  | "CONTRACT_BLOCKED"
  | "SIMULATION_FAILED";

export class PolicyError extends Error {
  constructor(message: string, public readonly code: PolicyErrorCode) {
    super(message);
    this.name = "PolicyError";
  }
}
