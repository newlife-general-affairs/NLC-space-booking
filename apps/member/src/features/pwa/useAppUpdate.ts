import { useEffect, useState } from 'react';
import { pwaService } from '../../services/pwa/PwaService';

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => pwaService.onUpdateAvailable(() => setUpdateAvailable(true)), []);

  return {
    updateAvailable,
    applyUpdate: () => pwaService.applyUpdate(),
  };
}
