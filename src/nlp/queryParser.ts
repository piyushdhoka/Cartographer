
export interface ParsedQuery {
    intent: string;
    target: string;
    confidence: number;
}

export class QueryParser {

    parse(question: string): ParsedQuery | null {
        const normalized = question.toLowerCase().trim();

        // 1. Dependencies / Imports
        // "dependencies of file.ts", "what does file.ts import", "imports in file.ts"
        const depMatch = normalized.match(/(?:dependencies|imports)(?:\s+of|\s+in|\s+for)?\s+([a-zA-Z0-9_\-\.\/]+)/) ||
            normalized.match(/what does\s+([a-zA-Z0-9_\-\.\/]+)\s+import/);
        if (depMatch) {
            return {
                intent: 'DEPENDENCIES',
                target: depMatch[1],
                confidence: 0.9
            };
        }

        // 2. Usages / Callers
        // "who calls function", "usage of function", "where is function used"
        const usageMatch = normalized.match(/(?:who calls|usage of|callers of|references to)\s+([a-zA-Z0-9_\-\.\/]+)/) ||
            normalized.match(/where is\s+([a-zA-Z0-9_\-\.\/]+)\s+used/);
        if (usageMatch) {
            return {
                intent: 'USAGE',
                target: usageMatch[1],
                confidence: 0.9
            };
        }

        // 3. History / Evolution
        // "history of file.ts", "changes in file.ts", "who touched file.ts"
        const historyMatch = normalized.match(/(?:history|changes|commits|evolution)(?:\s+of|\s+in|\s+for)?\s+([a-zA-Z0-9_\-\.\/]+)/) ||
            normalized.match(/who touched\s+([a-zA-Z0-9_\-\.\/]+)/);
        if (historyMatch) {
            return {
                intent: 'HISTORY',
                target: historyMatch[1],
                confidence: 0.9
            };
        }

        // 4. Risks / Issues
        // "risks in file.ts", "issues in file.ts", "problems with file.ts"
        const riskMatch = normalized.match(/(?:risks|issues|problems|vulnerabilities)(?:\s+of|\s+in|\s+with)?\s+([a-zA-Z0-9_\-\.\/]+)/);
        if (riskMatch) {
            return {
                intent: 'RISKS',
                target: riskMatch[1],
                confidence: 0.9
            };
        }

        // 5. Complexity / Explanation (Translator)
        // "explain file.ts", "complexity of file.ts", "document file.ts"
        const explainMatch = normalized.match(/(?:explain|document|describe|complexity of)\s+([a-zA-Z0-9_\-\.\/]+)/);
        if (explainMatch) {
            return {
                intent: 'EXPLAIN',
                target: explainMatch[1],
                confidence: 0.9
            };
        }

        return null;
    }
}
