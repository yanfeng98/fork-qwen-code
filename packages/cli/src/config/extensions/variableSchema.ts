export interface LoadExtensionContext {
  extensionDir: string;
  workspaceDir: string;
}

export interface VariableDefinition {
  type: 'string';
  description: string;
  default?: string;
  required?: boolean;
}

export interface VariableSchema {
  [key: string]: VariableDefinition;
}

const PATH_SEPARATOR_DEFINITION = {
  type: 'string',
  description: 'The path separator.',
} as const;

export const VARIABLE_SCHEMA = {
  extensionPath: {
    type: 'string',
    description: 'The path of the extension in the filesystem.',
  },
  workspacePath: {
    type: 'string',
    description: 'The absolute path of the current workspace.',
  },
  '/': PATH_SEPARATOR_DEFINITION,
  pathSeparator: PATH_SEPARATOR_DEFINITION,
} as const;
