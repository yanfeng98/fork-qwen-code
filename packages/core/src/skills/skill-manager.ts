import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { parse as parseYaml } from '../utils/yaml-parser.js';
import type {
  SkillConfig,
  SkillLevel,
  ListSkillsOptions,
  SkillValidationResult,
} from './types.js';
import { SkillError, SkillErrorCode } from './types.js';
import type { Config } from '../config/config.js';

const QWEN_CONFIG_DIR = '.qwen';
const SKILLS_CONFIG_DIR = 'skills';
const SKILL_MANIFEST_FILE = 'SKILL.md';

export class SkillManager {
  private skillsCache: Map<SkillLevel, SkillConfig[]> | null = null;
  private readonly changeListeners: Set<() => void> = new Set();
  private parseErrors: Map<string, SkillError> = new Map();

  constructor(private readonly config: Config) {}

  addChangeListener(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  private notifyChangeListeners(): void {
    for (const listener of this.changeListeners) {
      try {
        listener();
      } catch (error) {
        console.warn('Skill change listener threw an error:', error);
      }
    }
  }

  getParseErrors(): Map<string, SkillError> {
    return new Map(this.parseErrors);
  }

  async listSkills(options: ListSkillsOptions = {}): Promise<SkillConfig[]> {
    const skills: SkillConfig[] = [];
    const seenNames = new Set<string>();

    const levelsToCheck: SkillLevel[] = options.level
      ? [options.level]
      : ['project', 'user'];

    const shouldUseCache = !options.force && this.skillsCache !== null;
    if (!shouldUseCache) {
      await this.refreshCache();
    }

    for (const level of levelsToCheck) {
      const levelSkills = this.skillsCache?.get(level) || [];

      for (const skill of levelSkills) {
        if (seenNames.has(skill.name)) {
          continue;
        }

        skills.push(skill);
        seenNames.add(skill.name);
      }
    }

    skills.sort((a, b) => a.name.localeCompare(b.name));

    return skills;
  }

  async loadSkill(
    name: string,
    level?: SkillLevel,
  ): Promise<SkillConfig | null> {
    if (level) {
      return this.findSkillByNameAtLevel(name, level);
    }

    const projectSkill = await this.findSkillByNameAtLevel(name, 'project');
    if (projectSkill) {
      return projectSkill;
    }

    return this.findSkillByNameAtLevel(name, 'user');
  }

  async loadSkillForRuntime(
    name: string,
    level?: SkillLevel,
  ): Promise<SkillConfig | null> {
    const skill = await this.loadSkill(name, level);
    if (!skill) {
      return null;
    }

    return skill;
  }

  validateConfig(config: Partial<SkillConfig>): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof config.name !== 'string') {
      errors.push('Missing or invalid "name" field');
    } else if (config.name.trim() === '') {
      errors.push('"name" cannot be empty');
    }

    if (typeof config.description !== 'string') {
      errors.push('Missing or invalid "description" field');
    } else if (config.description.trim() === '') {
      errors.push('"description" cannot be empty');
    }

    if (config.allowedTools !== undefined) {
      if (!Array.isArray(config.allowedTools)) {
        errors.push('"allowedTools" must be an array');
      } else {
        for (const tool of config.allowedTools) {
          if (typeof tool !== 'string') {
            errors.push('"allowedTools" must contain only strings');
            break;
          }
        }
      }
    }

