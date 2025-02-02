import { exec } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';
import { syncFromHyperbolic, syncToHyperbolic } from '../../plugins/hyperbolicPlugin/syncToHyperbolic';

dotenv.config();

const HYPERBOLIC_SSH = process.env.HYPERBOLIC_SSH_STRING;

export async function runRemoteFinetune() {
    if (!HYPERBOLIC_SSH) {
        throw new Error('HYPERBOLIC_SSH_STRING not found in .env');
    }

    try {
        // Install rsync on remote machine
        console.log('🔧 Installing required tools on remote...');
        await execCommand(`ssh ${HYPERBOLIC_SSH} "sudo apt-get update && sudo apt-get install -y rsync python3-pip python3-venv"`);

        // First sync files
        console.log('🔄 Syncing files to Hyperbolic...');
        await syncToHyperbolic();

        // Create correct directory structure and move files
        console.log('📁 Setting up directory structure...');
        const setupDirsCmd = `ssh ${HYPERBOLIC_SSH} "\
            mkdir -p ~/botbbles/src/scripts/unsloth-finetune && \
            mkdir -p ~/botbbles/data && \
            mkdir -p ~/botbbles/outputs && \
            mv ~/botbbles/src/scripts/finetune.py ~/botbbles/src/scripts/unsloth-finetune/ || true"`;
        
        await execCommand(setupDirsCmd);

        // Set up Python environment and run fine-tuning
        console.log('🚀 Setting up environment and running fine-tuning...');
        const setupAndRunCmd = `ssh ${HYPERBOLIC_SSH} "\
            cd ~/botbbles && \
            python3 -m venv venv && \
            source venv/bin/activate && \
            pip install --upgrade pip && \
            pip install -r requirements.txt && \
            python3 src/scripts/unsloth-finetune/finetune.py"`;

        const result = await execCommand(setupAndRunCmd);
        console.log('Fine-tuning output:', result);

        // Download results
        console.log('📥 Downloading results...');
        await syncFromHyperbolic();

        console.log('✨ Fine-tuning complete!');
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

function execCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Command failed:', command);
                console.error('Error:', stderr);
                reject(error);
                return;
            }
            console.log(stdout);
            resolve(stdout);
        });
    });
}

// Run if called directly
if (require.main === module) {
    runRemoteFinetune().catch(console.error);
}