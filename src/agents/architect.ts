import { Agent } from './base/agent';
import { KnowledgeBase } from '../knowledge/knowledge-base';
import { Dependency } from './detective';
import { WorkspaceMetadata } from './archaeologist';

export interface ArchitectureInsight {
    type: 'CYCLE' | 'LAYERING' | 'STRUCTURE';
    message: string;
    details: string[];
    severity: 'MEDIUM' | 'HIGH';
}

export class ArchitectAgent extends Agent {

    constructor(knowledgeBase: KnowledgeBase) {
        super({
            name: 'architect',
            priority: 6 // Runs last to synthesize everything
        }, knowledgeBase);
    }

    async explore(workspacePath: string): Promise<void> {
        this.log('Starting architectural analysis...');

        const insights: ArchitectureInsight[] = [];

        // 1. Check for Circular Dependencies
        const dependencies = this.knowledgeBase.get('detective') as Dependency[];
        if (dependencies) {
            const cycles = this.findCycles(dependencies);
            if (cycles.length > 0) {
                insights.push({
                    type: 'CYCLE',
                    message: `Found ${cycles.length} circular dependencies`,
                    details: cycles.map(c => c.join(' -> ')),
                    severity: 'HIGH'
                });
            }
        }

        // 2. Analyze Project Structure (Monolith vs Modular)
        const metadata = this.knowledgeBase.get('archaeologist') as WorkspaceMetadata;
        if (metadata) {
            if (metadata.files.length > 50 && metadata.folders.length < 3) {
                insights.push({
                    type: 'STRUCTURE',
                    message: 'Potential Monolithic Structure Detected',
                    details: ['Low folder count relative to file count. Consider grouping by feature.'],
                    severity: 'MEDIUM'
                });
            }
        }

        this.knowledgeBase.store(this.name, insights);
        this.log(`Architecture analysis complete. Found ${insights.length} insights.`);
    }

    private findCycles(dependencies: Dependency[]): string[][] {
        const graph = new Map<string, string[]>();

        // Build adjacency list
        for (const dep of dependencies) {
            if (!graph.has(dep.from)) graph.set(dep.from, []);
            graph.get(dep.from)!.push(dep.to);
        }

        const cycles: string[][] = [];
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const visit = (node: string, path: string[]) => {
            visited.add(node);
            recursionStack.add(node);
            path.push(node);

            const neighbors = graph.get(node) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    visit(neighbor, [...path]);
                } else if (recursionStack.has(neighbor)) {
                    // Cycle detected!
                    // Extract the cycle from path
                    const cycleStartIndex = path.indexOf(neighbor);
                    cycles.push([...path.slice(cycleStartIndex), neighbor]);
                }
            }

            recursionStack.delete(node);
        };

        for (const node of graph.keys()) {
            if (!visited.has(node)) {
                visit(node, []);
            }
        }

        return cycles;
    }
}
