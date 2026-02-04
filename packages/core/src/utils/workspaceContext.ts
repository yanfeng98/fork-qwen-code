import { isNodeError } from '../utils/errors.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';

export type Unsubscribe = () => void;

export class WorkspaceContext {
  private directories = new Set<string>();
  private initialDirectories: Set<string>;
  private onDirectoriesChangedListeners = new Set<() => void>();

  constructor(directory: string, additionalDirectories: string[] = []) {
    this.addDirectory(directory);
    for (const additionalDirectory of additionalDirectories) {
      this.addDirectory(additionalDirectory);
    }
    this.initialDirectories = new Set(this.directories);
  }

  /**
   * Registers a listener that is called when the workspace directories change.
   * @param listener The listener to call.
   * @returns A function to unsubscribe the listener.
   */
  onDirectoriesChanged(listener: () => void): Unsubscribe {
    this.onDirectoriesChangedListeners.add(listener);
    return () => {
      this.onDirectoriesChangedListeners.delete(listener);
    };
  }

  private notifyDirectoriesChanged() {
    // Iterate over a copy of the set in case a listener unsubscribes itself or others.
    for (const listener of [...this.onDirectoriesChangedListeners]) {
      try {
        listener();
      } catch (e) {
        // Don't let one listener break others.
        console.error('Error in WorkspaceContext listener:', e);
      }
    }
  }

  addDirectory(directory: string, basePath: string = process.cwd()): void {
    try {
      const resolved = this.resolveAndValidateDir(directory, basePath);
      if (this.directories.has(resolved)) {
        return;
      }
      this.directories.add(resolved);
      this.notifyDirectoriesChanged();
    } catch (err) {
      console.warn(
        `[WARN] Skipping unreadable directory: ${directory} (${err instanceof Error ? err.message : String(err)})`,
      );
    }
  }

  private resolveAndValidateDir(
    directory: string,
    basePath: string = process.cwd(),
  ): string {
    const absolutePath = path.isAbsolute(directory)
      ? directory
      : path.resolve(basePath, directory);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Directory does not exist: ${absolutePath}`);
    }
    const stats = fs.statSync(absolutePath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${absolutePath}`);
    }

    return fs.realpathSync(absolutePath);
  }

  getDirectories(): readonly string[] {
    return Array.from(this.directories);
  }

  getInitialDirectories(): readonly string[] {
    return Array.from(this.initialDirectories);
  }

  setDirectories(directories: readonly string[]): void {
    const newDirectories = new Set<string>();
    for (const dir of directories) {
      newDirectories.add(this.resolveAndValidateDir(dir));
    }

    if (
      newDirectories.size !== this.directories.size ||
      ![...newDirectories].every((d) => this.directories.has(d))
    ) {
      this.directories = newDirectories;
      this.notifyDirectoriesChanged();
    }
  }

  isPathWithinWorkspace(pathToCheck: string): boolean {
    try {
      const fullyResolvedPath = this.fullyResolvedPath(pathToCheck);

      for (const dir of this.directories) {
        if (this.isPathWithinRoot(fullyResolvedPath, dir)) {
          return true;
        }
      }
      return false;
    } catch (_error) {
      return false;
    }
  }

  private fullyResolvedPath(pathToCheck: string): string {
    try {
      return fs.realpathSync(pathToCheck);
    } catch (e: unknown) {
      if (
        isNodeError(e) &&
        e.code === 'ENOENT' &&
        e.path &&
        !this.isFileSymlink(e.path)
      ) {
        return e.path;
      }
      throw e;
    }
  }

  private isPathWithinRoot(
    pathToCheck: string,
    rootDirectory: string,
  ): boolean {
    const relative = path.relative(rootDirectory, pathToCheck);
    return (
      !relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative)
    );
  }

  /**
   * Checks if a file path is a symbolic link that points to a file.
   */
  private isFileSymlink(filePath: string): boolean {
    try {
      return !fs.readlinkSync(filePath).endsWith('/');
    } catch (_error) {
      return false;
    }
  }
}
