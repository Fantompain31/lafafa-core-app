'use client'

import { useMemo, useState } from 'react'
import type {
  AccommodationAssignment,
  AccommodationBed,
  AccommodationBedFormValues,
  AccommodationBedType,
  AccommodationGuest,
  AccommodationRoomFormValues,
  AccommodationRoomWithBeds,
} from './accommodation.types'
import {
  BED_TYPE_CAPACITY,
  BED_TYPE_LABELS,
  BED_TYPE_OPTIONS,
} from './accommodation.types'
import {
  assignGuestToBed,
  createAccommodationBed,
  createAccommodationRoom,
  deleteAccommodationBed,
  deleteAccommodationRoom,
  removeAccommodationAssignment,
  updateAccommodationBed,
  updateAccommodationRoom,
} from './accommodation.service'
import './accommodation.css'

type Props = {
  stayId: string
  initialRooms: AccommodationRoomWithBeds[]
  guests: AccommodationGuest[]
}

type ModalMode = 'create-room' | 'edit-room' | 'add-bed' | 'edit-bed' | null

const emptyBed = (): AccommodationBedFormValues => ({
  label: 'Lit 2 places',
  bed_type: 'double_bed',
  capacity: 2,
  needs_logistics: false,
})

const emptyRoomForm = (): AccommodationRoomFormValues => ({
  name: '',
  notes: '',
  beds: [emptyBed()],
})

function initials(guest: AccommodationGuest) {
  return [guest.first_name?.[0], guest.last_name?.[0]].filter(Boolean).join('').toUpperCase()
}

function guestName(guest: AccommodationGuest | undefined) {
  if (!guest) return 'Invité'
  return `${guest.first_name}${guest.last_name ? ` ${guest.last_name}` : ''}`
}

