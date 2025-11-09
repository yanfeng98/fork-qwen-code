import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';

export const QWEN_DIR = '.qwen';
export const GOOGLE_ACCOUNTS_FILENAME = 'google_accounts.json';
export const OAUTH_FILE = 'oauth_creds.json';
const TMP_DIR_NAME = 'tmp';
const BIN_DIR_NAME = 'bin';

export class Storage {
  private readonly targetDir: string;

  constructor(targetDir: string) {
    this.targetDir = targetDir;
  }

  getWorkspaceSettingsPath(): string {
    return path.join(this.getQwenDir(), 'settings.json');
  }

  getQwenDir(): string {
    return path.join(this.targetDir, QWEN_DIR);
  }

  static getGlobalSettingsPath(): string {
    return path.join(Storage.getGlobalQwenDir(), 'settings.json');
  }

  static getGlobalQwenDir(): string {
    const homeDir = os.homedir();
    if (!homeDir) {
      return path.join(os.tmpdir(), '.qwen');
    }
    return path.join(homeDir, QWEN_DIR);
  }

  getExtensionsDir(): string {
    return path.join(this.getQwenDir(), 'extensions');
  }

  getProjectTempDir(): string {
    const hash = this.getFilePathHash(this.getProjectRoot());
    const tempDir = Storage.getGlobalTempDir();
    return path.join(tempDir, hash);
  }

  getProjectRoot(): string {
    return this.targetDir;
  }

  private getFilePathHash(filePath: string): string {
    return crypto.createHash('sha256').update(filePath).digest('hex');
  }

  static getGlobalTempDir(): string {
    return path.join(Storage.getGlobalQwenDir(), TMP_DIR_NAME);
  }

  static getInstallationIdPath(): string {
    return path.join(Storage.getGlobalQwenDir(), 'installation_id');
  }

  static getMcpOAuthTokensPath(): string {
    return path.join(Storage.getGlobalQwenDir(), 'mcp-oauth-tokens.json');
  }

  static getGoogleAccountsPath(): string {
    return path.join(Storage.getGlobalQwenDir(), GOOGLE_ACCOUNTS_FILENAME);
  }

  static getUserCommandsDir(): string {
    return path.join(Storage.getGlobalQwenDir(), 'commands');
  }

  static getGlobalMemoryFilePath(): string {
    return path.join(Storage.getGlobalQwenDir(), 'memory.md');
  }

  static getGlobalBinDir(): string {
    return path.join(Storage.getGlobalQwenDir(), BIN_DIR_NAME);
  }

  ensureProjectTempDirExists(): void {
    fs.mkdirSync(this.getProjectTempDir(), { recursive: true });
  }

  static getOAuthCredsPath(): string {
    return path.join(Storage.getGlobalQwenDir(), OAUTH_FILE);
  }

  getHistoryDir(): string {
    const hash = this.getFilePathHash(this.getProjectRoot());
    const historyDir = path.join(Storage.getGlobalQwenDir(), 'history');
    return path.join(historyDir, hash);
  }

  getProjectCommandsDir(): string {
    return path.join(this.getQwenDir(), 'commands');
  }

  getProjectTempCheckpointsDir(): string {
    return path.join(this.getProjectTempDir(), 'checkpoints');
  }

  getExtensionsConfigPath(): string {
    return path.join(this.getExtensionsDir(), 'qwen-extension.json');
  }

  getHistoryFilePath(): string {
    return path.join(this.getProjectTempDir(), 'shell_history');
  }
}
