# Project Cartographer - AI Context & Directive

## 1. Project Overview
Project Cartographer is an advanced **multi-agent AI system embedded as a VS Code extension**. It acts as a team of specialized "AI archaeologists" that investigate, map, and understand a user's codebase in real-time.

**Goal:** Provide deep architectural insights, dependency maps, and risk assessments that go beyond simple "find references" or single-file analysis.

## 2. Current Capabilities (The Foundation)
The project is currently a functional VS Code extension with the following structure:

### codebase Structure (`/src`)
- `extension.ts`: Main entry point.
- `agents/`: Contains standalone agent logic.
  - `archaeologist.ts`: Analyzes file structure, counts languages, identifies entry points.
  - `detective.ts`: Extracts imports/dependencies from Python and JS/TS files.
- `graph/`: Implementation of the knowledge graph.
- `orchestrator.ts`: Manages the query process.
- `extractors/`: AST parsing helpers.

### Core Features Validated
- **VS Code Activation**: Successfully runs inside VS Code.
- **File System Access**: Can traverse the workspace and ignore standard patterns.
- **Basic Parsing**: Regex and basic AST parsing for imports.
- **Metadata Storage**: Can store what it finds in memory.

## 3. The Vision: Multi-Agent Architecture
We are evolving this from a single-threaded tool into a **collaborative multi-agent system**.

### The Agent Squad
1. **🏛️ The Archaeologist**: Maps project structure, tech stack, and module boundaries.
2. **🔍 The Detective**: Traces execution paths, API flows, and circular dependencies.
3. **📜 The Historian**: Analyzes Git history for code evolution and hotspots.
4. **📖 The Translator**: Generates documentation and "plain English" explanations.
5. **⚠️ The Risk Assessor**: Scans for security flaws, tech debt, and test coverage gaps.
6. **🏗️ The Architect**: Recommends refactoring and design improvements.

## 4. Immediate Development Plan (Phase 1)
**Objective:** Implement the Agent Infrastructure and upgrade existing agents to a unified protocol.

### Tasks
1. **Create `Agent` Base Class**:
   - Abstract class defining `explore()`, `analyze()`, and `report()`.
   - Standardized communication protocol.

2. **Develop `AgentCoordinator`**:
   - Orchestration logic to run agents in parallel or sequence.
   - Resource management to prevent freezing the IDE.

3. **Implement Shared `KnowledgeBase`**:
   - A central store where agents write findings and read others' work.
   - Schema: `{ agent: string, findings: any, timestamp: number }`.

4. **Refactor Existing Agents**:
   - Convert `ArchaeologistAgent` and `DetectiveAgent` to extend the new `Agent` class.
   - Utilize the new `KnowledgeBase` for storage instead of local returns.

## 5. Technical Constraints & Guidelines
- **Environment**: VS Code Extension Host (Node.js).
- **Languages**: TypeScript (Strict mode).
- **Performance**: Must not block the UI thread. Use async/await and chunk processing.
- **Context Management**: The codebase may be huge. Agents must process in consistent chunks (e.g., 10 files at a time) and summarize findings to avoid OOM.

## 6. Directive for AI (Gemini)
You are the Lead Engineer for Project Cartographer.
- **Review the Architecture**: Ensure the multi-agent design is sound.
- **Implement functionality**: Write code for the `Agent` class, `Coordinator`, and refactored agents.
- **Proactive Improvements**: If you see a better way to handle dependency resolution or graph storage, propose and implement it.

**Let's build the intelligence layer.**
