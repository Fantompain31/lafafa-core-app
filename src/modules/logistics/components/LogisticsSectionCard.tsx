'use client';

import type { LogisticsGuest, LogisticsSectionWithItems } from '../logistics.types';
import { LOGISTICS_SECTION_ICONS, LOGISTICS_SECTION_LABELS } from '../logistics.types';

interface Props {
  section: LogisticsSectionWithItems;
  guests: LogisticsGuest[];
  progress: number;
  progressLabel: string;
  onOpenSection: (sectionId: string) => void;
  onAddItem: (sectionId: string) => void;
  onEditSection: (section: LogisticsSectionWithItems) => void;
  onHideSection: (sectionId: string) => void;
}

function getInitials(guest: LogisticsGuest) {
  return [guest.first_name?.[0], guest.last_name?.[0]].filter(Boolean).join('').toUpperCase();
}


function isAccommodationLinkedSection(section: LogisticsSectionWithItems) {
  return (
    section.source_type === 'accommodation_bed' ||
    section.items.some(item => item.source_type === 'accommodation_bed' || Boolean(item.notes?.toLowerCase().includes('module couchage')))
  );
}

function getAssignedGuests(section: LogisticsSectionWithItems, guests: LogisticsGuest[]) {
  const ids = Array.from(new Set(section.items.map(item => item.assigned_guest_id).filter(Boolean))) as string[];
  return ids
    .map(id => guests.find(guest => guest.id === id))
    .filter(Boolean) as LogisticsGuest[];
}

export default function LogisticsSectionCard({
  section,
  guests,
  progress,
  progressLabel,
  onOpenSection,
  onAddItem,
  onEditSection,
  onHideSection,
}: Props) {
  const icon = LOGISTICS_SECTION_ICONS[section.section_type] ?? '📌';
  const label = LOGISTICS_SECTION_LABELS[section.section_type] ?? section.section_type;
  const todoItems = section.items.filter(item => !item.is_checked);
  const previewItems = todoItems.slice(0, 4);
  const extraTodoCount = Math.max(0, todoItems.length - previewItems.length);
  const assignedGuests = getAssignedGuests(section, guests);
  const isSourceLockedSection = isAccommodationLinkedSection(section);

  return (
    <section
      className="lg-compact-row lg-section-summary"
      data-type={section.section_type}
      onClick={() => onOpenSection(section.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenSection(section.id);
        }
      }}
      aria-label={`Ouvrir la section ${section.title}`}
    >
      <div className="lg-compact-main">
        <div className="lg-compact-icon">{icon}</div>

        <div className="lg-compact-body">
          <div className="lg-compact-topline">
            <span className={`lg-list-badge lg-list-badge-${section.section_type}`}>{label}</span>
            {section.source_type === 'organization_event' && <span className="lg-source-badge">planning</span>}
          </div>

          <div className="lg-compact-title-row">
            <h2>{section.title}</h2>
            <span className="lg-compact-count">{progressLabel}</span>
          </div>

          <div className="lg-compact-preview">
            {section.items.length === 0 ? (
              <span className="lg-compact-muted">Aucun élément à prévoir</span>
            ) : todoItems.length === 0 ? (
              <span className="lg-compact-success">Tout est prêt</span>
            ) : (
              <>
                {previewItems.map(item => (
                  <span key={item.id} className="lg-compact-chip-static">
                    {item.label}{item.quantity ? ` · ${item.quantity}` : ''}
                  </span>
                ))}
                {extraTodoCount > 0 && <span className="lg-compact-muted">+{extraTodoCount} autre{extraTodoCount > 1 ? 's' : ''}</span>}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="lg-compact-side" onClick={event => event.stopPropagation()}>
        <div className="lg-compact-avatars" aria-label="Personnes attribuées">
          {assignedGuests.slice(0, 4).map(guest => (
            <span key={guest.id} className="lg-owner-avatar" style={{ background: guest.color ?? '#C4A882' }} title={guest.first_name}>
              {guest.linked_user_avatar_url
                ? <img src={guest.linked_user_avatar_url} alt="" />
                : getInitials(guest)}
            </span>
          ))}
          {assignedGuests.length > 4 && <span className="lg-compact-more">+{assignedGuests.length - 4}</span>}
        </div>

        <div className="lg-compact-progress" title={`${progress}% prêt`}>
          <span>{progress}%</span>
          <div className="lg-progress-bar">
            <div className="lg-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {!isSourceLockedSection && (
          <div className="lg-compact-actions">
            <button className="lg-action-btn" type="button" onClick={() => onAddItem(section.id)} aria-label="Ajouter un élément">+</button>
            <button className="lg-action-btn" type="button" onClick={() => onEditSection(section)} aria-label="Modifier la section">✎</button>
            <button className="lg-action-btn danger" type="button" onClick={() => onHideSection(section.id)} aria-label="Masquer la section">×</button>
          </div>
        )}
      </div>
    </section>
  );
}
