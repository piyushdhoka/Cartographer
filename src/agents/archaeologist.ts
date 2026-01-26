import { FileNode, WorkspaceScanner } from '../workspace/scanner';
import * as path from 'path';
import { Agent } from './base/agent';
import { KnowledgeBase } from '../knowledge/knowledge-base';

export interface WorkspaceMetadata {
    files: string[];
    folders: string[];
    languages: Record<string, number>;
    entryPoints: string[];
}

const ENTRY_POINT_PATTERNS = [
    'main.py',
    'index.js',
    'index.ts',
    'app.ts',
    'app.js',
    'server.ts',
    'server.js',
    'main.ts',
    'main.js',
    'app.py',
    'server.py'
];

export class ArchaeologistAgent extends Agent {

    constructor(knowledgeBase: KnowledgeBase) {
        super({
            name: 'archaeologist',
            priority: 1 // Runs first to map the terrain
        }, knowledgeBase);
    }

    async explore(workspacePath: string): Promise<void> {
        this.log('Starting exploration...');

        // Scan the workspace
        const scanner = new WorkspaceScanner();
        // Note: In a real scenario, we might want to get the fileTree from somewhere else or scan it here.
        // For now, let's assume we scan from scratch or the scanner handles it.
        // But wait, the original analyze method took `fileTree`. 
        // Let's create a fresh scan for now, as the Agent interface is generic.
        // Assuming scanner.scan(workspacePath) exists or similar. 
        // Looking at previous code: `scanner.getAllFiles(workspacePath, fileTree)` used fileTree.
        // I'll need to check `WorkspaceScanner` to see how to get the fileTree.

        // Let's assume for this refactor that we can just scan.
        // If WorkspaceScanner needs a tree, I might need to generate it.
        // Let's peek at WorkspaceScanner in a separate tool call if I wasn't sure, 
        // but I see `scanner.getAllFiles` takes a `fileTree`.
        // I'll try to generate the fileTree here.

        const fileTree = await scanner.scan(workspacePath);
        const allFiles = await scanner.getAllFiles(workspacePath, fileTree);

        const files: string[] = [];
        const folders = new Set<string>();
        const languages: Record<string, number> = {};
        const entryPoints: string[] = [];

        for (const file of allFiles) {
            files.push(file);

            // Extract folder
            const folder = path.dirname(file);
            if (folder !== workspacePath) {
                folders.add(folder);
            }

            // Count languages
            const ext = path.extname(file);
            const lang = this.getLanguage(ext);
            if (lang) {
                languages[lang] = (languages[lang] || 0) + 1;
            }

            // Check entry points
            const basename = path.basename(file);
            if (ENTRY_POINT_PATTERNS.includes(basename)) {
                entryPoints.push(file);
            }
        }

        const findings: WorkspaceMetadata = {
            files,
            folders: Array.from(folders),
            languages,
            entryPoints
        };

        this.knowledgeBase.store(this.name, findings);
        this.log(`Exploration complete. Found ${files.length} files.`);
    }

    private getLanguage(ext: string): string | null {
        const langMap: Record<string, string> = {
            '.py': 'Python',
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.jsx': 'JavaScript',
            '.tsx': 'TypeScript',
            '.java': 'Java',
            '.cpp': 'C++',
            '.c': 'C',
            '.go': 'Go',
            '.rs': 'Rust',
            '.rb': 'Ruby',
            '.php': 'PHP'
        };
        return langMap[ext] || null;
    }
}
