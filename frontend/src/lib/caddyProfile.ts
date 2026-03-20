import type { UserProfile } from '@/types/userProfile';

/** Single localStorage document for golfer profile + guide metadata */
export const CADDY_PROFILE_STORAGE_KEY = 'caddy-user-profile';

export type PreparedCourse = {
  name: string;
  preparedAt: string;
};

export type CaddyStoredProfile = Partial<UserProfile> & {
  preparedCourses?: PreparedCourse[];
  /** Set when user completes or skips intake — skips re-prompt on return */
  onboardingComplete?: boolean;
};

export function loadCaddyProfile(): CaddyStoredProfile {
  try {
    const s = localStorage.getItem(CADDY_PROFILE_STORAGE_KEY);
    if (!s) return {};
    const raw = JSON.parse(s) as Record<string, unknown>;
    delete raw.clubs;
    const data = raw as CaddyStoredProfile;
    return {
      ...data,
      preparedCourses: Array.isArray(data.preparedCourses) ? data.preparedCourses : [],
    };
  } catch {
    return {};
  }
}

function writeProfile(next: CaddyStoredProfile) {
  localStorage.setItem(CADDY_PROFILE_STORAGE_KEY, JSON.stringify(next));
}

/** Replace entire stored profile (rare; prefer patch helpers) */
export function saveCaddyProfile(updates: Partial<CaddyStoredProfile>) {
  const prev = loadCaddyProfile();
  // When callers pass clubYardages it is always the full map (see mergeClubYardages).
  // Merging into prev would keep removed keys, so deletes/renames would never stick.
  const clubYardages =
    updates.clubYardages !== undefined
      ? { ...updates.clubYardages }
      : prev.clubYardages;
  const next: CaddyStoredProfile = {
    ...prev,
    ...updates,
    clubYardages,
    preparedCourses: updates.preparedCourses ?? prev.preparedCourses,
  };
  writeProfile(next);
}

/** Intake form draft: update user fields without wiping preparedCourses / onboarding */
export function persistIntakeDraft(profile: UserProfile) {
  const prev = loadCaddyProfile();
  writeProfile({
    ...prev,
    handicap: profile.handicap,
    age: profile.age,
    handedness: profile.handedness,
    gender: profile.gender,
    scoringGoal: profile.scoringGoal,
    scoringGoalNote: profile.scoringGoalNote,
    clubYardages:
      profile.clubYardages !== undefined ? profile.clubYardages : prev.clubYardages,
  });
}

/** Match agent/tool storage: lowercase, no spaces (e.g. "7 iron" → "7iron") */
export function normalizeClubKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '');
}

/** Merge yardages from agent tool / call */
export function mergeClubYardages(updates: Record<string, number>) {
  const prev = loadCaddyProfile();
  saveCaddyProfile({
    clubYardages: { ...prev.clubYardages, ...updates },
  });
}

export function removeClubYardage(clubKey: string) {
  const prev = loadCaddyProfile();
  const cy = { ...(prev.clubYardages ?? {}) };
  delete cy[clubKey];
  saveCaddyProfile({ clubYardages: cy });
}

/** Change stored key and/or yards (e.g. rename club). Removes oldKey after applying. */
export function replaceClubYardageEntry(oldKey: string, newClubRaw: string, yards: number) {
  const newKey = normalizeClubKey(newClubRaw);
  if (!newKey || yards < 1 || yards > 400) return;
  const prev = loadCaddyProfile();
  const cy = { ...(prev.clubYardages ?? {}) };
  delete cy[oldKey];
  cy[newKey] = yards;
  saveCaddyProfile({ clubYardages: cy });
}

export function recordPreparedCourse(courseName: string) {
  const prev = loadCaddyProfile();
  const name = courseName.trim();
  if (!name) return;
  const others = (prev.preparedCourses ?? []).filter(
    (c) => c.name.toLowerCase() !== name.toLowerCase()
  );
  const nextList: PreparedCourse[] = [
    { name, preparedAt: new Date().toISOString() },
    ...others,
  ];
  saveCaddyProfile({ preparedCourses: nextList });
}

export function hasCompletedOnboarding(): boolean {
  const p = loadCaddyProfile();
  if (p.onboardingComplete) return true;
  const hasHistory =
    (p.preparedCourses?.length ?? 0) > 0 ||
    Object.keys(p.clubYardages ?? {}).length > 0 ||
    p.handicap != null ||
    p.age != null ||
    p.gender != null;
  if (hasHistory) {
    saveCaddyProfile({ onboardingComplete: true });
    return true;
  }
  return false;
}

export function setOnboardingComplete() {
  saveCaddyProfile({ onboardingComplete: true });
}

/** After intake Next or Skip: persist fields and never force intake again unless user clears data */
export function markOnboardingDone(profile: Partial<UserProfile>) {
  const prev = loadCaddyProfile();
  const clubYardages =
    profile.clubYardages !== undefined
      ? { ...prev.clubYardages, ...profile.clubYardages }
      : prev.clubYardages;
  writeProfile({
    ...prev,
    ...profile,
    clubYardages,
    onboardingComplete: true,
  });
}

export function userProfileFromStorage(): UserProfile {
  const p = loadCaddyProfile();
  return {
    handedness: p.handedness ?? 'right',
    handicap: p.handicap,
    age: p.age,
    gender: p.gender,
    scoringGoal: p.scoringGoal,
    scoringGoalNote: p.scoringGoalNote,
    clubYardages: p.clubYardages,
  };
}

/** After a call ends: refresh session-derived user fields; keep yardage book list and yardages from storage */
export function persistAfterCallEnd(session: UserProfile | null) {
  if (!session) return;
  const fresh = loadCaddyProfile();
  writeProfile({
    ...fresh,
    handicap: session.handicap,
    age: session.age,
    handedness: session.handedness,
    gender: session.gender,
    scoringGoal: session.scoringGoal,
    scoringGoalNote: session.scoringGoalNote,
    clubYardages: fresh.clubYardages,
    preparedCourses: fresh.preparedCourses,
    onboardingComplete: fresh.onboardingComplete ?? true,
  });
}

export function clearCaddyProfile() {
  localStorage.removeItem(CADDY_PROFILE_STORAGE_KEY);
}
