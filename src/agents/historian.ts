import { spawn } from 'child_process';
import * as path from 'path';
import { Agent } from './base/agent';
import { KnowledgeBase } from '../knowledge/knowledge-base';

export interface FileHistory {
    file: string;
    commits: number;
    authors: Set<string>;
    lastModified: Date;
}

export class HistorianAgent extends Agent {

    constructor(knowledgeBase: KnowledgeBase) {
        super({
            name: 'historian',
            priority: 4 // Runs after static analysis
        }, knowledgeBase);
    }

    async explore(workspacePath: string): Promise<void> {
        this.log('Starting historical analysis...');

        try {
            const history = await this.analyzeGitHistory(workspacePath);
            this.knowledgeBase.store(this.name, history);
            this.log(`History analysis complete. Analyzed ${history.length} files.`);
        } catch (error) {
            this.log('Failed to analyze git history. Is this a git repo?');
            console.error(error);
        }
    }

    private async analyzeGitHistory(workspacePath: string): Promise<FileHistory[]> {
        // git log --name-only --format="commit:%H|%an|%ad" --date=iso
        const output = await this.runGitCommand(workspacePath, [
            'log',
            '--name-only',
            '--format=commit:%H|%an|%ad',
            '--date=iso',
            '--limit=1000' // Limit to last 1000 commits for performance
        ]);

        const historyMap = new Map<string, FileHistory>();
        let currentAuthor = '';
        let currentDate = new Date();

        const lines = output.split('\n');
        for (const line of lines) {
            if (!line.trim()) continue;

            if (line.startsWith('commit:')) {
                const parts = line.split('|');
                if (parts.length >= 3) {
                    currentAuthor = parts[1];
                    currentDate = new Date(parts[2]);
                }
            } else {
                // It's a file path
                const filePath = path.join(workspacePath, line.trim());

                if (!historyMap.has(filePath)) {
                    historyMap.set(filePath, {
                        file: filePath,
                        commits: 0,
                        authors: new Set(),
                        lastModified: new Date(0) // Epoch
                    });
                }

                const entry = historyMap.get(filePath)!;
                entry.commits++;
                entry.authors.add(currentAuthor);
                if (currentDate > entry.lastModified) {
                    entry.lastModified = currentDate;
                }
            }
        }

        // Convert Map to Array and serialize Sets
        return Array.from(historyMap.values()).map(entry => ({
            ...entry,
            authors: Array.from(entry.authors) as any // Cast to any to satisfy JSON serialization if needed later
        }));
    }

    private runGitCommand(cwd: string, args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const git = spawn('git', args, { cwd });
            let stdout = '';
            let stderr = '';

            git.stdout.on('data', data => stdout += data);
            git.stderr.on('data', data => stderr += data);

            git.on('close', code => {
                if (code !== 0) {
                    reject(new Error(`Git exited with code ${code}: ${stderr}`));
                } else {
                    resolve(stdout);
                }
            });
        });
    }
}
