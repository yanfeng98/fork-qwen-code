import {
  type AuthType,
  type Config,
  getErrorMessage,
} from '@qwen-code/qwen-code-core';

export async function performInitialAuth(
  config: Config,
  authType: AuthType | undefined,
): Promise<string | null> {
  if (!authType) {
    return null;
  }

  try {
    await config.refreshAuth(authType);
    // The console.log is intentionally left out here.
    // We can add a dedicated startup message later if needed.
  } catch (e) {
    return `Failed to login. Message: ${getErrorMessage(e)}`;
  }

  return null;
}
