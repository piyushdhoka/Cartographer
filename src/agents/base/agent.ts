import { KnowledgeBase } from '../../knowledge/knowledge-base';

export interface AgentConfig {
    name: string;
    priority: number;
}

export abstract class Agent {
    protected config: AgentConfig;
    protected knowledgeBase: KnowledgeBase;

    constructor(config: AgentConfig, knowledgeBase: KnowledgeBase) {
        this.config = config;
        this.knowledgeBase = knowledgeBase;
    }

    get name(): string {
        return this.config.name;
    }

    get priority(): number {
        return this.config.priority;
    }

    /**
     * Main execution method for the agent.
     * @param workspacePath Root path of the workspace to analyze
     */
    abstract explore(workspacePath: string): Promise<void>;

    /**
     * Helper to log agent activity
     */
    protected log(message: string): void {
        console.log(`[${this.name}] ${message}`);
    }
}
