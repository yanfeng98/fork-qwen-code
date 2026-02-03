import type { Content, Part } from '@google/genai';
import type { Config } from '../config/config.js';
import { getFolderStructure } from './getFolderStructure.js';

export async function getDirectoryContextString(
  config: Config,
): Promise<string> {
  const workspaceContext = config.getWorkspaceContext();
  const workspaceDirectories = workspaceContext.getDirectories();

  const folderStructures = await Promise.all(
    workspaceDirectories.map((dir) =>
      getFolderStructure(dir, {
        fileService: config.getFileService(),
      }),
    ),
  );

  const folderStructure = folderStructures.join('\n');

  let workingDirPreamble: string;
  if (workspaceDirectories.length === 1) {
    workingDirPreamble = `I'm currently working in the directory: ${workspaceDirectories[0]}`;
  } else {
    const dirList = workspaceDirectories.map((dir) => `  - ${dir}`).join('\n');
    workingDirPreamble = `I'm currently working in the following directories:\n${dirList}`;
  }

  return `${workingDirPreamble}
Here is the folder structure of the current working directories:

${folderStructure}`;
}

export async function getEnvironmentContext(config: Config): Promise<Part[]> {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const platform = process.platform;
  const directoryContext = await getDirectoryContextString(config);

  const context = `
This is the Qwen Code. We are setting up the context for our chat.
Today's date is ${today} (formatted according to the user's locale).
My operating system is: ${platform}
${directoryContext}
        `.trim();

  const initialParts: Part[] = [{ text: context }];
  const toolRegistry = config.getToolRegistry();

  if (config.getFullContext()) {
    try {
      const readManyFilesTool = toolRegistry.getTool('read_many_files');
      if (readManyFilesTool) {
        const invocation = readManyFilesTool.build({
          paths: ['**/*'],
          useDefaultExcludes: true,
        });

        const result = await invocation.execute(AbortSignal.timeout(30000));
        if (result.llmContent) {
          initialParts.push({
            text: `\n--- Full File Context ---\n${result.llmContent}`,
          });
        } else {
          console.warn(
            'Full context requested, but read_many_files returned no content.',
          );
        }
      } else {
        console.warn(
          'Full context requested, but read_many_files tool not found.',
        );
      }
    } catch (error) {
      console.error('Error reading full file context:', error);
      initialParts.push({
        text: '\n--- Error reading full file context ---',
      });
    }
  }

  return initialParts;
}

export async function getInitialChatHistory(
  config: Config,
  extraHistory?: Content[],
): Promise<Content[]> {
  if (config.getSkipStartupContext()) {
    return extraHistory ? [...extraHistory] : [];
  }

  const envParts = await getEnvironmentContext(config);
  const envContextString = envParts.map((part) => part.text || '').join('\n\n');

  return [
    {
      role: 'user',
      parts: [{ text: envContextString }],
    },
    {
      role: 'model',
      parts: [{ text: 'Got it. Thanks for the context!' }],
    },
    ...(extraHistory ?? []),
  ];
}