    if (!config.body || config.body.trim() === '') {
      warnings.push('Skill body is empty');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async refreshCache(): Promise<void> {
    const skillsCache = new Map<SkillLevel, SkillConfig[]>();
    this.parseErrors.clear();

    const levels: SkillLevel[] = ['project', 'user'];

    for (const level of levels) {
      const levelSkills = await this.listSkillsAtLevel(level);
      skillsCache.set(level, levelSkills);
    }

    this.skillsCache = skillsCache;
    this.notifyChangeListeners();
  }

  /**
   * Parses a SKILL.md file and returns the configuration.
   *
   * @param filePath - Path to the SKILL.md file
   * @param level - Storage level
   * @returns SkillConfig
   * @throws SkillError if parsing fails
   */
  parseSkillFile(filePath: string, level: SkillLevel): Promise<SkillConfig> {
    return this.parseSkillFileInternal(filePath, level);
  }

  private async parseSkillFileInternal(
    filePath: string,
    level: SkillLevel,
  ): Promise<SkillConfig> {
    let content: string;

    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      const skillError = new SkillError(
        `Failed to read skill file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        SkillErrorCode.FILE_ERROR,
      );
      this.parseErrors.set(filePath, skillError);
      throw skillError;
    }

    return this.parseSkillContent(content, filePath, level);
  }

  parseSkillContent(
    content: string,
    filePath: string,
    level: SkillLevel,
  ): SkillConfig {
    try {
      const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
      const match = content.match(frontmatterRegex);

      if (!match) {
        throw new Error('Invalid format: missing YAML frontmatter');
      }

      const [, frontmatterYaml, body] = match;
      const frontmatter = parseYaml(frontmatterYaml) as Record<string, unknown>;

      const nameRaw = frontmatter['name'];
      const descriptionRaw = frontmatter['description'];

      if (nameRaw == null || nameRaw === '') {
        throw new Error('Missing "name" in frontmatter');
      }

      if (descriptionRaw == null || descriptionRaw === '') {
        throw new Error('Missing "description" in frontmatter');
      }

      const name = String(nameRaw);
      const description = String(descriptionRaw);
      const allowedToolsRaw = frontmatter['allowedTools'] as
        | unknown[]
        | undefined;
      let allowedTools: string[] | undefined;

      if (allowedToolsRaw !== undefined) {
        if (Array.isArray(allowedToolsRaw)) {
          allowedTools = allowedToolsRaw.map(String);
        } else {
          throw new Error('"allowedTools" must be an array');
        }
      }

      const config: SkillConfig = {
        name,
        description,
        allowedTools,
        level,
        filePath,
        body: body.trim(),
      };

      const validation = this.validateConfig(config);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      return config;
    } catch (error) {
      const skillError = new SkillError(
        `Failed to parse skill file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        SkillErrorCode.PARSE_ERROR,
      );
      this.parseErrors.set(filePath, skillError);
      throw skillError;
    }
  }

  getSkillsBaseDir(level: SkillLevel): string {
    const baseDir =
      level === 'project'
        ? path.join(
            this.config.getProjectRoot(),
            QWEN_CONFIG_DIR,
            SKILLS_CONFIG_DIR,
          )
        : path.join(os.homedir(), QWEN_CONFIG_DIR, SKILLS_CONFIG_DIR);

    return baseDir;
  }

  private async listSkillsAtLevel(level: SkillLevel): Promise<SkillConfig[]> {
    const projectRoot = this.config.getProjectRoot();
    const homeDir = os.homedir();
    const isHomeDirectory = path.resolve(projectRoot) === path.resolve(homeDir);

    if (level === 'project' && isHomeDirectory) {
      return [];
    }

    const baseDir = this.getSkillsBaseDir(level);

    try {
      const entries = await fs.readdir(baseDir, { withFileTypes: true });
      const skills: SkillConfig[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillDir = path.join(baseDir, entry.name);
        const skillManifest = path.join(skillDir, SKILL_MANIFEST_FILE);

        try {
          await fs.access(skillManifest);

          const config = await this.parseSkillFileInternal(
            skillManifest,
            level,
          );
          skills.push(config);
        } catch (error) {
          if (error instanceof SkillError) {
            console.warn(
              `Failed to parse skill at ${skillDir}: ${error.message}`,
            );
          }
          continue;
        }
      }

      return skills;
    } catch (_error) {
      return [];
    }
  }

  private async findSkillByNameAtLevel(
    name: string,
    level: SkillLevel,
  ): Promise<SkillConfig | null> {
    await this.ensureLevelCache(level);

    const levelSkills = this.skillsCache?.get(level) || [];
    return levelSkills.find((skill) => skill.name === name) || null;
  }

  private async ensureLevelCache(level: SkillLevel): Promise<void> {
    if (!this.skillsCache) {
      this.skillsCache = new Map<SkillLevel, SkillConfig[]>();
    }

    if (!this.skillsCache.has(level)) {
      const levelSkills = await this.listSkillsAtLevel(level);
      this.skillsCache.set(level, levelSkills);
    }
  }
}
