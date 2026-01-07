/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SkillManager, type Extension } from './skill-manager.js';
import type { Config } from '../config/config.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('SkillManager - Extension Support', () => {
  let manager: SkillManager;
  let mockConfig: Config;
  let tmpDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-manager-test-'));

    mockConfig = {
      getProjectRoot: () => tmpDir,
    } as Config;

    manager = new SkillManager(mockConfig);
  });

  describe('listSkillsFromExtensions', () => {
    it('should return empty array when no extensions provided', async () => {
      const skills = await manager.listSkillsFromExtensions([]);
      expect(skills).toEqual([]);
    });

    it('should return empty array when extensions have no skills paths', async () => {
      const extensions: Extension[] = [
        {
          path: '/path/to/extension',
          config: { name: 'test', version: '1.0.0' },
          contextFiles: [],
          skillsPaths: [],
        },
      ];

      const skills = await manager.listSkillsFromExtensions(extensions);
      expect(skills).toEqual([]);
    });

    it('should load skills from extension directories', async () => {
      // Create test extension with a skill
      const extensionDir = path.join(tmpDir, 'test-extension');
      const skillsDir = path.join(extensionDir, 'skills');
      const skillDir = path.join(skillsDir, 'test-skill');
      await fs.mkdir(skillDir, { recursive: true });

      const skillContent = `---
name: test-skill
description: A test skill from extension
---

This is a test skill from an extension.`;

      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent);

      const extensions: Extension[] = [
        {
          path: extensionDir,
          config: { name: 'test-extension', version: '1.0.0' },
          contextFiles: [],
          skillsPaths: [skillsDir],
        },
      ];

      const skills = await manager.listSkillsFromExtensions(extensions);
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('test-skill');
      expect(skills[0].description).toBe('A test skill from extension');
      expect(skills[0].level).toBe('extension');
      expect(skills[0].extensionName).toBe('test-extension');
    });

    it('should load skills from multiple extensions', async () => {
      // Create first extension
      const ext1Dir = path.join(tmpDir, 'ext1');
      const skill1Dir = path.join(ext1Dir, 'skills', 'skill1');
      await fs.mkdir(skill1Dir, { recursive: true });
      await fs.writeFile(
        path.join(skill1Dir, 'SKILL.md'),
        '---\nname: skill1\ndescription: Skill 1\n---\nContent 1',
      );

      // Create second extension
      const ext2Dir = path.join(tmpDir, 'ext2');
      const skill2Dir = path.join(ext2Dir, 'skills', 'skill2');
      await fs.mkdir(skill2Dir, { recursive: true });
      await fs.writeFile(
        path.join(skill2Dir, 'SKILL.md'),
        '---\nname: skill2\ndescription: Skill 2\n---\nContent 2',
      );

      const extensions: Extension[] = [
        {
          path: ext1Dir,
          config: { name: 'ext1', version: '1.0.0' },
          contextFiles: [],
          skillsPaths: [path.join(ext1Dir, 'skills')],
        },
        {
          path: ext2Dir,
          config: { name: 'ext2', version: '1.0.0' },
          contextFiles: [],
          skillsPaths: [path.join(ext2Dir, 'skills')],
        },
      ];

      const skills = await manager.listSkillsFromExtensions(extensions);
      expect(skills).toHaveLength(2);
      expect(skills.map((s) => s.name)).toContain('skill1');
      expect(skills.map((s) => s.name)).toContain('skill2');
    });

    it('should handle invalid skill files gracefully', async () => {
      const extensionDir = path.join(tmpDir, 'test-extension');
      const skillsDir = path.join(extensionDir, 'skills');
      const skillDir = path.join(skillsDir, 'invalid-skill');
      await fs.mkdir(skillDir, { recursive: true });

      // Create invalid skill file (missing name)
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        '---\ndescription: Invalid\n---\nContent',
      );

      const extensions: Extension[] = [
        {
          path: extensionDir,
          config: { name: 'test-extension', version: '1.0.0' },
          contextFiles: [],
          skillsPaths: [skillsDir],
        },
      ];

      const skills = await manager.listSkillsFromExtensions(extensions);
      // Should skip invalid skill
      expect(skills).toHaveLength(0);
    });
  });

  describe('listSkills with extensions', () => {
    it('should include extension skills in list with correct precedence', async () => {
      // Create project-level skill
      const projectSkillsDir = path.join(tmpDir, '.qwen', 'skills');
      const projectSkillDir = path.join(projectSkillsDir, 'project-skill');
      await fs.mkdir(projectSkillDir, { recursive: true });
      await fs.writeFile(
        path.join(projectSkillDir, 'SKILL.md'),
        '---\nname: shared-skill\ndescription: Project skill\n---\nProject',
      );

      // Create extension skill with same name (should be overridden)
      const extensionDir = path.join(tmpDir, 'test-extension');
      const extSkillsDir = path.join(extensionDir, 'skills');
      const extSkillDir = path.join(extSkillsDir, 'ext-skill');
      await fs.mkdir(extSkillDir, { recursive: true });
      await fs.writeFile(
        path.join(extSkillDir, 'SKILL.md'),
        '---\nname: shared-skill\ndescription: Extension skill\n---\nExtension',
      );

      const extensions: Extension[] = [
        {
          path: extensionDir,
          config: { name: 'test-extension', version: '1.0.0' },
          contextFiles: [],
          skillsPaths: [extSkillsDir],
        },
      ];

      // Pass extensions to listSkills
      manager.setExtensions(extensions);
      const skills = await manager.listSkills();

      // Project skill should take precedence
      const sharedSkill = skills.find((s) => s.name === 'shared-skill');
      expect(sharedSkill).toBeDefined();
      expect(sharedSkill?.description).toBe('Project skill');
      expect(sharedSkill?.level).toBe('project');
    });
  });
});
