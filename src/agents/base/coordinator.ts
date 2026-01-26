import { Agent } from './agent';
import { KnowledgeBase } from '../../knowledge/knowledge-base';

export class AgentCoordinator {
    private agents: Agent[] = [];
    private knowledgeBase: KnowledgeBase;

    constructor(knowledgeBase: KnowledgeBase) {
        this.knowledgeBase = knowledgeBase;
    }

    /**
     * Register an agent with the coordinator
     */
    registerAgent(agent: Agent): void {
        this.agents.push(agent);
        // Sort by priority (lower number = higher priority/earlier execution)
        this.agents.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Run all registered agents in sequence
     */
    async runAll(workspacePath: string): Promise<Record<string, any>> {
        console.log('Starting multi-agent exploration...');

        for (const agent of this.agents) {
            console.log(`Running agent: ${agent.name}`);
            try {
                await agent.explore(workspacePath);
            } catch (error) {
                console.error(`Agent ${agent.name} failed:`, error);
                // Continue with other agents? Or stop? 
                // For now, log and continue, but maybe the next agent depends on this one.
            }
        }

        console.log('Exploration complete.');
        return this.knowledgeBase.getAll();
    }

    /**
     * Get a registered agent by name
     */
    getAgent(name: string): Agent | undefined {
        return this.agents.find(a => a.name === name);
    }
}
