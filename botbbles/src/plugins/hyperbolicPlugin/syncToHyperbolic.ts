import { exec } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';
import * as fs from 'fs/promises';
import util from 'util';

dotenv.config();

const HYPERBOLIC_SSH = process.env.HYPERBOLIC_SSH_STRING;

const execAsync = util.promisify(exec);

async function syncToHyperbolic() {
    try {
        console.log('🔄 Creating directories on Hyperbolic...');
        await execAsync(`ssh ${HYPERBOLIC_SSH} "mkdir -p /home/ubuntu/botbbles/src/scripts/unsloth-finetune"`);

        console.log('📤 Syncing files to Hyperbolic...');
        
        // Sync all necessary files for inference
        const filesToSync = [
            'src/scripts/unsloth-finetune/runRemoteInference.py',
            'src/scripts/unsloth-finetune/finetune.py',
            'requirements.txt',
            'data/training_data.jsonl'
        ];

        for (const file of filesToSync) {
            const rsyncCommand = `rsync -avz -e "ssh -p 31424" ${file} ${HYPERBOLIC_SSH?.split(' ')[0]}:/home/ubuntu/botbbles/${file}`;
            console.log(`Syncing ${file}...`);
            const { stdout, stderr } = await execAsync(rsyncCommand);
            if (stderr && !stderr.includes('speedup is')) {
                console.error(`⚠️ Warning syncing ${file}:`, stderr);
            }
            console.log(`✅ Synced ${file}`);
        }

        // Install Python dependencies on Hyperbolic
        console.log('📦 Installing Python dependencies...');
        await execAsync(`ssh ${HYPERBOLIC_SSH} "cd /home/ubuntu/botbbles && pip3 install -r requirements.txt"`);
        console.log('✅ Dependencies installed');

        return true;
    } catch (error) {
        console.error('❌ Error syncing to Hyperbolic:', error);
        throw error;
    }
}

async function downloadFineTunedModel() {
    try {
        const remotePath = '/home/ubuntu/botbbles/finetuned_model/';
        const localPath = path.resolve(process.cwd(), 'finetuned_model');

        console.log('📥 Creating local model directory...');
        await execAsync(`mkdir -p ${localPath}`);

        console.log('📥 Downloading model files from Hyperbolic...');
        const rsyncCommand = `rsync -avz -e "ssh -p 31424" ${HYPERBOLIC_SSH?.split(' ')[0]}:${remotePath}* ${localPath}/`;
        
        const { stdout, stderr } = await execAsync(rsyncCommand);
        if (stderr && !stderr.includes('speedup is')) {
            console.error('⚠️ Rsync stderr:', stderr);
        }

        return true;
    } catch (error) {
        console.error('❌ Error downloading model:', error);
        throw error;
    }
}

function execCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Error:', stderr);
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
}

// Export the function to be called after fine-tuning
export async function syncFromHyperbolic() {
    console.log('🔄 Syncing files from Hyperbolic...');
    await downloadFineTunedModel();
}

// If running directly, execute based on command
if (require.main === module) {
    const command = process.argv[2];
    
    if (command === 'download') {
        console.log('🔄 Starting model download from Hyperbolic...');
        downloadFineTunedModel()
            .then(() => console.log('✅ Model download complete'))
            .catch(console.error);
    } else if (command === 'syncTo') {
        console.log('🔄 Starting sync to Hyperbolic...');
        syncToHyperbolic()
            .then(() => console.log('✅ Sync to Hyperbolic complete'))
            .catch(console.error);
    } else {
        console.error('❌ Please specify either "download" or "syncTo"');
    }
}

export { downloadFineTunedModel, syncToHyperbolic };