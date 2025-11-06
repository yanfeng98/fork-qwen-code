export interface FileFilteringOptions {
  respectGitIgnore: boolean;
  respectQwenIgnore: boolean;
}

export const DEFAULT_MEMORY_FILE_FILTERING_OPTIONS: FileFilteringOptions = {
  respectGitIgnore: false,
  respectQwenIgnore: true,
};

// For all other files
export const DEFAULT_FILE_FILTERING_OPTIONS: FileFilteringOptions = {
  respectGitIgnore: true,
  respectQwenIgnore: true,
};
