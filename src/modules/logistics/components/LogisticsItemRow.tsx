"use client";

import { useState } from "react";
import type { LogisticsGuest, LogisticsItem } from "../logistics.types";

interface Props {
  item: LogisticsItem;
  guests: LogisticsGuest[];
  currentGuestId: string | null;
  onEdit: (item: LogisticsItem) => void;
  onAssign: (itemId: string, guestId: string | null) => Promise<void>;
  onTake: (item: LogisticsItem) => Promise<void>;
  onToggle: (item: LogisticsItem) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  onQuantityChange?: (item: LogisticsItem, delta: number) => Promise<void>;
  isSourceLocked?: boolean;
  sectionTitle?: string;
}

function getInitials(guest: LogisticsGuest) {
  return [guest.first_name?.[0], guest.last_name?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase();
}

function GuestAvatar({ guest }: { guest: LogisticsGuest }) {
  return (
    <span
      className="lg-owner-avatar"
      style={{ background: guest.color ?? "#C4A882" }}
    >
      {guest.linked_user_avatar_url ? (
        <img src={guest.linked_user_avatar_url} alt="" />
      ) : (
        getInitials(guest)
      )}
    </span>
  );
}

function readQuantity(value: string | null) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
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
  onQuantityChange,
  isSourceLocked = false,
  sectionTitle,
}: Props) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [changingQuantity, setChangingQuantity] = useState(false);
  const assignedGuest =
    guests.find((guest) => guest.id === item.assigned_guest_id) ?? null;
  const isMine = Boolean(
    currentGuestId && item.assigned_guest_id === currentGuestId,
  );
  const quantity = readQuantity(item.quantity);

  async function assignTo(guestId: string | null) {
    setAssigning(true);
    try {
      await onAssign(item.id, guestId);
      setAssignOpen(false);
    } finally {
      setAssigning(false);
    }
  }

  async function changeQuantity(delta: number) {
    if (!onQuantityChange || changingQuantity) return;
    setChangingQuantity(true);
    try {
      await onQuantityChange(item, delta);
    } finally {
      setChangingQuantity(false);
    }
  }

  return (
    <div className={`lg-item-row${item.is_checked ? " lg-item-row-done" : ""}`}>
      <button
        type="button"
        className="lg-check"
        aria-label={
          item.is_checked ? "Marquer comme non prêt" : "Marquer comme prêt"
        }
        onClick={() => onToggle(item)}
      >
        {item.is_checked ? "✓" : ""}
      </button>

      <button
        type="button"
        className="lg-item-body lg-item-body-button"
        onClick={() => !isSourceLocked && onEdit(item)}
        disabled={isSourceLocked}
      >
        <div className="lg-item-title-row">
          <span className="lg-item-title">{item.label}</span>
          {sectionTitle && (
            <span className="lg-item-section-chip">{sectionTitle}</span>
          )}
        </div>
        {item.notes && <p className="lg-item-notes">{item.notes}</p>}
      </button>

      <div className="lg-quantity-stepper" aria-label="Quantité">
        <button
          type="button"
          onClick={() => changeQuantity(-1)}
          disabled={
            !onQuantityChange ||
            changingQuantity ||
            quantity <= 1 ||
            isSourceLocked
          }
          aria-label="Diminuer la quantité"
        >
          −
        </button>
        <span>{quantity}</span>
        <button
          type="button"
          onClick={() => changeQuantity(1)}
          disabled={!onQuantityChange || changingQuantity || isSourceLocked}
          aria-label="Augmenter la quantité"
        >
          +
        </button>
      </div>

      <div className="lg-item-owner">
        {assignedGuest ? (
          <button
            type="button"
            className={`lg-owner-chip lg-owner-button${isMine ? " mine" : ""}`}
            onClick={() => setAssignOpen((prev) => !prev)}
            aria-expanded={assignOpen}
          >
            <GuestAvatar guest={assignedGuest} />
            <span>{isMine ? "Moi" : assignedGuest.first_name}</span>
            <span className="lg-owner-caret">⌄</span>
          </button>
        ) : (
          <div className="lg-owner-empty-actions">
            <button
              className="lg-take-btn"
              type="button"
              onClick={() => onTake(item)}
              disabled={!currentGuestId}
            >
              Je prends
            </button>
            <button
              type="button"
              className="lg-assign-btn"
              onClick={() => setAssignOpen((prev) => !prev)}
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

            {guests.map((guest) => (
              <button
                key={guest.id}
                type="button"
                className={`lg-assign-option${guest.id === item.assigned_guest_id ? " active" : ""}`}
                onClick={() => assignTo(guest.id)}
                disabled={assigning}
              >
                <GuestAvatar guest={guest} />
                <span>
                  {guest.first_name}
                  {guest.last_name ? ` ${guest.last_name}` : ""}
                </span>
                {guest.id === currentGuestId && (
                  <span className="lg-assign-me">Moi</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {!isSourceLocked && (
        <div className="lg-item-actions">
          <button
            className="lg-action-btn"
            type="button"
            onClick={() => onEdit(item)}
            aria-label="Modifier"
          >
            ✎
          </button>
          <button
            className="lg-action-btn danger"
            type="button"
            onClick={() => onDelete(item.id)}
            aria-label="Supprimer"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
