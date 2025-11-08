import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { FileDiscoveryService } from '../services/fileDiscoveryService.js';
import type { FileFilteringOptions } from '../config/constants.js';
// Simple console logger for now.
// TODO: Integrate with a more robust server-side logger.
const logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: (...args: any[]) => console.debug('[DEBUG] [BfsFileSearch]', ...args),
};

interface BfsFileSearchOptions {
  fileName: string;
  ignoreDirs?: string[];
  maxDirs?: number;
  debug?: boolean;
  fileService?: FileDiscoveryService;
  fileFilteringOptions?: FileFilteringOptions;
}

export async function bfsFileSearch(
  rootDir: string,
  options: BfsFileSearchOptions,
): Promise<string[]> {
  const {
    fileName,
    ignoreDirs = [],
    maxDirs = Infinity,
    debug = false,
    fileService,
  } = options;
  const foundFiles: string[] = [];
  const queue: string[] = [rootDir];
  const visited = new Set<string>();
  let scannedDirCount = 0;
  let queueHead = 0;

  const ignoreDirsSet = new Set(ignoreDirs);
  const PARALLEL_BATCH_SIZE = 15;

  while (queueHead < queue.length && scannedDirCount < maxDirs) {
    const batchSize = Math.min(PARALLEL_BATCH_SIZE, maxDirs - scannedDirCount);
    const currentBatch = [];
    while (currentBatch.length < batchSize && queueHead < queue.length) {
      const currentDir = queue[queueHead];
      queueHead++;
      if (!visited.has(currentDir)) {
        visited.add(currentDir);
        currentBatch.push(currentDir);
      }
    }
    scannedDirCount += currentBatch.length;

    if (currentBatch.length === 0) continue;

    if (debug) {
      logger.debug(
        `Scanning [${scannedDirCount}/${maxDirs}]: batch of ${currentBatch.length}`,
      );
    }

    const readPromises = currentBatch.map(async (currentDir) => {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        return { currentDir, entries };
      } catch (error) {
        const message = (error as Error)?.message ?? 'Unknown error';
        console.warn(
          `[WARN] Skipping unreadable directory: ${currentDir} (${message})`,
        );
        if (debug) {
          logger.debug(`Full error for ${currentDir}:`, error);
        }
        return { currentDir, entries: [] };
      }
    });

    const results = await Promise.all(readPromises);

    for (const { currentDir, entries } of results) {
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const isDirectory = entry.isDirectory();
        const isMatchingFile = entry.isFile() && entry.name === fileName;

        if (!isDirectory && !isMatchingFile) {
          continue;
        }
        if (isDirectory && ignoreDirsSet.has(entry.name)) {
          continue;
        }

        if (
          fileService?.shouldIgnoreFile(fullPath, {
            respectGitIgnore: options.fileFilteringOptions?.respectGitIgnore,
            respectQwenIgnore: options.fileFilteringOptions?.respectQwenIgnore,
          })
        ) {
          continue;
        }

        if (isDirectory) {
          queue.push(fullPath);
        } else {
          foundFiles.push(fullPath);
        }
      }
    }
  }

  return foundFiles;
}
