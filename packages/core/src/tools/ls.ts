import fs from 'node:fs/promises';
import path from 'node:path';
import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { makeRelative, shortenPath } from '../utils/paths.js';
import { isSubpath } from '../utils/paths.js';
import type { Config } from '../config/config.js';
import { DEFAULT_FILE_FILTERING_OPTIONS } from '../config/constants.js';
import { ToolErrorType } from './tool-error.js';
import { ToolDisplayNames, ToolNames } from './tool-names.js';

export interface LSToolParams {
  path: string;
  ignore?: string[];
  file_filtering_options?: {
    respect_git_ignore?: boolean;
    respect_qwen_ignore?: boolean;
  };
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedTime: Date;
}

class LSToolInvocation extends BaseToolInvocation<LSToolParams, ToolResult> {
  constructor(
    private readonly config: Config,
    params: LSToolParams,
  ) {
    super(params);
  }

  private shouldIgnore(filename: string, patterns?: string[]): boolean {
    if (!patterns || patterns.length === 0) {
      return false;
    }
    for (const pattern of patterns) {
      const regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(filename)) {
        return true;
      }
    }
    return false;
  }

  getDescription(): string {
    const relativePath = makeRelative(
      this.params.path,
      this.config.getTargetDir(),
    );
    return shortenPath(relativePath);
  }

  private errorResult(
    llmContent: string,
    returnDisplay: string,
    type: ToolErrorType,
  ): ToolResult {
    return {
      llmContent,
      returnDisplay: `Error: ${returnDisplay}`,
      error: {
        message: llmContent,
        type,
      },
    };
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      const stats = await fs.stat(this.params.path);
      if (!stats) {
        return this.errorResult(
          `Error: Directory not found or inaccessible: ${this.params.path}`,
          `Directory not found or inaccessible.`,
          ToolErrorType.FILE_NOT_FOUND,
        );
      }
      if (!stats.isDirectory()) {
        return this.errorResult(
          `Error: Path is not a directory: ${this.params.path}`,
          `Path is not a directory.`,
          ToolErrorType.PATH_IS_NOT_A_DIRECTORY,
        );
      }

      const files = await fs.readdir(this.params.path);
      if (files.length === 0) {
        return {
          llmContent: `Directory ${this.params.path} is empty.`,
          returnDisplay: `Directory is empty.`,
        };
      }

      const relativePaths = files.map((file) =>
        path.relative(
          this.config.getTargetDir(),
          path.join(this.params.path, file),
        ),
      );

      const fileDiscovery = this.config.getFileService();
      const { filteredPaths, gitIgnoredCount, qwenIgnoredCount } =
        fileDiscovery.filterFilesWithReport(relativePaths, {
          respectGitIgnore:
            this.params.file_filtering_options?.respect_git_ignore ??
            this.config.getFileFilteringOptions().respectGitIgnore ??
            DEFAULT_FILE_FILTERING_OPTIONS.respectGitIgnore,
          respectQwenIgnore:
            this.params.file_filtering_options?.respect_qwen_ignore ??
            this.config.getFileFilteringOptions().respectQwenIgnore ??
            DEFAULT_FILE_FILTERING_OPTIONS.respectQwenIgnore,
        });

      const entries = [];
      for (const relativePath of filteredPaths) {
        const fullPath = path.resolve(this.config.getTargetDir(), relativePath);

        if (this.shouldIgnore(path.basename(fullPath), this.params.ignore)) {
          continue;
        }

        try {
          const stats = await fs.stat(fullPath);
          const isDir = stats.isDirectory();
          entries.push({
            name: path.basename(fullPath),
            path: fullPath,
            isDirectory: isDir,
            size: isDir ? 0 : stats.size,
            modifiedTime: stats.mtime,
          });
        } catch (error) {
          console.error(`Error accessing ${fullPath}: ${error}`);
        }
      }

      entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      const directoryContent = entries
        .map((entry) => `${entry.isDirectory ? '[DIR] ' : ''}${entry.name}`)
        .join('\n');

      let resultMessage = `Directory listing for ${this.params.path}:\n${directoryContent}`;
      const ignoredMessages = [];
      if (gitIgnoredCount > 0) {
        ignoredMessages.push(`${gitIgnoredCount} git-ignored`);
      }
      if (qwenIgnoredCount > 0) {
        ignoredMessages.push(`${qwenIgnoredCount} qwen-ignored`);
      }
      if (ignoredMessages.length > 0) {
        resultMessage += `\n\n(${ignoredMessages.join(', ')})`;
      }

      let displayMessage = `Listed ${entries.length} item(s).`;
      if (ignoredMessages.length > 0) {
        displayMessage += ` (${ignoredMessages.join(', ')})`;
      }

      return {
        llmContent: resultMessage,
        returnDisplay: displayMessage,
      };
    } catch (error) {
      const errorMsg = `Error listing directory: ${error instanceof Error ? error.message : String(error)}`;
      return this.errorResult(
        errorMsg,
        'Failed to list directory.',
        ToolErrorType.LS_EXECUTION_ERROR,
      );
    }
  }
}

export class LSTool extends BaseDeclarativeTool<LSToolParams, ToolResult> {
  static readonly Name = ToolNames.LS;

  constructor(private config: Config) {
    super(
      LSTool.Name,
      ToolDisplayNames.LS,
      'Lists the names of files and subdirectories directly within a specified directory path. Can optionally ignore entries matching provided glob patterns.',
      Kind.Search,
      {
        properties: {
          path: {
            description:
              'The absolute path to the directory to list (must be absolute, not relative)',
            type: 'string',
          },
          ignore: {
            description: 'List of glob patterns to ignore',
            items: {
              type: 'string',
            },
            type: 'array',
          },
          file_filtering_options: {
            description:
              'Optional: Whether to respect ignore patterns from .gitignore or .qwenignore',
            type: 'object',
            properties: {
              respect_git_ignore: {
                description:
                  'Optional: Whether to respect .gitignore patterns when listing files. Only available in git repositories. Defaults to true.',
                type: 'boolean',
              },
              respect_qwen_ignore: {
                description:
                  'Optional: Whether to respect .qwenignore patterns when listing files. Defaults to true.',
                type: 'boolean',
              },
            },
          },
        },
        required: ['path'],
        type: 'object',
      },
    );
  }

  protected override validateToolParamValues(
    params: LSToolParams,
  ): string | null {
    if (!path.isAbsolute(params.path)) {
      return `Path must be absolute: ${params.path}`;
    }

    const userSkillsBase = this.config.storage.getUserSkillsDir();
    const isUnderUserSkills = isSubpath(userSkillsBase, params.path);

    const workspaceContext = this.config.getWorkspaceContext();
    if (
      !workspaceContext.isPathWithinWorkspace(params.path) &&
      !isUnderUserSkills
    ) {
      const directories = workspaceContext.getDirectories();
      return `Path must be within one of the workspace directories: ${directories.join(
        ', ',
      )}`;
    }
    return null;
  }

  protected createInvocation(
    params: LSToolParams,
  ): ToolInvocation<LSToolParams, ToolResult> {
    return new LSToolInvocation(this.config, params);
  }
}
