const PREFIX = "retro-arcade:";

function read(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // storage unavailable (private mode, blocked): keep running without persistence
  }
}

export function getHighScore(gameId: string): number {
  const v = Number(read(`hi:${gameId}`));
  return Number.isFinite(v) ? v : 0;
}

/** Stores the score if it beats the current record. Returns true for a new record. */
export function submitScore(gameId: string, score: number): boolean {
  if (score <= getHighScore(gameId)) return false;
  write(`hi:${gameId}`, String(score));
  return true;
}

export function getFlag(key: string): boolean {
  return read(key) === "1";
}

export function setFlag(key: string, value: boolean): void {
  write(key, value ? "1" : "0");
}
