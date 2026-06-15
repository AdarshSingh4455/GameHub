import { spawn } from 'child_process';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node run_with_timeout.mjs <command> [args...]');
  process.exit(1);
}

const command = args[0];
const cmdArgs = args.slice(1);

console.log(`[HANG PROTECTION] Running: ${command} ${cmdArgs.join(' ')}`);

const child = spawn(command, cmdArgs, {
  shell: true,
  stdio: 'inherit'
});

const TIMEOUT_MS = 120000; // 120 seconds
let finished = false;

const timeout = setTimeout(() => {
  if (finished) return;
  console.error(`\n[HANG PROTECTION] WARNING: Command timed out after ${TIMEOUT_MS / 1000} seconds!`);
  
  // Capture diagnostics
  console.log('\n=== HANG DIAGNOSTICS ===');
  try {
    console.log('--- Network Port Listeners ---');
    const netstat = execSync('netstat -ano | findstr LISTENING', { encoding: 'utf8' });
    console.log(netstat);
  } catch (e) {
    console.log('Could not get netstat output:', e.message);
  }

  try {
    console.log('--- Running Processes (Node/Chrome) ---');
    const tasklist = execSync('tasklist | findstr /I "node chrome msedge"', { encoding: 'utf8' });
    console.log(tasklist);
  } catch (e) {
    console.log('Could not get tasklist:', e.message);
  }

  // Kill the process tree on Windows
  console.log(`[HANG PROTECTION] Terminating process tree for PID ${child.pid}...`);
  try {
    execSync(`taskkill /F /T /PID ${child.pid}`);
  } catch (e) {
    console.log('Could not taskkill process:', e.message);
    try {
      child.kill('SIGKILL');
    } catch (e2) {
      console.log('Could not SIGKILL process:', e2.message);
    }
  }

  process.exit(124); // Standard timeout exit code
}, TIMEOUT_MS);

child.on('exit', (code, signal) => {
  finished = true;
  clearTimeout(timeout);
  if (signal) {
    console.log(`[HANG PROTECTION] Process terminated by signal: ${signal}`);
    process.exit(1);
  } else {
    console.log(`[HANG PROTECTION] Process exited with code: ${code}`);
    process.exit(code ?? 0);
  }
});
