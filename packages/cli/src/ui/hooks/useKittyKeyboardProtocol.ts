import { useState } from 'react';
import {
  isKittyProtocolEnabled,
  isKittyProtocolSupported,
} from '../utils/kittyProtocolDetector.js';

export interface KittyProtocolStatus {
  supported: boolean;
  enabled: boolean;
  checking: boolean;
}

export function useKittyKeyboardProtocol(): KittyProtocolStatus {
  const [status] = useState<KittyProtocolStatus>({
    supported: isKittyProtocolSupported(),
    enabled: isKittyProtocolEnabled(),
    checking: false,
  });

  return status;
}
