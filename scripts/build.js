import { execSync } from 'child_process';
import { cpSync } from 'fs';

try {
  // Run vite build
  console.log('Building frontend with Vite...');
  execSync('vite build', { stdio: 'inherit' });

  // Run esbuild for server
  console.log('Building server with esbuild...');
  execSync('esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { stdio: 'inherit' });

  // Copy email templates
  console.log('Copying email templates...');
  cpSync('server/email-templates', 'dist/email-templates', { recursive: true });

  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
