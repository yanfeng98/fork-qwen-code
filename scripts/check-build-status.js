import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const cliPackageDir = path.resolve('packages', 'cli');
const buildTimestampPath = path.join(cliPackageDir, 'dist', '.last_build');
const sourceDirs = [path.join(cliPackageDir, 'src')];
const filesToWatch = [
  path.join(cliPackageDir, 'package.json'),
  path.join(cliPackageDir, 'tsconfig.json'),
];
const buildDir = path.join(cliPackageDir, 'dist');
const warningsFilePath = path.join(os.tmpdir(), 'qwen-code-warnings.txt');

function getMtime(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null; // File doesn't exist
    }
    console.error(`Error getting stats for ${filePath}:`, err);
    process.exit(1);
  }
}

function findSourceFiles(dir, allFiles = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (
      entry.isDirectory() &&
      entry.name !== 'node_modules' &&
      fullPath !== buildDir
    ) {
      findSourceFiles(fullPath, allFiles);
    } else if (entry.isFile()) {
      allFiles.push(fullPath);
    }
  }
  return allFiles;
}

console.log('Checking build status...');

try {
  if (fs.existsSync(warningsFilePath)) {
    fs.unlinkSync(warningsFilePath);
  }
} catch (err) {
  console.warn(
    `[Check Script] Warning: Could not delete previous warnings file: ${err.message}`,
  );
}

const buildMtime = getMtime(buildTimestampPath);
if (!buildMtime) {
  const errorMessage = `ERROR: Build timestamp file (${path.relative(process.cwd(), buildTimestampPath)}) not found. Run \`npm run build\` first.`;
  console.error(errorMessage);
  try {
    fs.writeFileSync(warningsFilePath, errorMessage);
  } catch (writeErr) {
    console.error(
      `[Check Script] Error writing missing build warning file: ${writeErr.message}`,
    );
  }
  process.exit(0);
}

let newerSourceFileFound = false;
const warningMessages = [];
const allSourceFiles = [];

sourceDirs.forEach((dir) => {
  const dirPath = path.resolve(dir);
  if (fs.existsSync(dirPath)) {
    findSourceFiles(dirPath, allSourceFiles);
  } else {
    console.warn(`Warning: Source directory "${dir}" not found.`);
  }
});

filesToWatch.forEach((file) => {
  const filePath = path.resolve(file);
  if (fs.existsSync(filePath)) {
    allSourceFiles.push(filePath);
  } else {
    console.warn(`Warning: Watched file "${file}" not found.`);
  }
});

for (const file of allSourceFiles) {
  const sourceMtime = getMtime(file);
  const relativePath = path.relative(process.cwd(), file);
  const isNewer = sourceMtime && sourceMtime > buildMtime;

  if (isNewer) {
    const warning = `Warning: Source file "${relativePath}" has been modified since the last build.`;
    console.warn(warning);
    warningMessages.push(warning);
    newerSourceFileFound = true;
  }
}

if (newerSourceFileFound) {
  const finalWarning =
    '\nRun "npm run build" to incorporate changes before starting.';
  warningMessages.push(finalWarning);
  console.warn(finalWarning);

  try {
    fs.writeFileSync(warningsFilePath, warningMessages.join('\n'));
  } catch (err) {
    console.error(`[Check Script] Error writing warnings file: ${err.message}`);
  }
} else {
  console.log('Build is up-to-date.');
  try {
    if (fs.existsSync(warningsFilePath)) {
      fs.unlinkSync(warningsFilePath);
    }
  } catch (err) {
    console.warn(
      `[Check Script] Warning: Could not delete previous warnings file: ${err.message}`,
    );
  }
}

process.exit(0);
