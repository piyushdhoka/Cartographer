import * as vscode from 'vscode';
import { KnowledgeGraph } from '../graph/knowledgeGraph';
import { QueryOrchestrator } from '../orchestrator';
import * as fs from 'fs';
import * as path from 'path';

export function createWebviewPanel(
    extensionUri: vscode.Uri,
    graph: KnowledgeGraph,
    orchestrator: QueryOrchestrator,
    data?: any
): vscode.Disposable {
    const panel = vscode.window.createWebviewPanel(
        'projectCartographer',
        'Project Cartographer',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'out'),
                vscode.Uri.joinPath(extensionUri, 'src')
            ]
        }
    );

    panel.webview.html = getWebviewContent(panel.webview, extensionUri);

    // Get all files for dropdown
    const allFiles = graph.getNodesByType('File').map(n => n.data.path);

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
        async (message) => {
            switch (message.command) {
                case 'getFiles':
                    panel.webview.postMessage({
                        command: 'files',
                        files: allFiles
                    });
                    break;

                case 'runQuery':
                    try {
                        console.log('Query received:', message.question);
                        panel.webview.postMessage({
                            command: 'loading',
                            loading: true
                        });

                        console.log('Running query through orchestrator...');
                        // Check if orchestrator is valid
                        if (!orchestrator) {
                            throw new Error('Orchestrator is not initialized.');
                        }
                        const result = await orchestrator.runQuery(message.question);
                        console.log('Query result:', result);

                        panel.webview.postMessage({
                            command: 'result',
                            result,
                            loading: false
                        });
                        console.log('Result message sent to webview');
                    } catch (error) {
                        console.error('Query error:', error);
                        panel.webview.postMessage({
                            command: 'error',
                            error: error instanceof Error ? error.message : String(error),
                            loading: false
                        });
                    }
                    break;

                case 'openFile':
                    try {
                        const doc = await vscode.workspace.openTextDocument(message.file);
                        await vscode.window.showTextDocument(doc);
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to open file: ${message.file}`);
                    }
                    break;
            }
        },
        undefined,
        []
    );

    // Send initial files list
    panel.webview.postMessage({
        command: 'files',
        files: allFiles
    });

    // Send agent data
    if (data) {
        setTimeout(() => {
            panel.webview.postMessage({
                command: 'data',
                data: data
            });
        }, 500); // Small delay to ensure webview is ready
    }

    return panel;
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    try {
        // Construct path to the HTML file
        // Note: In development, it's in src/ui/dashboard.html
        // In production (compile), it will be in out/ui/dashboard.html
        // We added copy-assets, so we should look in out/ui first if running from there.

        let htmlPath = vscode.Uri.joinPath(extensionUri, 'out', 'ui', 'dashboard.html');

        // Check if out file exists
        if (!fs.existsSync(htmlPath.fsPath)) {
            // Fallback to src for dev mode if cp didn't run
            htmlPath = vscode.Uri.joinPath(extensionUri, 'src', 'ui', 'dashboard.html');
        }

        const fsPath = htmlPath.fsPath;
        if (fs.existsSync(fsPath)) {
            let html = fs.readFileSync(fsPath, 'utf-8');
            return html;
        } else {
            console.error('dashboard.html not found at ' + fsPath);
            return `<!DOCTYPE html><html><body><h1>Error loading dashboard</h1><p>File not found: ${fsPath}</p></body></html>`;
        }
    } catch (e) {
        console.error('Failed to load dashboard.html', e);
        return `<!DOCTYPE html><html><body><h1>Error loading dashboard</h1><p>${String(e)}</p></body></html>`;
    }
}
