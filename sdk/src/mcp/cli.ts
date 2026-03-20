import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Logiqical } from "../client.js";
import { createMcpServer } from "./server.js";

async function main() {
  const privateKey = process.env.LOGIQICAL_PRIVATE_KEY;
  const network = process.env.LOGIQICAL_NETWORK || "avalanche";
  const rpcUrl = process.env.LOGIQICAL_RPC_URL;
  const arenaApiKey = process.env.ARENA_API_KEY;

  let agent: Logiqical;

  if (privateKey) {
    agent = new Logiqical({ privateKey, network, rpcUrl, arenaApiKey });
    console.error(`Logiqical MCP — wallet ${agent.address}`);
  } else {
    // Boot from keystore (auto-generates on first run)
    agent = await Logiqical.boot({ network, rpcUrl, arenaApiKey });
    console.error(`Logiqical MCP — booted from keystore: ${agent.address}`);
  }

  const server = createMcpServer(agent);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Logiqical MCP server running (stdio)");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
