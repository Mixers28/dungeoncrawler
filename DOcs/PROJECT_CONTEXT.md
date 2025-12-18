# Project Context – Long-Term Memory (LTM)

> High-level design, tech decisions, constraints for this project.  
> This is the **source of truth** for agents and humans.

<!-- SUMMARY_START -->
**Summary (auto-maintained by Agent):**
- Template repo proving Markdown + Git can store long-lived memory for AI coding agents.
- Entire workflow stays local inside VS Code + PowerShell, no backend dependencies.
- Immediate push: polish docs, add an example project, and validate on a real codebase.
<!-- SUMMARY_END -->

---

## 1. Project Overview

- **Name:** local-mcp-context-kit
- **Owner:** TBD (template maintainer)
- **Purpose:** Template repo demonstrating how Markdown plus Git can serve as durable memory for AI coding agents.
- **Primary Stack:** Git + Markdown docs, VS Code editor, PowerShell helper scripts (no backend).
- **Target Platforms:** Local developer environments (VS Code on desktop).

---

## 2. Core Design Pillars

- Keep project memory transparent and versioned via Markdown in Git.
- Maintain an editor-native workflow (VS Code + PowerShell) without external services.
- Provide a reusable template that agents and humans can adopt quickly.

---

## 3. Technical Decisions & Constraints

- Language(s): Markdown for docs; PowerShell/Python helper scripts as needed.
- Framework(s): None; rely on native editor tooling.
- Database / storage: Git repository history; no external database.
- Hosting / deployment: Shared via Git hosting and cloned locally.
- Non-negotiable constraints:
  - Must remain backend-free and editor-native.
  - Documentation stays in plain Markdown for easy review.

---

## 4. Architecture Snapshot

- Docs folder holds long-term (PROJECT_CONTEXT), working-memory (NOW), and session logs (SESSION_NOTES).
- Scripts (e.g., session-helper.sh / session-helper.ps1) guide agents through start/end rituals.
- VS Code tasks integrate with these scripts so humans/agents share the same workflow.

---

## 5. Links & Related Docs

- Roadmap: TBD
- Design docs: docs/MCP_LOCAL_DESIGN.md, docs/AGENT_SESSION_PROTOCOL.md
- Specs: docs/Repo_Structure.md
- Product / UX docs: docs/PROJECT_CONTEXT.md, docs/NOW.md

---

## 6. Change Log (High-Level Decisions)

Use this section for **big decisions** only:

- `YYYY-MM-DD` – Decided on X instead of Y.
- `YYYY-MM-DD` – Switched primary deployment target to Z.
