import { Agent } from './base/agent';
import { KnowledgeBase } from '../knowledge/knowledge-base';
import { GeminiClient } from '../llm/geminiClient';
import { FileHistory } from './historian';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';

export interface FileDocumentation {
    file: string;
    summary: string;
    complexityScore: number;
}

export class TranslatorAgent extends Agent {
    private geminiClient: GeminiClient | null = null;

    constructor(knowledgeBase: KnowledgeBase, extensionContext?: vscode.ExtensionContext) {
        super({
            name: 'translator',
            priority: 5 // Runs after Historian to document hotspots
        }, knowledgeBase);

        if (extensionContext) {
            this.geminiClient = new GeminiClient(extensionContext);
        }
    }

    async explore(workspacePath: string): Promise<void> {
        this.log('Starting documentation analysis...');

        if (!this.geminiClient || !this.geminiClient.isEnabled()) {
            this.log('Gemini API not enabled. Skipping translation/documentation.');
            return;
        }

        // Get hotspots from Historian
        const history = this.knowledgeBase.get('historian') as FileHistory[];
        if (!history) {
            this.log('No history found. Skipping.');
            return;
        }

        // Sort by commits to find most active files
        const hotspots = history.sort((a, b) => b.commits - a.commits).slice(0, 3);
        const docs: FileDocumentation[] = [];

        for (const hotspot of hotspots) {
            try {
                const content = await fs.readFile(hotspot.file, 'utf-8');
                // Don't analyze massive files
                if (content.length > 10000) continue;

                const summary = await this.geminiClient.answerCodebaseQuestion(
                    'Explain what this file does in 1 sentence. Then list its 3 main responsibilities.',
                    [{ path: hotspot.file, content }]
                );

                if (summary) {
                    docs.push({
                        file: hotspot.file,
                        summary: summary,
                        complexityScore: content.length / 100 // Crude complexity metric
                    });
                }
            } catch (error) {
                console.warn(`Failed to document ${hotspot.file}:`, error);
            }
        }

        this.knowledgeBase.store(this.name, docs);
        this.log(`Documentation generated for ${docs.length} files.`);
    }
}
