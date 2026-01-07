/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tool for migrating TOML commands to Markdown format.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { convertTomlToMarkdown } from './toml-to-markdown-converter.js';

export interface MigrationResult {
  success: boolean;
  convertedFiles: string[];
  failedFiles: Array<{ file: string; error: string }>;
}

export interface MigrationOptions {
  /** Directory containing command files */
  commandDir: string;
  /** Whether to create backups (default: true) */
  createBackup?: boolean;
  /** Whether to delete original TOML files after migration (default: false) */
  deleteOriginal?: boolean;
}

/**
 * Scans a directory for TOML command files.
 * @param commandDir Directory to scan
 * @returns Array of TOML file paths (relative to commandDir)
 */
export async function detectTomlCommands(
  commandDir: string,
): Promise<string[]> {
  try {
    await fs.access(commandDir);
  } catch {
    // Directory doesn't exist
    return [];
  }

  const tomlFiles = await glob('**/*.toml', {
    cwd: commandDir,
    nodir: true,
    dot: false,
  });

  return tomlFiles;
}

/**
 * Migrates TOML command files to Markdown format.
 * @param options Migration options
 * @returns Migration result with details
 */
export async function migrateTomlCommands(
  options: MigrationOptions,
): Promise<MigrationResult> {
  const { commandDir, createBackup = true, deleteOriginal = false } = options;

  const result: MigrationResult = {
    success: true,
    convertedFiles: [],
    failedFiles: [],
  };

  // Detect TOML files
  const tomlFiles = await detectTomlCommands(commandDir);

  if (tomlFiles.length === 0) {
    return result;
  }

  // Process each TOML file
  for (const relativeFile of tomlFiles) {
    const tomlPath = path.join(commandDir, relativeFile);

    try {
      // Read TOML file
      const tomlContent = await fs.readFile(tomlPath, 'utf-8');

      // Convert to Markdown
      const markdownContent = convertTomlToMarkdown(tomlContent);

      // Generate Markdown file path (same location, .md extension)
      const markdownPath = tomlPath.replace(/\.toml$/, '.md');

      // Check if Markdown file already exists
      try {
        await fs.access(markdownPath);
        throw new Error(
          `Markdown file already exists: ${path.basename(markdownPath)}`,
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
        // File doesn't exist, continue
      }

      // Write Markdown file
      await fs.writeFile(markdownPath, markdownContent, 'utf-8');

      // Backup original if requested (rename to .toml.backup)
      if (createBackup) {
        const backupPath = `${tomlPath}.backup`;
        await fs.rename(tomlPath, backupPath);
      } else if (deleteOriginal) {
        // Delete original if requested and no backup
        await fs.unlink(tomlPath);
      }

      result.convertedFiles.push(relativeFile);
    } catch (error) {
      result.success = false;
      result.failedFiles.push({
        file: relativeFile,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

/**
 * Generates a migration report message.
 * @param tomlFiles List of TOML files found
 * @returns Human-readable migration prompt message
 */
export function generateMigrationPrompt(tomlFiles: string[]): string {
  if (tomlFiles.length === 0) {
    return '';
  }

  const count = tomlFiles.length;
  const fileList =
    tomlFiles.length <= 5
      ? tomlFiles.map((f) => `  - ${f}`).join('\n')
      : `  - ${tomlFiles.slice(0, 3).join('\n  - ')}\n  - ... and ${tomlFiles.length - 3} more`;

  return `
⚠️  TOML Command Format Deprecation Notice

Found ${count} command file${count > 1 ? 's' : ''} in TOML format:
${fileList}

The TOML format for commands is being deprecated in favor of Markdown format.
Markdown format is more readable and easier to edit.

You can migrate these files automatically using:
  qwen-code migrate-commands

Or manually convert each file:
  - TOML: prompt = "..." / description = "..."
  - Markdown: YAML frontmatter + content

The migration tool will:
  ✓ Convert TOML files to Markdown
  ✓ Create backups of original files
  ✓ Preserve all command functionality

TOML format will continue to work for now, but migration is recommended.
`.trim();
}
