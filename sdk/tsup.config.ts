import { defineConfig } from "tsup";

export default defineConfig([
  // Library — ESM + CJS + DTS
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "node18",
  },
  // MCP CLI binary — ESM, bundled with local code, npm deps external
  {
    entry: ["src/mcp/cli.ts"],
    format: ["esm"],
    dts: false,
    sourcemap: false,
    banner: { js: "#!/usr/bin/env node" },
    target: "node18",
    external: ["ethers", "@modelcontextprotocol/sdk", "zod"],
  },
  // Admin CLI binary
  {
    entry: ["src/cli/admin.ts"],
    format: ["esm"],
    dts: false,
    sourcemap: false,
    banner: { js: "#!/usr/bin/env node" },
    target: "node18",
    external: ["ethers"],
  },
  // Vault daemon binary
  {
    entry: ["src/cli/vault.ts"],
    format: ["esm"],
    dts: false,
    sourcemap: false,
    banner: { js: "#!/usr/bin/env node" },
    target: "node18",
    external: ["ethers"],
  },
]);
