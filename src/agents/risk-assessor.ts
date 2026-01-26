import * as fs from 'fs/promises';
import { Agent } from './base/agent';
import { KnowledgeBase } from '../knowledge/knowledge-base';
import { WorkspaceMetadata } from './archaeologist';

export interface RiskFinding {
    file: string;
    line: number;
    type: 'SECURITY' | 'TECH_DEBT' | 'COMPLEXITY';
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class RiskAssessorAgent extends Agent {

    constructor(knowledgeBase: KnowledgeBase) {
        super({
            name: 'risk-assessor',
            priority: 3 // Runs after basic mapping
        }, knowledgeBase);
    }

    async explore(workspacePath: string): Promise<void> {
        this.log('Starting risk assessment...');

        const archaeologistData = this.knowledgeBase.get('archaeologist') as WorkspaceMetadata;
        if (!archaeologistData || !archaeologistData.files) {
            this.log('No files to analyze. Aborting.');
            return;
        }

        const risks: RiskFinding[] = [];

        for (const file of archaeologistData.files) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const fileRisks = this.analyzeFile(file, content);
                risks.push(...fileRisks);
            } catch (error) {
                console.warn(`Failed to analyze ${file} for risks:`, error);
            }
        }

        this.knowledgeBase.store(this.name, risks);
        this.log(`Risk assessment complete. Found ${risks.length} issues.`);
    }

    private analyzeFile(filePath: string, content: string): RiskFinding[] {
        const risks: RiskFinding[] = [];
        const lines = content.split('\n');

        // Security Patterns (Regex)
        const securityPatterns = [
            { regex: /api_key\s*=\s*['"][a-zA-Z0-9]{20,}['"]/i, msg: 'Potential hardcoded API key' },
            { regex: /password\s*=\s*['"][^'"]{3,}['"]/i, msg: 'Potential hardcoded password' },
            { regex: /secret\s*=\s*['"][^'"]{3,}['"]/i, msg: 'Potential hardcoded secret' }
        ];

        // Tech Debt Patterns
        const debtPatterns = [
            { regex: /\/\/.*TODO/, msg: 'TODO comment found' },
            { regex: /\/\/.*FIXME/, msg: 'FIXME comment found' },
            { regex: /console\.log/, msg: 'Console log found (production risk)' }
        ];

        lines.forEach((line, index) => {
            const lineNum = index + 1;

            // Check Security
            for (const pattern of securityPatterns) {
                if (pattern.regex.test(line)) {
                    risks.push({
                        file: filePath,
                        line: lineNum,
                        type: 'SECURITY',
                        message: pattern.msg,
                        severity: 'HIGH'
                    });
                }
            }

            // Check Debt
            for (const pattern of debtPatterns) {
                if (pattern.regex.test(line)) {
                    risks.push({
                        file: filePath,
                        line: lineNum,
                        type: 'TECH_DEBT',
                        message: pattern.msg,
                        severity: 'LOW'
                    });
                }
            }
        });

        // Simple Complexity Check (File length)
        if (lines.length > 500) {
            risks.push({
                file: filePath,
                line: 0,
                type: 'COMPLEXITY',
                message: `File is too long (${lines.length} lines)`,
                severity: 'MEDIUM'
            });
        }

        return risks;
    }
}
