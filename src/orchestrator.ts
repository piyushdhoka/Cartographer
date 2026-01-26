import { KnowledgeGraph } from './graph/knowledgeGraph';
import { QueryPlanner, QueryPlan } from './planner/queryPlanner';
import { GraphQueries } from './queries/graphQueries';
import { GeminiClient } from './llm/geminiClient';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import * as path from 'path';

export interface QueryResult {
    intent: string;
    files: string[];
    functions?: string[];
    contextPreview?: string;
    metadata?: any;
}

import { QueryParser } from './nlp/queryParser';

export class QueryOrchestrator {
    private planner: QueryPlanner;
    private queries: GraphQueries;
    private geminiClient: GeminiClient | null = null;
    private parser: QueryParser;

    constructor(
        private graph: KnowledgeGraph,
        geminiClient?: GeminiClient
    ) {
        this.planner = new QueryPlanner();
        this.queries = new GraphQueries(graph);
        this.parser = new QueryParser();
        this.geminiClient = geminiClient || null;
    }

    async runQuery(question: string): Promise<QueryResult> {
        // 0. Try deterministic regex parser first
        const parsed = this.parser.parse(question);
        if (parsed) {
            console.log(`[Orchestrator] Parsed intent: ${parsed.intent}, target: ${parsed.target}`);
            switch (parsed.intent) {
                case 'DEPENDENCIES':
                    return this.handleDependencies(parsed.target);
                case 'USAGE':
                    return this.handleUsage(parsed.target);
                case 'HISTORY':
                    return this.handleHistory(parsed.target);
                case 'RISKS':
                    return this.handleRisks(parsed.target);
                // EXPLAIN will fall through to LLM for now, or we can handle it if we have docs
            }
        }

        // 1. Plan the query (deterministic, no LLM)
        const plan = this.planner.plan(question);

        // 2. Execute graph query (no LLM)
        let result: QueryResult;

        switch (plan.intent) {
            case 'blast_radius':
                result = await this.handleBlastRadius(plan);
                break;
            case 'central_functions':
                result = await this.handleCentralFunctions();
                break;
            case 'important_files':
                result = await this.handleImportantFiles();
                break;
            case 'find_function':
                result = await this.handleFindFunction(plan);
                break;
            default:
                // For unknown queries, try using Gemini to answer directly
                result = await this.handleGeneralQuery(question);
        }

        // 3. LLM Phase (AFTER graph query) - Only for explanation
        if (this.geminiClient && this.geminiClient.isEnabled() && result.intent !== 'general_query') {
            try {
                // Build RAG context from graph-selected files
                const contextPreview = await this.buildContextPreview(result.files);

                // Get LLM explanation
                const explanation = await this.geminiClient.explainResult(
                    question,
                    result.intent,
                    result.files,
                    result.functions || [],
                    result.metadata,
                    contextPreview
                );

                if (explanation) {
                    result.contextPreview = explanation;
                }
            } catch (error) {
                console.warn('LLM explanation failed:', error);
                // Don't fail the query if LLM fails
            }
        }

        return result;
    }

