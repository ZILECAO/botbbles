import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { prepareTrainingData } from './prepareTrainingData';

interface FineTuningMetrics {
    loss_reduction: number;
    initial_metrics: Record<string, number>;
    final_metrics: Record<string, number>;
}

export class FineTuningManager {
    private metricsPath: string;
    private pythonScriptPath: string;

    constructor() {
        this.metricsPath = path.join(process.cwd(), 'outputs', 'metrics.json');
        this.pythonScriptPath = path.join(process.cwd(), 'scripts', 'finetune.py');
    }

    async runFineTuning(): Promise<FineTuningMetrics> {
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn('python', [this.pythonScriptPath]);

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
                console.log(`Fine-tuning stdout: ${data.toString()}`);
            });

            pythonProcess.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
                console.error(`Fine-tuning stderr: ${data.toString()}`);
            });

            pythonProcess.on('close', async (code) => {
                if (code === 0) {
                    try {
                        const metricsJson = await fs.readFile(this.metricsPath, 'utf-8');
                        const metrics: FineTuningMetrics = JSON.parse(metricsJson);
                        resolve(metrics);
                    } catch (error) {
                        reject(new Error(`Failed to read metrics: ${error}`));
                    }
                } else {
                    reject(new Error(`Fine-tuning failed with code ${code}\nStderr: ${stderr}`));
                }
            });
        });
    }

    async shouldFineTune(currentPerformance: number): Promise<boolean> {
        // Add your logic to determine if fine-tuning is needed
        const PERFORMANCE_THRESHOLD = 0.75;
        return currentPerformance < PERFORMANCE_THRESHOLD;
    }

    async triggerFineTuningAfterUpsert(): Promise<void> {
        try {
            await prepareTrainingData();
            const metrics = await this.runFineTuning();
            console.log('🔄 Post-upsert fine-tuning complete:', metrics);
        } catch (error) {
            console.error('❌ Post-upsert fine-tuning failed:', error);
            throw error;
        }
    }
} 