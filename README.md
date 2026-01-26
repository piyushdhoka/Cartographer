# Project Cartographer

A production-grade VS Code extension that uses agentic, graph-based static analysis to understand codebases and answer architectural questions.

## Features

- **Workspace Scanning**: Recursively scans workspace folders (excluding node_modules, .git, etc.)
- **Static Analysis**: Extracts functions, dependencies, and relationships
- **Knowledge Graph**: Builds a graph representation of your codebase
- **Graph Queries**: Answers questions like:
  - "What breaks if I change this function?" (blast radius)
  - "Which functions are most central?" (centrality analysis)
  - "What should a new dev read first?" (file importance)
- **Natural Language Queries**: Ask questions in plain English
- **Gemini AI Integration**: Optional LLM explanations (requires API key)

## Installation

1. Clone this repository
2. Run `npm install`
3. Press F5 to open a new VS Code window with the extension loaded

## Configuration

To enable Gemini AI explanations:

**Option 1: Using .env file (Recommended)**
1. Get a Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a `.env` file in the project root (or copy `.env.example`)
3. Add your API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
4. The extension will automatically detect and use it

**Option 2: Using VS Code Settings**
1. Get a Gemini API key from Google AI Studio
2. Open VS Code settings
3. Set `projectCartographer.geminiApiKey` to your API key
4. Enable `projectCartographer.enableLLM`

## Usage

1. Open a workspace in VS Code
2. The extension will automatically scan and build the knowledge graph
3. Use the "Project Cartographer" view to ask questions about your codebase

## Architecture

- **Coordinator**: Orchestrates the multi-agent system.
- **Archaeologist Agent**: Maps the repository structure and languages.
- **Detective Agent**: Resolves dependencies and imports.
- **Risk Assessor**: Scans for security risks and technical debt.
- **Historian Agent**: Analyzes Git history for hotspots.
- **Translator Agent**: Auto-documents complex code (requires Gemini).
- **Architect Agent**: Detects circular dependencies and structural issues.
- **Knowledge Base**: Shared memory for agent findings.
- **Knowledge Graph**: Central graph data structure for queries.


## Development

```bash
npm install
npm run compile
npm run watch  # For development
```

## Requirements

- Node.js 18+
- Python 3.x (for Python AST parsing)
- VS Code 1.80+
