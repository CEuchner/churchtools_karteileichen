#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Read package.json for project info
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const projectName = packageJson.name;
const version = packageJson.version;

// Get git commit hash (short)
let gitHash = '';
try {
    gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch (error) {
    console.warn('Warning: Could not get git hash, using timestamp');
    gitHash = Date.now().toString(36);
}

// Create releases directory
const releasesDir = path.join(rootDir, 'releases');
if (!fs.existsSync(releasesDir)) {
    fs.mkdirSync(releasesDir, { recursive: true });
}

// Define archive name
const archiveName = `${projectName}-v${version}-${gitHash}.zip`;
const archivePath = path.join(releasesDir, archiveName);

console.log('📦 Creating ChurchTools extension package...');
console.log(`   Project: ${projectName}`);
console.log(`   Version: ${version}`);
console.log(`   Git Hash: ${gitHash}`);
console.log(`   Archive: ${archiveName}`);

// Check if dist directory exists
const distDir = path.join(rootDir, 'dist');
if (!fs.existsSync(distDir)) {
    console.error('❌ Error: dist directory not found. Run "npm run build" first.');
    process.exit(1);
}

try {
    // Create ZIP archive using archiver (cross-platform)
    const output = fs.createWriteStream(archivePath);
    const archive = archiver('zip', {
        zlib: { level: 9 } // compression level
    });

    // Listen for all archive data to be written
    output.on('close', () => {
        console.log('✅ Package created successfully!');
        console.log(`📁 Location: ${archivePath}`);
        console.log('');
        console.log('🚀 Next steps:');
        console.log('   1. Upload the ZIP file to your ChurchTools instance');
        console.log('   2. Go to Admin → Extensions → Upload Extension');
        console.log('   3. Select the ZIP file and install');
        console.log('');
        
        // Show file size
        const stats = fs.statSync(archivePath);
        const fileSizeInBytes = stats.size;
        const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
        console.log(`📊 Package size: ${fileSizeInMB} MB`);
    });

    // Handle errors
    archive.on('error', (err) => {
        console.error('❌ Error creating package:', err.message);
        process.exit(1);
    });

    output.on('error', (err) => {
        console.error('❌ Error writing package:', err.message);
        process.exit(1);
    });

    // Pipe archive data to the file
    archive.pipe(output);

    // Add dist directory to archive, excluding source maps and system files
    archive.directory(distDir, 'dist');

    // Finalize the archive
    archive.finalize();
    
} catch (error) {
    console.error('❌ Error creating package:', error.message);
    process.exit(1);
}