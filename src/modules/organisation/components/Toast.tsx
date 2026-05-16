'use client';
// src/modules/organisation/components/Toast.tsx
// Toast de confirmation discret, auto-dismiss après 2.5s

import { useEffect, useState } from 'react';

interface Props {
  message: string;
  type?: 'success' | 'info';
  onDone: () => void;
}

export default function Toast({ message, type = 'success', onDone }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Petit délai pour déclencher l'animation d'entrée
    const show = setTimeout(() => setVisible(true), 10);
    const hide = setTimeout(() => setVisible(false), 2200);
    const done = setTimeout(onDone, 2600);
    return () => { clearTimeout(show); clearTimeout(hide); clearTimeout(done); };
  }, [onDone]);

  return (
    <div className={`org-toast org-toast--${type}${visible ? ' visible' : ''}`}>
      <span className="org-toast-icon">
        {type === 'success' ? '✓' : 'ℹ'}
      </span>
      {message}
    </div>
  );
}
