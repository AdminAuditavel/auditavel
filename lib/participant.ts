// lib/participant.ts

const PARTICIPANT_KEY = "auditavel_participant_id";
const USER_HASH_KEY = "auditavel_uid";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getOrCreateParticipantId(): string {
  if (!isBrowser()) {
    // Nunca retornar string vazia (mas aqui não deve ser chamado no servidor)
    throw new Error("getOrCreateParticipantId must be called in the browser");
  }

  let participantId = localStorage.getItem(PARTICIPANT_KEY);

  if (!participantId) {
    participantId = crypto.randomUUID();
    localStorage.setItem(PARTICIPANT_KEY, participantId);
  }

  return participantId;
}

export function getOrCreateUserHash(): string {
  if (!isBrowser()) {
    // Nunca retornar string vazia (mas aqui não deve ser chamado no servidor)
    throw new Error("getOrCreateUserHash must be called in the browser");
  }

  let uid = localStorage.getItem(USER_HASH_KEY);

  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem(USER_HASH_KEY, uid);
  }

  return uid;
}
