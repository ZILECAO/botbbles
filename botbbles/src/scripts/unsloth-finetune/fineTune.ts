import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { prepareTrainingData } from './prepareTrainingData';
import { runRemoteFinetune } from './runRemoteFinetune';

export class FineTuningManager {
    private metricsPath: string;

    constructor() {
        this.metricsPath = path.join(process.cwd(), 'outputs', 'metrics.json');
    }

    async shouldFineTune(currentPerformance: number): Promise<boolean> {
        const PERFORMANCE_THRESHOLD = 0.75;
        return currentPerformance < PERFORMANCE_THRESHOLD;
    }

    async triggerFineTuningAfterUpsert(): Promise<void> {
        try {
            // First check if we have training data
            await prepareTrainingData();
            
            // Verify training data exists
            const trainingPath = path.join(process.cwd(), 'data', 'training_data.jsonl');
            try {
                await fs.access(trainingPath);
            } catch (error) {
                console.log('❌ No training data available yet. Skipping fine-tuning.');
                return;
            }

            // Run fine-tuning on Hyperbolic
            console.log('🚀 Starting remote fine-tuning...');
            await runRemoteFinetune();
            
            // Try to read metrics after fine-tuning
            try {
                const metricsJson = await fs.readFile(this.metricsPath, 'utf-8');
                const metrics = JSON.parse(metricsJson);
                console.log('📊 Fine-tuning metrics:', metrics);
            } catch (error) {
                console.log('⚠️ Could not read metrics file, but fine-tuning completed');
            }
        } catch (error) {
            console.error('❌ Fine-tuning failed:', error);
            throw error;
        }
    }
} 