export default function AccommodationPageClient({ stayId, initialRooms, guests }: Props) {
  const [rooms, setRooms] = useState(initialRooms)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [editingBed, setEditingBed] = useState<AccommodationBed | null>(null)
  const [roomForm, setRoomForm] = useState<AccommodationRoomFormValues>(emptyRoomForm())
  const [bedForm, setBedForm] = useState<AccommodationBedFormValues>(emptyBed())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const guestMap = useMemo(() => new Map(guests.map((guest) => [guest.id, guest])), [guests])
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null

  const stats = useMemo(() => {
    const totalCapacity = rooms.reduce(
      (sum, room) => sum + room.beds.reduce((bedSum, bed) => bedSum + bed.capacity, 0),
      0,
    )
    const assigned = rooms.reduce(
      (sum, room) => sum + room.beds.reduce((bedSum, bed) => bedSum + bed.assignments.length, 0),
      0,
    )
    const assignedGuestIds = new Set(
      rooms.flatMap((room) => room.beds.flatMap((bed) => bed.assignments.map((a) => a.guest_id))),
    )
    const unassignedGuests = guests.filter((guest) => !assignedGuestIds.has(guest.id))

    return {
      totalCapacity,
      assigned,
      free: Math.max(0, totalCapacity - assigned),
      unassignedGuests,
    }
  }, [rooms, guests])

  function refreshRoom(updatedRoom: AccommodationRoomWithBeds) {
    setRooms((prev) => prev.map((room) => (room.id === updatedRoom.id ? updatedRoom : room)))
  }

  function updateRoomPartial(roomId: string, updater: (room: AccommodationRoomWithBeds) => AccommodationRoomWithBeds) {
    setRooms((prev) => prev.map((room) => (room.id === roomId ? updater(room) : room)))
  }

  function openCreateRoom() {
    setError(null)
    setRoomForm(emptyRoomForm())
    setModalMode('create-room')
  }

  function openEditRoom(room: AccommodationRoomWithBeds) {
    setError(null)
    setRoomForm({ name: room.name, notes: room.notes ?? '', beds: [] })
    setSelectedRoomId(room.id)
    setModalMode('edit-room')
  }

  function openAddBed(room: AccommodationRoomWithBeds) {
    setError(null)
    setSelectedRoomId(room.id)
    setEditingBed(null)
    setBedForm(emptyBed())
    setModalMode('add-bed')
  }

  function openEditBed(bed: AccommodationBed) {
    setError(null)
    setEditingBed(bed)
    setBedForm({
      label: bed.label,
      bed_type: bed.bed_type,
      capacity: bed.capacity,
      needs_logistics: bed.needs_logistics,
    })
    setModalMode('edit-bed')
  }

  async function handleSaveRoom() {
    setError(null)
    setSaving(true)

    try {
      if (modalMode === 'create-room') {
        const created = await createAccommodationRoom(stayId, roomForm)
        const nextRoom: AccommodationRoomWithBeds = { ...created, beds: [] }
        // Le serveur crée aussi les couchages. On recharge simplement la page pour repartir de l'état complet.
        window.location.reload()
        setRooms((prev) => [...prev, nextRoom])
        setSelectedRoomId(created.id)
      }

      if (modalMode === 'edit-room' && selectedRoom) {
        const updated = await updateAccommodationRoom(selectedRoom.id, {
          name: roomForm.name,
          notes: roomForm.notes,
        })
        refreshRoom({ ...selectedRoom, ...updated })
      }

      setModalMode(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveBed() {
    if (!selectedRoom) return
    setError(null)
    setSaving(true)

    try {
      if (modalMode === 'add-bed') {
        const created = await createAccommodationBed(selectedRoom.id, bedForm)
        updateRoomPartial(selectedRoom.id, (room) => ({
          ...room,
          beds: [...room.beds, { ...created, assignments: [] }],
        }))
      }

      if (modalMode === 'edit-bed' && editingBed) {
        const updated = await updateAccommodationBed(editingBed.id, bedForm)
        updateRoomPartial(selectedRoom.id, (room) => ({
          ...room,
          beds: room.beds.map((bed) => (bed.id === updated.id ? { ...updated, assignments: bed.assignments } : bed)),
        }))
      }

      setModalMode(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteRoom(room: AccommodationRoomWithBeds) {
    if (!confirm(`Supprimer la pièce “${room.name}” et ses couchages ?`)) return
    setError(null)

    try {
      await deleteAccommodationRoom(room.id)
      setRooms((prev) => prev.filter((item) => item.id !== room.id))
      if (selectedRoomId === room.id) setSelectedRoomId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  async function handleDeleteBed(bed: AccommodationBed) {
    if (!selectedRoom) return
    if (!confirm(`Supprimer “${bed.label}” ?`)) return
    setError(null)

    try {
      await deleteAccommodationBed(bed.id)
      updateRoomPartial(selectedRoom.id, (room) => ({
        ...room,
        beds: room.beds.filter((item) => item.id !== bed.id),
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  async function handleAssign(bed: AccommodationBed, guestId: string) {
    if (!selectedRoom) return
    setError(null)

    try {
      const assignment = await assignGuestToBed(bed.id, guestId)
      setRooms((prev) => prev.map((room) => ({
        ...room,
        beds: room.beds.map((currentBed) => {
          const withoutGuest = currentBed.assignments.filter((a) => a.guest_id !== guestId)
          if (currentBed.id !== bed.id) return { ...currentBed, assignments: withoutGuest }
          return { ...currentBed, assignments: [...withoutGuest, assignment] }
        }),
      })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  async function handleRemoveAssignment(assignment: AccommodationAssignment) {
    setError(null)

    try {
      await removeAccommodationAssignment(assignment.id)
      setRooms((prev) => prev.map((room) => ({
        ...room,
        beds: room.beds.map((bed) => ({
          ...bed,
          assignments: bed.assignments.filter((item) => item.id !== assignment.id),
        })),
      })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  function setRoomBed(index: number, patch: Partial<AccommodationBedFormValues>) {
    setRoomForm((prev) => ({
      ...prev,
      beds: prev.beds.map((bed, bedIndex) => (bedIndex === index ? { ...bed, ...patch } : bed)),
    }))
  }

  function addRoomBed() {
    setRoomForm((prev) => ({ ...prev, beds: [...prev.beds, emptyBed()] }))
  }

  function removeRoomBed(index: number) {
    setRoomForm((prev) => ({ ...prev, beds: prev.beds.filter((_, bedIndex) => bedIndex !== index) }))
  }

  function handleBedTypeChange(value: AccommodationBedType, mode: 'room' | 'bed', index?: number) {
    const label = BED_TYPE_LABELS[value]
    const capacity = BED_TYPE_CAPACITY[value]
    if (mode === 'room' && index !== undefined) setRoomBed(index, { bed_type: value, label, capacity })
    if (mode === 'bed') setBedForm((prev) => ({ ...prev, bed_type: value, label, capacity }))
  }

  return (
    <div className="ac-root">
      <div className="ac-toolbar">
        <div>
          <p className="ac-eyebrow">Couchage</p>
          <h1>Qui dort où ?</h1>
          <p className="ac-subtitle">Créez les pièces, ajoutez les couchages connus, puis attribuez les invités.</p>
        </div>
        <button className="ac-btn-primary" onClick={openCreateRoom}>+ Ajouter une pièce</button>
      </div>

      {error && <div className="ac-error">{error}</div>}

      <div className="ac-stats">
        <StatCard value={rooms.length} label="pièce(s)" />
        <StatCard value={stats.totalCapacity} label="places" />
        <StatCard value={stats.assigned} label="attribuées" />
        <StatCard value={stats.free} label="libres" />
      </div>

      {stats.unassignedGuests.length > 0 && (
        <div className="ac-unassigned">
          <span>Sans couchage</span>
          <div>
            {stats.unassignedGuests.slice(0, 8).map((guest) => (
              <GuestChip key={guest.id} guest={guest} />
            ))}
            {stats.unassignedGuests.length > 8 && <small>+{stats.unassignedGuests.length - 8}</small>}
          </div>
        </div>
      )}

      {rooms.length === 0 ? (
        <div className="ac-empty">
          <div>🛏️</div>
          <p>Aucune pièce pour le moment.</p>
          <button className="ac-btn-primary" onClick={openCreateRoom}>Créer la première pièce</button>
        </div>
      ) : (
        <div className="ac-layout">
          <div className="ac-room-list">
            {rooms.map((room) => (
              <RoomSummaryCard
                key={room.id}
                room={room}
                guestMap={guestMap}
                active={room.id === selectedRoomId}
                onOpen={() => setSelectedRoomId(room.id)}
              />
            ))}
          </div>
        </div>
      )}

      {selectedRoom && modalMode === null && (
        <div className="ac-modal-overlay ac-room-detail-overlay" onClick={() => setSelectedRoomId(null)}>
          <div className="ac-modal ac-room-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="ac-detail-header">
              <div>
                <p className="ac-eyebrow">Pièce</p>
                <h2>{selectedRoom.name}</h2>
                {selectedRoom.notes && <p>{selectedRoom.notes}</p>}
              </div>
              <div className="ac-detail-actions">
                <button className="ac-btn-ghost" onClick={() => openEditRoom(selectedRoom)}>Renommer</button>
                <button className="ac-btn-danger" onClick={() => void handleDeleteRoom(selectedRoom)}>Supprimer</button>
                <button className="ac-detail-close" type="button" onClick={() => setSelectedRoomId(null)} aria-label="Fermer">×</button>
              </div>
            </div>

            <div className="ac-beds">
              {selectedRoom.beds.map((bed) => (
                <BedCard
                  key={bed.id}
                  bed={bed}
                  guests={guests}
                  guestMap={guestMap}
                  onAssign={handleAssign}
                  onRemoveAssignment={handleRemoveAssignment}
                  onEdit={openEditBed}
                  onDelete={handleDeleteBed}
                />
              ))}
            </div>

            <button className="ac-add-bed" onClick={() => openAddBed(selectedRoom)}>+ Ajouter un couchage</button>
          </div>
        </div>
      )}

      {(modalMode === 'create-room' || modalMode === 'edit-room') && (
        <Modal title={modalMode === 'create-room' ? 'Nouvelle pièce' : 'Modifier la pièce'} onClose={() => setModalMode(null)}>
          <div className="ac-form">
            <Field label="Nom de la pièce *">
              <input value={roomForm.name} onChange={(e) => setRoomForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Chambre du bas" />
            </Field>
            <Field label="Notes">
              <textarea value={roomForm.notes} onChange={(e) => setRoomForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Ex : côté jardin, accès par le salon…" />
            </Field>

            {modalMode === 'create-room' && (
              <div className="ac-form-beds">
                <div className="ac-form-section-title">Couchages connus</div>
                {roomForm.beds.map((bed, index) => (
                  <div key={index} className="ac-bed-form-row">
                    <Field label="Type">
                      <select value={bed.bed_type} onChange={(e) => handleBedTypeChange(e.target.value as AccommodationBedType, 'room', index)}>
                        {BED_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{BED_TYPE_LABELS[type]}</option>)}
                      </select>
                    </Field>
                    <Field label="Nom">
                      <input value={bed.label} onChange={(e) => setRoomBed(index, { label: e.target.value })} />
                    </Field>
                    <Field label="Places">
                      <input type="number" min={1} max={10} value={bed.capacity} onChange={(e) => setRoomBed(index, { capacity: Number(e.target.value) })} />
                    </Field>
                    <label className="ac-checkline">
                      <input type="checkbox" checked={bed.needs_logistics} onChange={(e) => setRoomBed(index, { needs_logistics: e.target.checked })} />
                      Besoin logistique
                    </label>
                    {roomForm.beds.length > 1 && <button className="ac-mini-danger" onClick={() => removeRoomBed(index)}>Retirer</button>}
                  </div>
                ))}
                <button className="ac-btn-ghost" onClick={addRoomBed}>+ Ajouter un couchage</button>
              </div>
            )}

            <div className="ac-form-actions">
              <button className="ac-btn-ghost" onClick={() => setModalMode(null)}>Annuler</button>
              <button className="ac-btn-primary" onClick={() => void handleSaveRoom()} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </div>
        </Modal>
      )}

      {(modalMode === 'add-bed' || modalMode === 'edit-bed') && (
        <Modal title={modalMode === 'add-bed' ? 'Ajouter un couchage' : 'Modifier le couchage'} onClose={() => setModalMode(null)}>
          <BedForm values={bedForm} setValues={setBedForm} onTypeChange={(type) => handleBedTypeChange(type, 'bed')} />
          <div className="ac-form-actions">
            <button className="ac-btn-ghost" onClick={() => setModalMode(null)}>Annuler</button>
            <button className="ac-btn-primary" onClick={() => void handleSaveBed()} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function StatCard({ value, label }: { value: number; label: string }) {
  return <div className="ac-stat"><strong>{value}</strong><span>{label}</span></div>
}

function RoomSummaryCard({ room, guestMap, active, onOpen }: {
  room: AccommodationRoomWithBeds
  guestMap: Map<string, AccommodationGuest>
  active: boolean
  onOpen: () => void
}) {
  const capacity = room.beds.reduce((sum, bed) => sum + bed.capacity, 0)
  const assigned = room.beds.reduce((sum, bed) => sum + bed.assignments.length, 0)
  const assignedGuests = room.beds.flatMap((bed) => bed.assignments.map((a) => guestMap.get(a.guest_id)).filter(Boolean)) as AccommodationGuest[]
  const percent = capacity > 0 ? Math.min(100, Math.round((assigned / capacity) * 100)) : 0

  return (
    <button className={`ac-room-card${active ? ' active' : ''}`} onClick={onOpen}>
      <div className="ac-room-card-top">
        <div>
          <h2>{room.name}</h2>
          <p>{capacity} place{capacity > 1 ? 's' : ''} · {assigned} attribuée{assigned > 1 ? 's' : ''} · {Math.max(0, capacity - assigned)} libre{capacity - assigned > 1 ? 's' : ''}</p>
        </div>
        <span>{assigned}/{capacity}</span>
      </div>
      <div className="ac-progress"><div style={{ width: `${percent}%` }} /></div>
      <div className="ac-room-guests">
        {assignedGuests.length === 0 ? <small>Aucun invité attribué</small> : assignedGuests.slice(0, 5).map((guest) => <GuestChip key={guest.id} guest={guest} />)}
        {assignedGuests.length > 5 && <small>+{assignedGuests.length - 5}</small>}
      </div>
    </button>
  )
}

function BedCard({ bed, guests, guestMap, onAssign, onRemoveAssignment, onEdit, onDelete }: {
  bed: AccommodationBed & { assignments: AccommodationAssignment[] }
  guests: AccommodationGuest[]
  guestMap: Map<string, AccommodationGuest>
  onAssign: (bed: AccommodationBed, guestId: string) => Promise<void>
  onRemoveAssignment: (assignment: AccommodationAssignment) => Promise<void>
  onEdit: (bed: AccommodationBed) => void
  onDelete: (bed: AccommodationBed) => void
}) {
  const [assigning, setAssigning] = useState(false)
  const free = Math.max(0, bed.capacity - bed.assignments.length)
  const assignedGuestIds = new Set(bed.assignments.map((assignment) => assignment.guest_id))

  return (
    <div className="ac-bed-card">
      <div className="ac-bed-header">
        <div>
          <h3>{bed.label}</h3>
          <p>{BED_TYPE_LABELS[bed.bed_type] ?? bed.bed_type} · {bed.assignments.length}/{bed.capacity} place{bed.capacity > 1 ? 's' : ''}</p>
        </div>
        <div className="ac-bed-actions">
          {bed.needs_logistics && <span className="ac-logistics-badge">Logistique</span>}
          <button className="ac-action" onClick={() => onEdit(bed)}>Modifier</button>
          <button className="ac-action danger" onClick={() => onDelete(bed)}>Supprimer</button>
        </div>
      </div>

      <div className="ac-assigned-list">
        {bed.assignments.map((assignment) => {
          const guest = guestMap.get(assignment.guest_id)
          return (
            <div key={assignment.id} className="ac-assigned-chip">
              {guest && <GuestChip guest={guest} />}
              <button onClick={() => void onRemoveAssignment(assignment)}>×</button>
            </div>
          )
        })}
        {free > 0 && <span className="ac-free-chip">{free} libre{free > 1 ? 's' : ''}</span>}
      </div>

      {free > 0 && (
        <select
          className="ac-assign-select"
          value=""
          disabled={assigning}
          onChange={async (event) => {
            const guestId = event.target.value
            if (!guestId) return
            setAssigning(true)
            await onAssign(bed, guestId)
            setAssigning(false)
          }}
        >
          <option value="">Attribuer un invité…</option>
          {guests.map((guest) => (
            <option key={guest.id} value={guest.id} disabled={assignedGuestIds.has(guest.id)}>{guestName(guest)}</option>
          ))}
        </select>
      )}
    </div>
  )
}

function GuestChip({ guest }: { guest: AccommodationGuest }) {
  return (
    <span className="ac-guest-chip">
      <span className="ac-avatar" style={{ background: guest.color ?? '#C4A882' }}>
        {guest.linked_user_avatar_url ? <img src={guest.linked_user_avatar_url} alt="" /> : initials(guest)}
      </span>
      {guest.first_name}
    </span>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="ac-modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="ac-modal">
        <div className="ac-modal-header">
          <h2>{title}</h2>
          <button onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="ac-field"><span>{label}</span>{children}</label>
}

function BedForm({ values, setValues, onTypeChange }: {
  values: AccommodationBedFormValues
  setValues: React.Dispatch<React.SetStateAction<AccommodationBedFormValues>>
  onTypeChange: (type: AccommodationBedType) => void
}) {
  return (
    <div className="ac-form">
      <Field label="Type">
        <select value={values.bed_type} onChange={(event) => onTypeChange(event.target.value as AccommodationBedType)}>
          {BED_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{BED_TYPE_LABELS[type]}</option>)}
        </select>
      </Field>
      <Field label="Nom du couchage">
        <input value={values.label} onChange={(event) => setValues((prev) => ({ ...prev, label: event.target.value }))} />
      </Field>
      <Field label="Nombre de places">
        <input type="number" min={1} max={10} value={values.capacity} onChange={(event) => setValues((prev) => ({ ...prev, capacity: Number(event.target.value) }))} />
      </Field>
      <label className="ac-checkline">
        <input type="checkbox" checked={values.needs_logistics} onChange={(event) => setValues((prev) => ({ ...prev, needs_logistics: event.target.checked }))} />
        Besoin logistique à prévoir
      </label>
    </div>
  )
}
