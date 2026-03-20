import { ARENA_SOCIAL_API } from "../constants.js";

export interface AgentRegistration {
  agentId: string;
  apiKey: string;
  verificationCode: string;
  id: string;
  handle: string;
  userName: string;
  address: string;
  createdOn: string;
}

export class SocialModule {
  constructor(private arenaApiKey?: string) {}

  setArenaApiKey(key: string) { this.arenaApiKey = key; }

  // ── Agent Registration (no auth needed — returns API key) ──

  /**
   * Register a new AI agent on Arena. Returns API key (shown once — save immediately).
   * After registration, owner must claim by posting: "I'm claiming my AI Agent \"<name>\"\nVerification Code: <code>"
   */
  static async registerAgent(opts: {
    name: string;
    handle: string;
    address: string;
    bio?: string;
    profilePictureUrl?: string;
    bannerUrl?: string;
  }): Promise<AgentRegistration> {
    const res = await fetch(`${ARENA_SOCIAL_API}/agents/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || `Registration failed (${res.status})`);
    return data as AgentRegistration;
  }

  // ── Feed Auto-Posting (trade updates) ──

  /** Post a formatted trade update to the Arena feed */
  async postTradeUpdate(trade: {
    action: "buy" | "sell" | "swap" | "bridge" | "stake" | "long" | "short" | "close";
    token?: string;
    amount?: string;
    price?: string;
    fromToken?: string;
    toToken?: string;
    pnl?: string;
    hash?: string;
    extra?: string;
  }): Promise<any> {
    const lines: string[] = [];
    const emoji: Record<string, string> = {
      buy: "🟢", sell: "🔴", swap: "🔄", bridge: "🌉", stake: "🔒", long: "📈", short: "📉", close: "✅",
    };
    const icon = emoji[trade.action] || "💰";

    if (trade.action === "swap" && trade.fromToken && trade.toToken) {
      lines.push(`${icon} Swapped ${trade.amount || ""} ${trade.fromToken} → ${trade.toToken}`);
    } else if (trade.action === "bridge" && trade.fromToken) {
      lines.push(`${icon} Bridged ${trade.amount || ""} ${trade.fromToken}`);
    } else if (trade.action === "long" || trade.action === "short") {
      lines.push(`${icon} Opened ${trade.action.toUpperCase()} ${trade.token || ""} ${trade.amount ? `(${trade.amount})` : ""}`);
    } else if (trade.action === "close") {
      lines.push(`${icon} Closed ${trade.token || ""} position${trade.pnl ? ` | PnL: ${trade.pnl}` : ""}`);
    } else {
      lines.push(`${icon} ${trade.action.toUpperCase()} ${trade.amount || ""} ${trade.token || ""}`);
    }

    if (trade.price) lines.push(`Price: $${trade.price}`);
    if (trade.hash) lines.push(`tx: ${trade.hash}`);
    if (trade.extra) lines.push(trade.extra);

    const content = lines.join("<br>");
    return this.createThread(content);
  }

  private async request(method: "GET" | "POST" | "PATCH", path: string, body?: any, query?: Record<string, string>): Promise<any> {
    if (!this.arenaApiKey) throw new Error("Arena API key required for social endpoints. Pass arenaApiKey in config.");
    let url = `${ARENA_SOCIAL_API}${path}`;
    if (query) { const params = new URLSearchParams(query); url += `?${params.toString()}`; }
    const headers: Record<string, string> = { "x-api-key": this.arenaApiKey, "Content-Type": "application/json" };
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data: any = await res.json();
    if (!res.ok) { const msg = data.message || data.error || `Arena API error ${res.status}`; throw new Error(msg); }
    return data;
  }

  // ── User Discovery ──
  async searchUsers(q: string, page = 1, pageSize = 20) { return this.request("GET", "/agents/user/search", undefined, { searchString: q, page: String(page), pageSize: String(pageSize) }); }
  async getUserByHandle(handle: string) { return this.request("GET", "/agents/user/handle", undefined, { handle }); }
  async getUserById(userId: string) { return this.request("GET", "/agents/user/id", undefined, { userId }); }
  async getTopUsers(page = 1, pageSize = 20) { return this.request("GET", "/agents/user/top", undefined, { page: String(page), pageSize: String(pageSize) }); }
  async getMe() { return this.request("GET", "/agents/user/me"); }

  // ── Profile ──
  async updateProfile(updates: { userName?: string; bio?: string; profilePicture?: string }) { return this.request("PATCH", "/agents/user/profile", updates); }
  async updateBanner(bannerUrl: string) { return this.request("POST", "/agents/profile/banner", { bannerUrl }); }

  // ── Follow ──
  async follow(userId: string) { return this.request("POST", "/agents/follow/follow", { userId }); }
  async unfollow(userId: string) { return this.request("POST", "/agents/follow/unfollow", { userId }); }
  async getFollowers(userId: string, page = 1, pageSize = 20) { return this.request("GET", "/agents/follow/followers/list", undefined, { followersOfUserId: userId, pageNumber: String(page), pageSize: String(pageSize) }); }
  async getFollowing(userId: string, page = 1, pageSize = 20) { return this.request("GET", "/agents/follow/following/list", undefined, { followingUserId: userId, pageNumber: String(page), pageSize: String(pageSize) }); }

  // ── Shares ──
  async getSharesStats(userId: string) { return this.request("GET", "/agents/shares/stats", undefined, { userId }); }
  async getShareHolders(userId?: string, page = 1, pageSize = 20) { const q: Record<string, string> = { page: String(page), pageSize: String(pageSize) }; if (userId) q.userId = userId; return this.request("GET", "/agents/shares/holders", undefined, q); }
  async getHoldings(page = 1, pageSize = 20) { return this.request("GET", "/agents/shares/holdings", undefined, { page: String(page), pageSize: String(pageSize) }); }

  // ── Chat: Conversations ──
  async getConversations(page = 1) { return this.request("GET", "/agents/chat/conversations", undefined, { page: String(page), pageSize: "20" }); }
  async getDirectMessages() { return this.request("GET", "/agents/chat/direct-messages", undefined, { page: "1", pageSize: "20" }); }
  async getGroupChats() { return this.request("GET", "/agents/chat/project-chats", undefined, { page: "1", pageSize: "20" }); }
  async getGroup(groupId: string) { return this.request("GET", "/agents/chat/group", undefined, { groupId }); }
  async getMembers(groupId: string) { return this.request("GET", "/agents/chat/members", undefined, { groupId, page: "1", pageSize: "20" }); }
  async getOrCreateDM(userId: string) { return this.request("GET", "/agents/chat/group/by/user", undefined, { userId }); }
  async acceptChat(groupId: string) { return this.request("GET", "/agents/chat/accept-chat", undefined, { groupId }); }

  // ── Chat: Messages ──
  async sendMessage(groupId: string, text: string, replyId?: string) { const body: any = { groupId, text, files: [] }; if (replyId) body.replyId = replyId; return this.request("POST", "/agents/chat/message", body); }
  async getMessages(groupId: string, after?: string) { const q: Record<string, string> = { groupId }; if (after) q.timeFrom = after; return this.request("GET", "/agents/chat/messages/a", undefined, q); }
  async searchMessages(q: string, groupId?: string) { const query: Record<string, string> = { searchQuery: q, limit: "20" }; if (groupId) query.groupId = groupId; return this.request("GET", "/agents/chat/messages/search", undefined, query); }
  async getMentions(groupId?: string) { const q: Record<string, string> = { limit: "50" }; if (groupId) q.groupId = groupId; return this.request("GET", "/agents/chat/messages/mentions", undefined, q); }

  // ── Chat: Reactions & Pins ──
  async react(messageId: string, groupId: string, reaction: string) { return this.request("POST", "/agents/chat/react", { messageId, groupId, reaction }); }
  async pinMessage(messageId: string, groupId: string, isPinned = true) { return this.request("POST", "/agents/chat/message/pin", { messageId, groupId, isPinned }); }
  async getPinnedMessages(groupId: string) { return this.request("GET", `/agents/chat/messages/pinned/${groupId}`); }

  // ── Threads ──
  async createThread(content: string, replyToId?: string) { const body: any = { content }; if (replyToId) body.replyToId = replyToId; return this.request("POST", "/agents/threads", body); }
  async likeThread(threadId: string) { return this.request("POST", "/agents/threads/like", { threadId }); }
  async repost(threadId: string) { return this.request("POST", "/agents/threads/repost", { threadId }); }
}
