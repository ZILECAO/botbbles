import { exec } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';

dotenv.config();

const HYPERBOLIC_SSH = process.env.HYPERBOLIC_SSH_STRING;

async function syncToHyperbolic() {
    if (!HYPERBOLIC_SSH) {
        throw new Error('HYPERBOLIC_SSH_STRING not found in .env');
    }

    const projectRoot = process.cwd();
    
    // Create required directories on remote
    console.log('🔄 Creating directories on Hyperbolic...');
    await execCommand(`ssh ${HYPERBOLIC_SSH} "mkdir -p ~/botbbles/src/scripts ~/botbbles/data ~/botbbles/outputs"`);
    
    // Sync required files
    console.log('📤 Syncing files to Hyperbolic...');
    const filesToSync = [
        'src/scripts/unsloth-finetune/finetune.py',
        'data/training_data.jsonl',
        'requirements.txt'
    ];

    // Extract host from SSH string for rsync
    const hostMatch = HYPERBOLIC_SSH.match(/(.*?)(?:\s+-p\s+(\d+))/);
    const rsyncHost = hostMatch ? hostMatch[1] : HYPERBOLIC_SSH;
    const port = hostMatch ? hostMatch[2] : '22';

    for (const file of filesToSync) {
        const localPath = path.join(projectRoot, file);
        try {
            await fs.access(localPath);
            // Use -e "ssh -p PORT" for rsync to specify port
            await execCommand(`rsync -avz -e "ssh -p ${port}" ${localPath} ${rsyncHost}:~/botbbles/${file}`);
            console.log(`✅ Synced ${file}`);
        } catch (error) {
            console.warn(`⚠️ Skipping ${file} - not found`);
        }
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

// Run if called directly
if (require.main === module) {
    syncToHyperbolic().catch(console.error);
}

export { syncToHyperbolic };