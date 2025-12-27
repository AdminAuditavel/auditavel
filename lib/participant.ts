// lib/participant.ts
export function getOrCreateParticipantId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const STORAGE_KEY = "auditavel_participant_id";
  let participantId = localStorage.getItem(STORAGE_KEY);

  if (!participantId) {
    participantId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, participantId);
  }

  return participantId;
}
