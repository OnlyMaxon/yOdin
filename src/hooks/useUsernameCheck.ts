import { useEffect, useState } from 'react';
import { isUsernameAvailable } from '../services/userService';
import { normalizeUsername, isValidUsername } from '../utils/mentions';

export type UsernameStatus =
  | 'idle'        // empty input
  | 'invalid'     // wrong format
  | 'checking'    // querying availability
  | 'available'   // free to claim
  | 'taken'       // already claimed by someone else
  | 'unchanged';  // equals the user's current username (editing)

// Debounced availability check shared by RegisterScreen and the Edit Profile
// form. Pass `currentUsername` when editing so the user's own name reads as
// 'unchanged' instead of 'taken'.
export function useUsernameCheck(raw: string, currentUsername?: string): UsernameStatus {
  const [status, setStatus] = useState<UsernameStatus>('idle');

  useEffect(() => {
    const name = normalizeUsername(raw);
    if (!name) { setStatus('idle'); return; }
    if (currentUsername && name === currentUsername) { setStatus('unchanged'); return; }
    if (!isValidUsername(name)) { setStatus('invalid'); return; }

    setStatus('checking');
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const free = await isUsernameAvailable(name);
        if (active) setStatus(free ? 'available' : 'taken');
      } catch {
        if (active) setStatus('idle');
      }
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [raw, currentUsername]);

  return status;
}
