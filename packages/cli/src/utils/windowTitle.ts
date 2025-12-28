export function computeWindowTitle(folderName: string): string {
  const title = process.env['CLI_TITLE'] || `Qwen - ${folderName}`;

  return title.replace(
    // eslint-disable-next-line no-control-regex
    /[\x00-\x1F\x7F]/g,
    '',
  );
}
