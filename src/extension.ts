import * as vscode from 'vscode';
import { WorkspaceScanner } from './workspace/scanner';
import { ArchaeologistAgent, WorkspaceMetadata } from './agents/archaeologist';
import { DetectiveAgent, Dependency } from './agents/detective';
import { RiskAssessorAgent, RiskFinding } from './agents/risk-assessor';
import { HistorianAgent, FileHistory } from './agents/historian';
import { TranslatorAgent, FileDocumentation } from './agents/translator';
import { ArchitectAgent, ArchitectureInsight } from './agents/architect';
import { AgentCoordinator } from './agents/base/coordinator';
import { KnowledgeBase } from './knowledge/knowledge-base';
import { PythonExtractor } from './extractors/pythonExtractor';
import { JSExtractor } from './extractors/jsExtractor';
import { KnowledgeGraph } from './graph/knowledgeGraph';
import { QueryOrchestrator } from './orchestrator';
import { GeminiClient } from './llm/geminiClient';
import { createWebviewPanel } from './ui/webview';

let graph: KnowledgeGraph | null = null;
let orchestrator: QueryOrchestrator | null = null;
let agentData: any = null;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Project Cartographer is now active!');

    graph = new KnowledgeGraph();
    const geminiClient = new GeminiClient(context);

    const disposable = vscode.commands.registerCommand('projectCartographer.openView', async () => {
        if (!graph) {
            vscode.window.showErrorMessage('Graph not initialized yet. Please wait for the graph to finish building.');
            return;
        }
        if (!orchestrator) {
            vscode.window.showWarningMessage('Orchestrator not ready yet. Graph is still building...');
            return;
        }
        const panel = createWebviewPanel(context.extensionUri, graph, orchestrator, agentData);
        context.subscriptions.push(panel);
    });

    context.subscriptions.push(disposable);

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Building codebase graph...",
        cancellable: false
    }, async (progress) => {
        try {
            agentData = await buildKnowledgeGraph(progress, context);
            orchestrator = new QueryOrchestrator(graph!, geminiClient);

            const panel = createWebviewPanel(context.extensionUri, graph!, orchestrator, agentData);
            context.subscriptions.push(panel);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to build graph: ${errorMessage}`);
            console.error('Graph building error:', error);
        }
    });
}

async function buildKnowledgeGraph(progress: vscode.Progress<{ message?: string; increment?: number }>, context: vscode.ExtensionContext) {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        throw new Error('No workspace folder found');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const workspacePath = workspaceFolder.uri.fsPath;

    progress.report({ message: 'Scanning workspace...', increment: 10 });

    // 1. Initialize Infrastructure
    const knowledgeBase = new KnowledgeBase();
    const coordinator = new AgentCoordinator(knowledgeBase);

    // Register Agents
    coordinator.registerAgent(new ArchaeologistAgent(knowledgeBase));
    coordinator.registerAgent(new DetectiveAgent(knowledgeBase));
    coordinator.registerAgent(new RiskAssessorAgent(knowledgeBase));
    coordinator.registerAgent(new HistorianAgent(knowledgeBase));
    coordinator.registerAgent(new TranslatorAgent(knowledgeBase, context));
    coordinator.registerAgent(new ArchitectAgent(knowledgeBase));

    progress.report({ message: 'Agents exploring...', increment: 10 });

    // 2. Run Agents
    await coordinator.runAll(workspacePath);

    // 3. Populate Knowledge Graph from Agent Findings
    const knowledge = knowledgeBase.getAll();
    const metadata = knowledge['archaeologist'] as WorkspaceMetadata;
    const dependencies = knowledge['detective'] as Dependency[];
    const risks = knowledge['risk-assessor'] as RiskFinding[];
    const history = knowledge['historian'] as FileHistory[];
    const docs = knowledge['translator'] as FileDocumentation[];
    const insights = knowledge['architect'] as ArchitectureInsight[];

    if (risks) {
        console.log(`[RiskAssessor] Found ${risks.length} risks.`);
        risks.forEach(r => console.log(` - [${r.severity}] ${r.message} in ${r.file}:${r.line}`));
        // TODO: Add risks to graph nodes or edges for visualization
    }

    if (history) {
        console.log(`[Historian] Analyzed history for ${history.length} files.`);
        // sort by commits desc
        const hotspots = history.sort((a, b) => b.commits - a.commits).slice(0, 5);
        console.log('[Historian] Top Hotspots:');
        hotspots.forEach(h => console.log(` - ${h.file} (${h.commits} commits)`));
    }

    if (docs) {
        console.log(`[Translator] Generated docs for ${docs.length} files.`);
        docs.forEach(d => console.log(` - ${d.file}: ${d.summary.substring(0, 50)}...`));
    }

    if (insights) {
        console.log(`[Architect] Found ${insights.length} architectural insights.`);
        insights.forEach(i => console.log(` - [${i.type}] ${i.message}`));
    }

    if (metadata) {
        progress.report({ message: 'Building graph nodes...', increment: 30 });
        // Add files and folders to graph
        for (const file of metadata.files) {
            graph!.addNode({ id: file, type: 'File', data: { path: file } });
        }

        for (const folder of metadata.folders) {
            graph!.addNode({ id: folder, type: 'Folder', data: { path: folder } });
        }
    }

    if (dependencies) {
        progress.report({ message: 'Building graph edges...', increment: 40 });
        for (const dep of dependencies) {
            graph!.addEdge({
                from: dep.from,
                to: dep.to,
                type: 'IMPORTS'
            });
        }
    }

    progress.report({ message: 'Extracting functions...', increment: 50 });

    // 4. Extract functions (Legacy/Non-Agent extraction for now)
    // Ideally this should be an agent too
    const pythonExtractor = new PythonExtractor();
    const jsExtractor = new JSExtractor();

    if (metadata && metadata.files) {
        for (const file of metadata.files) {
            try {
                if (file.endsWith('.py')) {
                    const functions = await pythonExtractor.extract(file, workspacePath);
                    if (functions.length > 0) {
                        console.log(`Extracted ${functions.length} functions from ${file}`);
                    }
                    for (const func of functions) {
                        graph!.addNode({
                            id: func.id,
                            type: 'Function',
                            data: func
                        });
                        graph!.addEdge({
                            from: file,
                            to: func.id,
                            type: 'DEFINES'
                        });
                        // Note: func.calls are function names, not function IDs
                        // We'll try to match them to actual function nodes
                        for (const call of func.calls) {
                            // Try to find a function with this name
                            const calledFunctions = graph!.getNodesByType('Function').filter(
                                f => f.data.name === call || f.id.includes(`::${call}`)
                            );
                            if (calledFunctions.length > 0) {
                                // Link to the first match
                                graph!.addEdge({
                                    from: func.id,
                                    to: calledFunctions[0].id,
                                    type: 'CALLS'
                                });
                            }
                        }
                    }
                } else if (file.match(/\.(js|ts|jsx|tsx)$/)) {
                    const functions = await jsExtractor.extract(file, workspacePath);
                    if (functions.length > 0) {
                        console.log(`Extracted ${functions.length} functions from ${file}`);
                    }
                    for (const func of functions) {
                        graph!.addNode({
                            id: func.id,
                            type: 'Function',
                            data: func
                        });
                        graph!.addEdge({
                            from: file,
                            to: func.id,
                            type: 'DEFINES'
                        });
                        // Try to match call names to actual function nodes
                        for (const call of func.calls) {
                            const calledFunctions = graph!.getNodesByType('Function').filter(
                                f => f.data.name === call || f.id.includes(`::${call}`)
                            );
                            if (calledFunctions.length > 0) {
                                graph!.addEdge({
                                    from: func.id,
                                    to: calledFunctions[0].id,
                                    type: 'CALLS'
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn(`Failed to extract from ${file}:`, error);
            }
        }
    }

    progress.report({ message: 'Finalizing graph...', increment: 90 });

    console.log(`Graph built: ${graph!.getNodeCount()} nodes, ${graph!.getEdgeCount()} edges`);

    return knowledgeBase.getAll();
}

export function deactivate() {
    graph = null;
    orchestrator = null;
}
