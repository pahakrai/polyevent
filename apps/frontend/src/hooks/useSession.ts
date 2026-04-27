'use client';

import { useEffect, useState } from 'react';

export function useSession() {
  const [userId] = useState(() => {
    if (typeof window === 'undefined') return 'anonymous';
    let id = localStorage.getItem('userId');
    if (!id) {
      id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem('userId', id);
    }
    return id;
  });

  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return 'unknown';
    let id = sessionStorage.getItem('sessionId');
    if (!id) {
      id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem('sessionId', id);
    }
    return id;
  });

  return { userId, sessionId };
}
