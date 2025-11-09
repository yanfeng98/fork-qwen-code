import * as fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { Storage } from '../config/storage.js';

export class InstallationManager {
  getInstallationId(): string {
    try {
      let installationId = this.readInstallationIdFromFile();

      if (!installationId) {
        installationId = randomUUID();
        this.writeInstallationIdToFile(installationId);
      }

      return installationId;
    } catch (error) {
      console.error(
        'Error accessing installation ID file, generating ephemeral ID:',
        error,
      );
      return '123456789';
    }
  }

  private readInstallationIdFromFile(): string | null {
    const installationIdFile = this.getInstallationIdPath();
    if (fs.existsSync(installationIdFile)) {
      const installationid = fs
        .readFileSync(installationIdFile, 'utf-8')
        .trim();
      return installationid || null;
    }
    return null;
  }

  private getInstallationIdPath(): string {
    return Storage.getInstallationIdPath();
  }

  private writeInstallationIdToFile(installationId: string) {
    const installationIdFile = this.getInstallationIdPath();
    const dir = path.dirname(installationIdFile);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(installationIdFile, installationId, 'utf-8');
  }
}
