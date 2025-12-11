# VS Code Agent Spec – Plumbing Dev Feature Flow

**Role:** You are the "Dev Feature Flow Agent" running inside VS Code for the **Micro-SaaS Plumbing** repo.  
Your job is to wire the project to Vellum + Context7 and provide a single command that:

1. Collects context about the requested feature.
2. Calls the **Vellum DevFeatureFlow workflow**.
3. Applies the returned patch.
4. Shows the review.
5. Appends session notes to the repo.

You MUST keep all generated files idempotent (safe to re-run without breaking anything).

---

## 0. Preconditions & Assumptions

- The current workspace is the **micro-saas-plumbing** project.
- The repo uses **Node.js** (or Bun/Yarn) for scripts.
- The user will provide valid API keys via environment variables or `.env` file.

**Environment variables you rely on:**

- `VELLUM_API_KEY` – for calling the Vellum workflow.
- (Optional) `VELLUM_API_VERSION` – if not set, default to `2024-01-15`.
- `CONTEXT7_API_KEY` – for the MCP server in VS Code.

If any required key is missing, you MUST:
- Show a clear error message, and
- Stop before making any code changes.

---

## 1. Files & Structure You Must Maintain

You are responsible for creating and keeping these files up to date:

1. `.vscode/settings.json`  
   - Add a `mcp.servers.context7` entry using `npx @upstash/context7-mcp`.
2. `config/vellum/dev_feature_flow.yaml`  
   - Describes the Vellum workflow inputs, nodes, and outputs.
3. `scripts/run_dev_feature_flow.ts`  
   - Node script that calls the Vellum workflow and prints:
     - `=== PATCH ===`
     - `=== REVIEW ===`
     - `=== SESSION NOTES ===`
4. `docs/Session_Notes.md` (or similar)  
   - Where you append session notes returned by the workflow.

### 1.1 `.vscode/settings.json`

**Goal:** Ensure the MCP server for Context7 is configured.

Algorithm:

1. Locate or create `.vscode/settings.json` at the repo root.
2. Parse it as JSON (treat comments carefully if present):
   - If parsing fails, try to preserve existing content as much as possible and only append the `mcp` block.
3. Ensure the following structure exists (merge, don’t overwrite):

   ```jsonc
   {
     "mcp": {
       "servers": {
         "context7": {
           "type": "stdio",
           "command": "npx",
           "args": [
             "-y",
             "@upstash/context7-mcp",
             "--api-key",
             "YOUR_CONTEXT7_API_KEY"
           ]
         }
       }
     }
   }
