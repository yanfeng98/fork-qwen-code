let detectionComplete = false;
let protocolSupported = false;
let protocolEnabled = false;

export async function detectAndEnableKittyProtocol(): Promise<boolean> {
  if (detectionComplete) {
    return protocolSupported;
  }

  return new Promise((resolve) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      detectionComplete = true;
      resolve(false);
      return;
    }

    const originalRawMode = process.stdin.isRaw;
    if (!originalRawMode) {
      process.stdin.setRawMode(true);
    }

    let responseBuffer = '';
    let progressiveEnhancementReceived = false;
    let timeoutId: NodeJS.Timeout | undefined;

    const onTimeout = () => {
      timeoutId = undefined;
      process.stdin.removeListener('data', handleData);
      if (!originalRawMode) {
        process.stdin.setRawMode(false);
      }
      detectionComplete = true;
      resolve(false);
    };

    const handleData = (data: Buffer) => {
      if (timeoutId === undefined) {
        return;
      }
      responseBuffer += data.toString();

      if (responseBuffer.includes('\x1b[?') && responseBuffer.includes('u')) {
        progressiveEnhancementReceived = true;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(onTimeout, 1000);
      }

      if (responseBuffer.includes('\x1b[?') && responseBuffer.includes('c')) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
        process.stdin.removeListener('data', handleData);

        if (!originalRawMode) {
          process.stdin.setRawMode(false);
        }

        if (progressiveEnhancementReceived) {
          process.stdout.write('\x1b[>1u');
          protocolSupported = true;
          protocolEnabled = true;

          process.on('exit', disableProtocol);
          process.on('SIGTERM', disableProtocol);
        }

        detectionComplete = true;
        resolve(protocolSupported);
      }
    };

    process.stdin.on('data', handleData);

    process.stdout.write('\x1b[?u');
    process.stdout.write('\x1b[c');

    timeoutId = setTimeout(onTimeout, 200);
  });
}

function disableProtocol() {
  if (protocolEnabled) {
    process.stdout.write('\x1b[<u');
    protocolEnabled = false;
  }
}

export function isKittyProtocolEnabled(): boolean {
  return protocolEnabled;
}

export function isKittyProtocolSupported(): boolean {
  return protocolSupported;
}
