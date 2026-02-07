export interface FileFilteringOptions {
  respectGitIgnore: boolean;
  respectQwenIgnore: boolean;
}

// For memory files
export const DEFAULT_MEMORY_FILE_FILTERING_OPTIONS: FileFilteringOptions = {
  respectGitIgnore: false,
  respectQwenIgnore: true,
};

export const DEFAULT_FILE_FILTERING_OPTIONS: FileFilteringOptions = {
  respectGitIgnore: true,
  respectQwenIgnore: true,
};
