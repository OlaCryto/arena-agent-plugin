"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArenaPlugin = exports.TxBuilder = exports.broadcast = exports.createProvider = exports.LaunchpadModule = exports.StakingModule = exports.SwapModule = void 0;
// SDK exports — modular architecture
var swap_1 = require("./swap");
Object.defineProperty(exports, "SwapModule", { enumerable: true, get: function () { return swap_1.SwapModule; } });
var staking_1 = require("./staking");
Object.defineProperty(exports, "StakingModule", { enumerable: true, get: function () { return staking_1.StakingModule; } });
var launchpad_1 = require("./launchpad");
Object.defineProperty(exports, "LaunchpadModule", { enumerable: true, get: function () { return launchpad_1.LaunchpadModule; } });
var provider_1 = require("./core/provider");
Object.defineProperty(exports, "createProvider", { enumerable: true, get: function () { return provider_1.createProvider; } });
Object.defineProperty(exports, "broadcast", { enumerable: true, get: function () { return provider_1.broadcast; } });
__exportStar(require("./core/constants"), exports);
// Legacy exports for backwards compatibility
var txbuilder_1 = require("./txbuilder");
Object.defineProperty(exports, "TxBuilder", { enumerable: true, get: function () { return txbuilder_1.TxBuilder; } });
var arena_1 = require("./arena");
Object.defineProperty(exports, "ArenaPlugin", { enumerable: true, get: function () { return arena_1.ArenaPlugin; } });
//# sourceMappingURL=index.js.map