import { useCallback, useState } from 'react';

// IMS Act 1992 statutory messaging for the Neucomed (infant-formula) section.
// Kept on the client too (the server catalog carries its own copy) so the
// warning gate + banners read consistently.
export const NEUCOMED_WARNING_TITLE = 'Important notice — please read';

export const NEUCOMED_NOTICE =
  'Mother’s milk is best for your baby. Infant milk substitutes should be used only on the advice of a doctor or healthcare professional, and prepared and used exactly as directed — incorrect preparation can harm your baby.';

export const NEUCOMED_SHORT = 'Mother’s milk is best. Use only on a doctor’s advice.';

// Acknowledgement is per-session (sessionStorage) so the notice shows again on a
// fresh visit — the parent is "intimated first" each time, as requested.
const ACK_KEY = 'mateo:neucomed-ack';

function readAck(): boolean {
  try {
    return sessionStorage.getItem(ACK_KEY) === '1';
  } catch {
    return false;
  }
}

export function useNeucomedAck(): { acked: boolean; ack: () => void } {
  const [acked, setAcked] = useState(readAck);
  const ack = useCallback(() => {
    try {
      sessionStorage.setItem(ACK_KEY, '1');
    } catch {
      /* ignore */
    }
    setAcked(true);
  }, []);
  return { acked, ack };
}
