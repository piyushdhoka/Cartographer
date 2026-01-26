import * as fs from 'fs/promises';
import * as path from 'path';
import { Agent } from './base/agent';
import { KnowledgeBase } from '../knowledge/knowledge-base';
import { WorkspaceMetadata } from './archaeologist';

export interface Dependency {
    from: string;
    to: string;
    type: 'IMPORTS';
}

export class DetectiveAgent extends Agent {

    constructor(knowledgeBase: KnowledgeBase) {
        super({
            name: 'detective',
            priority: 2 // Runs after Archaeologist
        }, knowledgeBase);
    }

    async explore(workspacePath: string): Promise<void> {
        this.log('Starting exploration...');

        // Get file list from Archaeologist's findings
        const archaeologistData = this.knowledgeBase.get('archaeologist') as WorkspaceMetadata;

        if (!archaeologistData || !archaeologistData.files) {
            this.log('No files found from Archaeologist. Aborting.');
            return;
        }

        const files = archaeologistData.files;
        const dependencies = await this.extractDependencies(files, workspacePath);

        this.knowledgeBase.store(this.name, dependencies);
        this.log(`Exploration complete. Found ${dependencies.length} dependencies.`);
    }

    async extractDependencies(files: string[], workspacePath: string): Promise<Dependency[]> {
        const dependencies: Dependency[] = [];

        for (const file of files) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const deps = this.extractFromFile(file, content, workspacePath);
                dependencies.push(...deps);
            } catch (error) {
                console.warn(`Failed to read ${file}:`, error);
            }
        }

        return dependencies;
    }

    private extractFromFile(filePath: string, content: string, workspacePath: string): Dependency[] {
        const ext = path.extname(filePath);
        const dependencies: Dependency[] = [];

        if (ext === '.py') {
            return this.extractPythonImports(filePath, content, workspacePath);
        } else if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
            return this.extractJSImports(filePath, content, workspacePath);
        }

        return dependencies;
    }

    private extractPythonImports(filePath: string, content: string, workspacePath: string): Dependency[] {
        const dependencies: Dependency[] = [];
        const lines = content.split('\n');

        // Match: import module, from module import x, from package.module import x
        const importRegex = /^(?:import\s+(\S+)|from\s+(\S+)\s+import)/;

        for (const line of lines) {
            const match = line.match(importRegex);
            if (match) {
                const moduleName = match[1] || match[2];
                if (moduleName && !moduleName.startsWith('.')) {
                    // Try to resolve to a file
                    const resolved = this.resolvePythonModule(moduleName, filePath, workspacePath);
                    if (resolved) {
                        dependencies.push({
                            from: filePath,
                            to: resolved,
                            type: 'IMPORTS'
                        });
                    }
                }
            }
        }

        return dependencies;
    }

    private extractJSImports(filePath: string, content: string, workspacePath: string): Dependency[] {
        const dependencies: Dependency[] = [];

        // Match: import ... from '...', require('...')
        const importRegex = /(?:import\s+.*\s+from\s+['"]([^'"]+)['"]|require\s*\(['"]([^'"]+)['"]\))/g;
        let match;

        while ((match = importRegex.exec(content)) !== null) {
            const modulePath = match[1] || match[2];
            if (modulePath && !modulePath.startsWith('.')) {
                // External module, skip for now
                continue;
            }

            const resolved = this.resolveJSModule(modulePath, filePath, workspacePath);
            if (resolved) {
                dependencies.push({
                    from: filePath,
                    to: resolved,
                    type: 'IMPORTS'
                });
            }
        }

        return dependencies;
    }

    private resolvePythonModule(moduleName: string, fromFile: string, workspacePath: string): string | null {
        // Simple resolution: try common patterns
        const fromDir = path.dirname(fromFile);
        const possiblePaths = [
            path.join(fromDir, `${moduleName}.py`),
            path.join(fromDir, moduleName, '__init__.py'),
            path.join(workspacePath, `${moduleName}.py`),
            path.join(workspacePath, moduleName, '__init__.py')
        ];

        // In a real implementation, you'd check if files exist
        // For now, return the most likely path
        return possiblePaths[0];
    }

    private resolveJSModule(modulePath: string, fromFile: string, workspacePath: string): string | null {
        const fromDir = path.dirname(fromFile);
        let resolved = path.resolve(fromDir, modulePath);

        // Try adding extensions
        const extensions = ['.ts', '.tsx', '.js', '.jsx', ''];
        for (const ext of extensions) {
            const withExt = resolved + ext;
            if (withExt.startsWith(workspacePath)) {
                return withExt;
            }
            // Try index files
            const indexPath = path.join(resolved, `index${ext}`);
            if (indexPath.startsWith(workspacePath)) {
                return indexPath;
            }
        }

        return resolved.startsWith(workspacePath) ? resolved : null;
    }
}
