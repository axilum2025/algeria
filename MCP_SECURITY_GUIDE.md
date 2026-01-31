# Guide: MCP Security & UI Integration

## 1. Overview
We have integrated a full security layer for the Model Context Protocol (MCP). The AI engine (and the `/mcp` command) is now gated by user preferences stored in the browser (`localStorage`).

## 2. Changes Made
### A. Backend
- **MCP Server** (`mcp-server.js`): Running on port 3001. Handles `web`, `finance`, `communication` tools.
- **Proxy** (`dev-server.js`): Forwards `/mcp` requests to the backend securely.

### B. Frontend (UI)
- **Settings Panel**: Added a new "Model Context Protocol" section under Embeddings.
- **Global Toggle**: ON/OFF switch. If OFF, the agent refuses to execute any external command.
- **Granular Permissions**:
  - 🌍 **Web Search**: Allow/Deny Google/Bing searches.
  - 💱 **Finance**: Allow/Deny stock/crypto data access.
  - 📧 **Communication**: Allow/Deny email/slack actions.

### C. Logic (Security)
- **Chat Loop**: The `sendMessage()` function in `index.html` now checks `getMcpEnabled()` before calling the server.
- **Fail-Fast**: If a specific tool (e.g., "web") is used but disabled in settings, the client blocks the request immediately without hitting the server.

## 3. How to Test
1. **Refresh** the application.
2. Open **Settings** (Gear Icon).
3. Scroll to **Embeddings**. You will see the **MCP** section.
4. Set MCP to **OFF**.
5. Close Settings and type `/mcp web hello`.
   - Result: "⚠️ Le protocole MCP est désactivé..."
6. Go back and set MCP to **ON**, ensure "Web Search" is checked.
7. Type `/mcp web weather paris`.
   - Result: Fetches data via the MCP server.

## 4. Troubleshooting
- If buttons don't appear, clear browser cache.
- The default state is OFF for safety on first load (user must opt-in).
