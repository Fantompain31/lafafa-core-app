'use client';

import { useState } from 'react';
import type { LogisticsGuest, LogisticsItem } from '../logistics.types';

interface Props {
  item: LogisticsItem;
  guests: LogisticsGuest[];
  currentGuestId: string | null;
  onEdit: (item: LogisticsItem) => void;
  onAssign: (itemId: string, guestId: string | null) => Promise<void>;
  onTake: (item: LogisticsItem) => Promise<void>;
  onToggle: (item: LogisticsItem) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  isSourceLocked?: boolean;
}

function getInitials(guest: LogisticsGuest) {
  return [guest.first_name?.[0], guest.last_name?.[0]].filter(Boolean).join('').toUpperCase();
}

function GuestAvatar({ guest }: { guest: LogisticsGuest }) {
  return (
    <span className="lg-owner-avatar" style={{ background: guest.color ?? '#C4A882' }}>
      {guest.linked_user_avatar_url
        ? <img src={guest.linked_user_avatar_url} alt="" />
        : getInitials(guest)}
    </span>
  );
}

export default function LogisticsItemRow({
  item,
  guests,
  currentGuestId,
  onEdit,
  onAssign,
  onTake,
  onToggle,
  onDelete,
  isSourceLocked = false,
}: Props) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const assignedGuest = guests.find(guest => guest.id === item.assigned_guest_id) ?? null;
  const isMine = Boolean(currentGuestId && item.assigned_guest_id === currentGuestId);

  async function assignTo(guestId: string | null) {
    setAssigning(true);
    try {
      await onAssign(item.id, guestId);
      setAssignOpen(false);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className={`lg-item-row${item.is_checked ? ' lg-item-row-done' : ''}`}>
      <button
        type="button"
        className="lg-check"
        aria-label={item.is_checked ? 'Marquer comme non prêt' : 'Marquer comme prêt'}
        onClick={() => onToggle(item)}
      >
        {item.is_checked ? '✓' : ''}
      </button>

      <div className="lg-item-body">
        <div className="lg-item-title-row">
          <span className="lg-item-title">{item.label}</span>
          {item.quantity && <span className="lg-item-qty">{item.quantity}</span>}
        </div>
        {item.notes && <p className="lg-item-notes">{item.notes}</p>}
        {isSourceLocked && (
          <p className="lg-item-source-note">
            Élément créé depuis Couchage. À modifier ou supprimer depuis le module Couchage.
          </p>
        )}
      </div>

      <div className="lg-item-owner">
        {assignedGuest ? (
          <button
            type="button"
            className={`lg-owner-chip lg-owner-button${isMine ? ' mine' : ''}`}
            onClick={() => setAssignOpen(prev => !prev)}
            aria-expanded={assignOpen}
          >
            <GuestAvatar guest={assignedGuest} />
            <span>{isMine ? 'Moi' : assignedGuest.first_name}</span>
            <span className="lg-owner-caret">⌄</span>
          </button>
        ) : (
          <div className="lg-owner-empty-actions">
            <button className="lg-take-btn" type="button" onClick={() => onTake(item)} disabled={!currentGuestId}>Je prends</button>
            <button
              type="button"
              className="lg-assign-btn"
              onClick={() => setAssignOpen(prev => !prev)}
              aria-expanded={assignOpen}
            >
              Attribuer
            </button>
          </div>
        )}

        {assignOpen && (
          <div className="lg-assign-menu">
            <button
              type="button"
              className="lg-assign-option muted"
              onClick={() => assignTo(null)}
              disabled={assigning}
            >
              Non attribué
            </button>

            {guests.map(guest => (
              <button
                key={guest.id}
                type="button"
                className={`lg-assign-option${guest.id === item.assigned_guest_id ? ' active' : ''}`}
                onClick={() => assignTo(guest.id)}
                disabled={assigning}
              >
                <GuestAvatar guest={guest} />
                <span>{guest.first_name}{guest.last_name ? ` ${guest.last_name}` : ''}</span>
                {guest.id === currentGuestId && <span className="lg-assign-me">Moi</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="lg-item-actions">
        {isSourceLocked ? (
          <span
            className="lg-source-lock"
            title="Élément créé depuis Couchage. À modifier depuis le module Couchage."
            aria-label="Élément créé depuis Couchage. À modifier depuis le module Couchage."
          >
            🔒
          </span>
        ) : (
          <>
            <button className="lg-action-btn" type="button" onClick={() => onEdit(item)} aria-label="Modifier">✎</button>
            <button className="lg-action-btn danger" type="button" onClick={() => onDelete(item.id)} aria-label="Supprimer">×</button>
          </>
        )}
      </div>
    </div>
  );
}
