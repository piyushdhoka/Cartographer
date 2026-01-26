
export interface AgentFinding {
    agent: string;
    timestamp: number;
    data: any;
}

export class KnowledgeBase {
    private storage: Map<string, AgentFinding> = new Map();

    /**
     * Store findings from an agent
     */
    store(agentName: string, data: any): void {
        this.storage.set(agentName, {
            agent: agentName,
            timestamp: Date.now(),
            data: data
        });
    }

    /**
     * Get findings from a specific agent
     */
    get(agentName: string): any | null {
        const finding = this.storage.get(agentName);
        return finding ? finding.data : null;
    }

    /**
     * Get all findings
     */
    getAll(): Record<string, any> {
        const result: Record<string, any> = {};
        for (const [key, value] of this.storage.entries()) {
            result[key] = value.data;
        }
        return result;
    }

    /**
     * Clear all knowledge
     */
    clear(): void {
        this.storage.clear();
    }
}