    private async buildContextPreview(files: string[]): Promise<string> {
        // Read first few lines of top files for context
        const previews: string[] = [];

        for (const file of files.slice(0, 5)) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const lines = content.split('\n').slice(0, 20).join('\n');
                previews.push(`File: ${file}\n${lines}\n---`);
            } catch (error) {
                // Skip files we can't read
            }
        }

        return previews.join('\n\n');
    }

    private async handleBlastRadius(plan: QueryPlan): Promise<QueryResult> {
        if (!plan.functionName) {
            return {
                intent: 'blast_radius',
                files: [],
                functions: [],
                metadata: { error: 'Function name not found in question' }
            };
        }

        // Find the function
        const functions = this.queries.findFunctionByName(plan.functionName);
        if (functions.length === 0) {
            return {
                intent: 'blast_radius',
                files: [],
                functions: [],
                metadata: { error: `Function "${plan.functionName}" not found` }
            };
        }

        // Use the first match
        const functionId = functions[0].id;
        const blastRadius = this.queries.functionBlastRadius(functionId);

        return {
            intent: 'blast_radius',
            files: blastRadius.affectedFiles,
            functions: blastRadius.affectedFunctions,
            metadata: {
                functionId,
                depth: blastRadius.depth,
                affectedCount: blastRadius.affectedFunctions.length
            }
        };
    }

    private async handleCentralFunctions(): Promise<QueryResult> {
        const centrality = this.queries.functionCentrality();
        // Show top 20 instead of 10 to catch more functions
        const topFunctions = centrality.slice(0, 20);

        const files = new Set<string>();
        for (const func of topFunctions) {
            const node = this.graph.getNode(func.functionId);
            if (node && node.data.file) {
                files.add(node.data.file);
            }
        }

        return {
            intent: 'central_functions',
            files: Array.from(files),
            functions: topFunctions.map(f => f.functionId),
            metadata: {
                functions: topFunctions.map(f => ({
                    id: f.functionId,
                    centrality: f.centrality,
                    inDegree: f.inDegree,
                    outDegree: f.outDegree
                }))
            }
        };
    }

    private async handleImportantFiles(): Promise<QueryResult> {
        const importance = this.queries.fileImportance();
        const topFiles = importance.slice(0, 10);

        return {
            intent: 'important_files',
            files: topFiles.map(f => f.fileId),
            metadata: {
                files: topFiles.map(f => ({
                    file: f.fileId,
                    importance: f.importance,
                    functionCount: f.functionCount
                }))
            }
        };
    }

    private async handleFindFunction(plan: QueryPlan): Promise<QueryResult> {
        if (!plan.functionName) {
            return {
                intent: 'find_function',
                files: [],
                functions: []
            };
        }

        const functions = this.queries.findFunctionByName(plan.functionName);
        const files = new Set<string>();

        for (const func of functions) {
            if (func.data.file) {
                files.add(func.data.file);
            }
        }

        return {
            intent: 'find_function',
            files: Array.from(files),
            functions: functions.map(f => f.id),
            metadata: {
                functions: functions.map(f => ({
                    id: f.id,
                    name: f.data.name,
                    file: f.data.file,
                    startLine: f.data.startLine
                }))
            }
        };
    }

    private async handleGeneralQuery(question: string): Promise<QueryResult> {
        // For general queries, use Gemini to read files and answer
        if (!this.geminiClient || !this.geminiClient.isEnabled()) {
            return {
                intent: 'unknown',
                files: [],
                functions: [],
                contextPreview: 'Gemini API is not enabled. Please configure your API key in settings.'
            };
        }

        try {
            // Get workspace folder
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return {
                    intent: 'general_query',
                    files: [],
                    functions: [],
                    contextPreview: 'No workspace folder found.'
                };
            }

            // Get all code files from the graph (or read from workspace)
            const allFiles = this.graph.getNodesByType('File').map(n => n.data.path);

            // Select relevant files (prioritize important ones, limit to reasonable size)
            const importantFiles = this.queries.fileImportance().slice(0, 15).map(f => f.fileId);
            const filesToRead = [...new Set([...importantFiles, ...allFiles.slice(0, 20)])].slice(0, 20);

            // Read file contents
            const projectFiles: Array<{ path: string; content: string }> = [];
            let totalSize = 0;
            const maxSize = 50000; // Limit total content size

            for (const filePath of filesToRead) {
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    if (totalSize + content.length > maxSize) {
                        // Truncate if needed
                        const remaining = maxSize - totalSize;
                        projectFiles.push({
                            path: path.relative(workspaceFolder.uri.fsPath, filePath),
                            content: content.substring(0, remaining) + '\n... (truncated)'
                        });
                        break;
                    }
                    projectFiles.push({
                        path: path.relative(workspaceFolder.uri.fsPath, filePath),
                        content: content
                    });
                    totalSize += content.length;
                } catch (error) {
                    // Skip files we can't read
                    console.warn(`Failed to read ${filePath}:`, error);
                }
            }

            // Get answer from Gemini
            const answer = await this.geminiClient.answerCodebaseQuestion(question, projectFiles);

            return {
                intent: 'general_query',
                files: filesToRead,
                contextPreview: answer || 'Failed to get answer from Gemini API.'
            };
        } catch (error) {
            console.error('General query failed:', error);
            return {
                intent: 'general_query',
                files: [],
                functions: [],
                contextPreview: `Error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async handleDependencies(target: string): Promise<QueryResult> {
        // Find file node
        const fileName = path.basename(target);
        const files = this.graph.getNodesByType('File').filter(n => n.data.path.endsWith(fileName));

        if (files.length === 0) {
            return {
                intent: 'DEPENDENCIES',
                files: [],
                metadata: { error: `File "${target}" not found` }
            };
        }

        const fileId = files[0].id;
        const imports = this.graph.getOutgoingEdges(fileId).filter(e => e.type === 'IMPORTS');
        const dependencies = imports.map(e => this.graph.getNode(e.to)?.data.path).filter(p => p);

        return {
            intent: 'DEPENDENCIES',
            files: [files[0].data.path],
            contextPreview: `Dependencies of ${fileName}:\n${dependencies.map(d => `- ${path.basename(d || '')}`).join('\n')}`,
            metadata: { count: dependencies.length, dependencies }
        };
    }

    private async handleUsage(target: string): Promise<QueryResult> {
        // Find function or file
        const functions = this.graph.getNodesByType('Function').filter(n => n.data.name === target);

        if (functions.length === 0) {
            return {
                intent: 'USAGE',
                files: [],
                metadata: { error: `Function "${target}" not found` }
            };
        }

        const funcId = functions[0].id;
        const callers = this.graph.getIncomingEdges(funcId).filter(e => e.type === 'CALLS');
        const callingFunctions = callers.map(e => this.graph.getNode(e.from)?.data.name).filter(n => n);

        return {
            intent: 'USAGE',
            files: [functions[0].data.file],
            functions: [funcId],
            contextPreview: `Function ${target} is called by:\n${callingFunctions.map(c => `- ${c}`).join('\n')}`,
            metadata: { count: callingFunctions.length, callers: callingFunctions }
        };
    }

    private async handleHistory(target: string): Promise<QueryResult> {
        // Placeholder for now, as Historian data isn't directly in graph nodes yet
        // We would typically read this from KnowledgeBase if connected
        return {
            intent: 'HISTORY',
            files: [],
            contextPreview: `History analysis for ${target} requires Historian agent data integration.`,
            metadata: { warning: 'Not fully implemented yet' }
        };
    }

    private async handleRisks(target: string): Promise<QueryResult> {
        // Placeholder
        return {
            intent: 'RISKS',
            files: [],
            contextPreview: `Risk analysis for ${target} requires RiskAssessor agent data integration.`,
            metadata: { warning: 'Not fully implemented yet' }
        };
    }
}
