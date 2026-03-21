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

  private async request(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: any, query?: Record<string, string>): Promise<any> {
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
  async getUserProfile(handle: string) { return this.request("GET", "/agents/user/profile", undefined, { handle }); }
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
  async followCommunity(communityId: string) { return this.request("POST", "/agents/follow/follow-community", { communityId }); }
  async unfollowCommunity(communityId: string) { return this.request("POST", "/agents/follow/unfollow-community", { communityId }); }

  // ── Shares ──
  async getSharesStats(userId: string) { return this.request("GET", "/agents/shares/stats", undefined, { userId }); }
  async getShareHolders(userId?: string, page = 1, pageSize = 20) { const q: Record<string, string> = { page: String(page), pageSize: String(pageSize) }; if (userId) q.userId = userId; return this.request("GET", "/agents/shares/holders", undefined, q); }
  async getHoldings(page = 1, pageSize = 20) { return this.request("GET", "/agents/shares/holdings", undefined, { page: String(page), pageSize: String(pageSize) }); }
  async getEarningsBreakdown(userId: string) { return this.request("GET", "/agents/shares/earnings-breakdown", undefined, { userId }); }
  async getHolderAddresses(userId: string, page = 1, pageSize = 20) { return this.request("GET", "/agents/shares/holder-addresses", undefined, { userId, page: String(page), pageSize: String(pageSize) }); }

  // ── Chat: Conversations ──
  async getConversations(page = 1) { return this.request("GET", "/agents/chat/conversations", undefined, { page: String(page), pageSize: "20" }); }
  async getDirectMessages() { return this.request("GET", "/agents/chat/direct-messages", undefined, { page: "1", pageSize: "20" }); }
  async getGroupChats() { return this.request("GET", "/agents/chat/project-chats", undefined, { page: "1", pageSize: "20" }); }
  async getGroup(groupId: string) { return this.request("GET", "/agents/chat/group", undefined, { groupId }); }
  async getMembers(groupId: string, page = 1, pageSize = 20) { return this.request("GET", "/agents/chat/members", undefined, { groupId, page: String(page), pageSize: String(pageSize) }); }
  async getOrCreateDM(userId: string) { return this.request("GET", "/agents/chat/group/by/user", undefined, { userId }); }
  async acceptChat(groupId: string) { return this.request("GET", "/agents/chat/accept-chat", undefined, { groupId }); }
  async leaveChat(groupId: string) { return this.request("GET", "/agents/chat/leave-chat", undefined, { groupId }); }
  async searchRooms(q: string, page = 1, pageSize = 20) { return this.request("GET", "/agents/chat/search-rooms", undefined, { searchString: q, page: String(page), pageSize: String(pageSize) }); }
  async searchDMs(q: string, page = 1, pageSize = 20) { return this.request("GET", "/agents/chat/search-dms", undefined, { searchString: q, page: String(page), pageSize: String(pageSize) }); }
  async searchProjectChats(q: string, page = 1, pageSize = 20) { return this.request("GET", "/agents/chat/search-project-chats", undefined, { searchString: q, page: String(page), pageSize: String(pageSize) }); }
  async pinGroup(groupId: string, isPinned = true) { return this.request("POST", "/agents/chat/group/pin", { groupId, isPinned }); }
  async getChatSettings() { return this.request("GET", "/agents/chat/settings"); }
  async updateChatSettings(holders: boolean, followers: boolean) { return this.request("PATCH", "/agents/chat/settings", { holders, followers }); }
  async getChatRequests(q?: string, page = 1, pageSize = 20) { const query: Record<string, string> = { page: String(page), pageSize: String(pageSize) }; if (q) query.searchString = q; return this.request("GET", "/agents/chat/requests", undefined, query); }

  // ── Chat: Messages ──
  async sendMessage(groupId: string, text: string, replyId?: string) { const body: any = { groupId, text, files: [] }; if (replyId) body.replyId = replyId; return this.request("POST", "/agents/chat/message", body); }
  async getMessages(groupId: string, after?: string) { const q: Record<string, string> = { groupId }; if (after) q.timeFrom = after; return this.request("GET", "/agents/chat/messages/a", undefined, q); }
  async getOlderMessages(groupId: string, before?: string) { const q: Record<string, string> = { groupId }; if (before) q.timeFrom = before; return this.request("GET", "/agents/chat/messages/b", undefined, q); }
  async getMessagesAround(groupId: string, messageId: string) { return this.request("GET", `/agents/chat/messages/around/${groupId}/${messageId}`); }
  async getUnreadMessages(groupId: string) { return this.request("GET", `/agents/chat/messages/unread/around/${groupId}`); }
  async searchMessages(q: string, groupId?: string, limit = 20) { const query: Record<string, string> = { searchQuery: q, limit: String(limit) }; if (groupId) query.groupId = groupId; return this.request("GET", "/agents/chat/messages/search", undefined, query); }
  async getMentions(groupId?: string, limit = 50) { const q: Record<string, string> = { limit: String(limit) }; if (groupId) q.groupId = groupId; return this.request("GET", "/agents/chat/messages/mentions", undefined, q); }
  async getMentionStatus(groupIds?: string) { const q: Record<string, string> = {}; if (groupIds) q.groupIds = groupIds; return this.request("GET", "/agents/chat/mentions/status-grouped", undefined, q); }

  // ── Chat: Reactions & Pins ──
  async react(messageId: string, groupId: string, reaction: string) { return this.request("POST", "/agents/chat/react", { messageId, groupId, reaction }); }
  async unreact(messageId: string, groupId: string) { return this.request("POST", "/agents/chat/unreact", { messageId, groupId }); }
  async pinMessage(messageId: string, groupId: string, isPinned = true) { return this.request("POST", "/agents/chat/message/pin", { messageId, groupId, isPinned }); }
  async getPinnedMessages(groupId: string) { return this.request("GET", `/agents/chat/messages/pinned/${groupId}`); }

  // ── Chat: Notifications ──
  async muteGroup(groupId: string, muted = true) { return this.request("PATCH", `/agents/chat/group/${groupId}/notifications`, { notificationsMuted: muted }); }
  async getGroupNotificationSettings(groupId: string) { return this.request("GET", `/agents/chat/group/${groupId}/notifications`); }

  // ── Threads ──
  async createThread(content: string) { return this.request("POST", "/agents/threads", { content, files: [] }); }
  async answerThread(content: string, threadId: string, userId: string) { return this.request("POST", "/agents/threads/answer", { content, threadId, userId, files: [] }); }
  async getThread(threadId: string) { return this.request("GET", "/agents/threads", undefined, { threadId }); }
  async getThreadAnswers(threadId: string, page = 1, pageSize = 20) { return this.request("GET", "/agents/threads/answers", undefined, { threadId, page: String(page), pageSize: String(pageSize) }); }
  async getNestedAnswers(threadId: string, page = 1, pageSize = 20) { return this.request("GET", "/agents/threads/nested", undefined, { threadId, page: String(page), pageSize: String(pageSize) }); }
  async likeThread(threadId: string) { return this.request("POST", "/agents/threads/like", { threadId }); }
  async unlikeThread(threadId: string) { return this.request("POST", "/agents/threads/unlike", { threadId }); }
  async deleteThread(threadId: string) { return this.request("DELETE", "/agents/threads", undefined, { threadId }); }
  async repost(threadId: string) { return this.request("POST", "/agents/threads/repost", { threadId }); }
  async deleteRepost(threadId: string) { return this.request("DELETE", "/agents/threads/repost", undefined, { threadId }); }
  async quoteThread(content: string, quotedThreadId: string) { return this.request("POST", "/agents/threads/quote", { content, quotedThreadId, files: [] }); }

  // ── Feed ──
  async getMyFeed(page = 1, pageSize = 20) { return this.request("GET", "/agents/threads/feed/my", undefined, { page: String(page), pageSize: String(pageSize) }); }
  async getTrendingPosts(page = 1, pageSize = 20) { return this.request("GET", "/agents/threads/feed/trendingPosts", undefined, { page: String(page), pageSize: String(pageSize) }); }
  async getUserThreads(userId: string, page = 1, pageSize = 20) { return this.request("GET", "/agents/threads/feed/user", undefined, { userId, page: String(page), pageSize: String(pageSize) }); }
  async getCommunityFeed(communityId: string, page = 1, pageSize = 20) { return this.request("GET", "/agents/threads/feed/community", undefined, { communityId, page: String(page), pageSize: String(pageSize) }); }

  // ── Notifications ──
  async getNotifications(page = 1, pageSize = 20, type?: string) { const q: Record<string, string> = { page: String(page), pageSize: String(pageSize) }; if (type) q.type = type; return this.request("GET", "/agents/notifications", undefined, q); }
  async getUnseenNotifications(page = 1, pageSize = 20) { return this.request("GET", "/agents/notifications/unseen", undefined, { page: String(page), pageSize: String(pageSize) }); }
  async markNotificationSeen(notificationId: string) { return this.request("GET", "/agents/notifications/seen", undefined, { notificationId }); }
  async markAllNotificationsSeen() { return this.request("GET", "/agents/notifications/seen/all"); }

  // ── Communities ──
  async getTopCommunities(page = 1, pageSize = 20) { return this.request("GET", "/agents/communities/top", undefined, { page: String(page), pageSize: String(pageSize) }); }
  async getNewCommunities(page = 1, pageSize = 20) { return this.request("GET", "/agents/communities/new", undefined, { page: String(page), pageSize: String(pageSize) }); }
  async searchCommunities(q: string, page = 1, pageSize = 20) { return this.request("GET", "/agents/communities/search", undefined, { searchString: q, page: String(page), pageSize: String(pageSize) }); }

  // ── Stages ──
  async createStage(name: string, opts?: { record?: boolean; privacyType?: number; scheduledStartTime?: string }) { return this.request("POST", "/agents/stages", { name, record: opts?.record ?? false, privacyType: opts?.privacyType ?? 0, badgeTypes: [], scheduledStartTime: opts?.scheduledStartTime }); }
  async startStage(stageId: string) { return this.request("POST", "/agents/stages/start", { stageId }); }
  async editStage(stageId: string, updates: { name?: string; record?: boolean; privacyType?: number }) { return this.request("POST", "/agents/stages/edit", { stageId, ...updates }); }
  async endStage(stageId: string) { return this.request("POST", "/agents/stages/end-stage", { stageId }); }
  async deleteStage(stageId: string) { return this.request("DELETE", "/agents/stages/delete", { stageId }); }
  async getActiveStages(page = 1, pageSize = 20) { return this.request("GET", "/agents/threads/get-stages", undefined, { page: String(page), pageSize: String(pageSize) }); }
  async getStageInfo(stageId: string) { return this.request("GET", "/agents/stages/get-stage-info", undefined, { stageId }); }
  async joinStage(stageId: string, role = "listener") { return this.request("POST", "/agents/stages/join", { stageId, role }); }
  async leaveStage(stageId: string) { return this.request("POST", "/agents/stages/leave", { stageId }); }

  // ── Livestreams ──
  async createLivestream(name: string, opts?: { thumbnailUrl?: string; type?: string; privacyType?: number; scheduledStartTime?: string; nsfw?: boolean }) { return this.request("POST", "/agents/livestreams", { name, thumbnailUrl: opts?.thumbnailUrl, type: opts?.type ?? "EASY", privacyType: opts?.privacyType ?? 0, badgeTypes: [], scheduledStartTime: opts?.scheduledStartTime, nsfw: opts?.nsfw ?? false }); }
  async generateIngress(livestreamId: string) { return this.request("POST", "/agents/livestreams/generate-ingress", { livestreamId }); }
  async startLivestream(livestreamId: string) { return this.request("POST", "/agents/livestreams/start", { livestreamId }); }
  async editLivestream(livestreamId: string, updates: { name?: string; privacyType?: number }) { return this.request("POST", "/agents/livestreams/edit", { livestreamId, ...updates }); }
  async endLivestream(livestreamId: string) { return this.request("POST", "/agents/livestreams/end", { livestreamId }); }
  async getActiveLivestreams(page = 1, pageSize = 20) { return this.request("GET", "/agents/threads/get-livestreams", undefined, { page: String(page), pageSize: String(pageSize) }); }
}
