// lib/hallOfFame.ts
//
// Shared types, constants and helpers for the Hall of Fame.
//
// Data model: one document in `achievements` = one event / title. It holds a
// list of winners, and each winner is either one person or a team. That one
// shape covers all three cases:
//   - individual win            -> 1 winner, kind "individual"
//   - one event, many winners   -> N winners, kind "individual"
//   - team win                  -> 1 winner, kind "team" (with members)
//
// Firestore rejects `undefined`, so every optional text field is stored as ""
// and every optional list as [].

export const ACHIEVEMENTS_COLLECTION = 'achievements';

export const CATEGORIES = [
  'Hackathon',
  'Competition',
  'Research',
  'Sports',
  'Arts and culture',
  'Academics',
  'Other',
];

// Suggestions only; admins can type any rank they like
export const RANK_SUGGESTIONS = [
  '1st place',
  '2nd place',
  '3rd place',
  'Winner',
  'Runner-up',
  'Finalist',
  'Special mention',
];

export interface TeamMemberEntry {
  name: string;
  detail: string; // role / batch, optional
  imageUrl: string; // optional photo, "" when none
  imagePublicId: string; // Cloudinary id of that photo, "" when none
  linkedinUrl: string; // optional
  email: string; // optional
}

export interface Winner {
  id: string;
  kind: 'individual' | 'team';
  name: string; // person name or team name
  rank: string; // only shown when the achievement has showRanks on
  detail: string; // role / batch for a person, project or note for a team
  imageUrl: string;
  imagePublicId: string;
  linkedinUrl: string; // optional, individuals only
  email: string; // optional, individuals only
  members: TeamMemberEntry[]; // teams only
}

export interface Achievement {
  id: string;
  title: string; // event or competition name
  organizer: string;
  category: string;
  date: string; // YYYY-MM-DD
  summary: string; // one line for cards
  story: string; // full text for the detail page
  coverImageUrl: string;
  coverImagePublicId: string;
  linkUrl: string;
  showRanks: boolean;
  featured: boolean;
  consent: boolean;
  winners: Winner[];
}

/** Turns a raw Firestore document into a fully-populated Achievement. */
export function toAchievement(id: string, data: Record<string, any>): Achievement {
  return {
    id,
    title: data.title ?? '',
    organizer: data.organizer ?? '',
    category: data.category ?? 'Other',
    date: data.date ?? '',
    summary: data.summary ?? '',
    story: data.story ?? '',
    coverImageUrl: data.coverImageUrl ?? '',
    coverImagePublicId: data.coverImagePublicId ?? '',
    linkUrl: data.linkUrl ?? '',
    showRanks: !!data.showRanks,
    featured: !!data.featured,
    consent: !!data.consent,
    winners: Array.isArray(data.winners)
      ? data.winners.map((w: any, i: number) => ({
          id: w.id ?? `w${i}`,
          kind: w.kind === 'team' ? 'team' : 'individual',
          name: w.name ?? '',
          rank: w.rank ?? '',
          detail: w.detail ?? '',
          imageUrl: w.imageUrl ?? '',
          imagePublicId: w.imagePublicId ?? '',
          linkedinUrl: w.linkedinUrl ?? '',
          email: w.email ?? '',
          members: Array.isArray(w.members)
            ? w.members.map((m: any) => ({
                name: m.name ?? '',
                detail: m.detail ?? '',
                // older documents have no member photos, so default to ""
                imageUrl: m.imageUrl ?? '',
                imagePublicId: m.imagePublicId ?? '',
                linkedinUrl: m.linkedinUrl ?? '',
                email: m.email ?? '',
              }))
            : [],
        }))
      : [],
  };
}

export function formatDate(date: string) {
  if (!date) return '';
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function yearOf(date: string) {
  return date.slice(0, 4) || 'Undated';
}

export function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  );
}

/** Lets admins type "example.com"; stores a full https:// link (or ""). */
export function normalizeUrl(value: string) {
  const v = value.trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/** How many people are recognised: 1 per individual, the member count per team. */
export function countPeople(a: Achievement) {
  return a.winners.reduce(
    (sum, w) => sum + (w.kind === 'team' ? Math.max(w.members.length, 1) : 1),
    0
  );
}

/** Short text for cards: who won, and a line of context. */
export function summarizeWinners(a: Achievement): { primary: string; secondary: string } {
  const n = a.winners.length;
  if (n === 0) return { primary: '', secondary: '' };
  if (n === 1) {
    const w = a.winners[0];
    return {
      primary: w.name,
      secondary:
        w.kind === 'team'
          ? w.members.length > 0
            ? `Team of ${w.members.length}`
            : 'Team'
          : w.detail,
    };
  }
  const names = a.winners.slice(0, 2).map((w) => w.name).join(', ');
  return { primary: `${n} winners`, secondary: n > 2 ? `${names} and more` : names };
}

/**
 * The people to show in a small avatar stack on cards.
 * Individuals show as themselves. A team shows its members (with their photos, or
 * initials when they have none), because that reads better than one group photo.
 * A team with no members listed falls back to the team itself.
 * People who have a photo come first so the stack looks good.
 */
export function stackPeople(a: Pick<Achievement, 'winners'>): Winner[] {
  const people: Winner[] = a.winners.flatMap((w, wi) =>
    w.kind === 'team' && w.members.length > 0
      ? w.members.map((m, mi) => ({
          id: `${w.id || `w${wi}`}-m${mi}`,
          kind: 'individual' as const,
          name: m.name,
          rank: '',
          detail: m.detail,
          imageUrl: m.imageUrl,
          imagePublicId: m.imagePublicId,
          linkedinUrl: m.linkedinUrl,
          email: m.email,
          members: [],
        }))
      : [w]
  );
  // Array.prototype.sort is stable, so people keep their order within each group
  return [...people].sort((x, y) => Number(!!y.imageUrl) - Number(!!x.imageUrl));
}

/** Every Cloudinary image an achievement owns (cover, winner photos and team member photos). */
export function collectImageIds(a: Pick<Achievement, 'coverImagePublicId' | 'winners'>) {
  return [
    a.coverImagePublicId,
    ...a.winners.flatMap((w) => [w.imagePublicId, ...w.members.map((m) => m.imagePublicId)]),
  ].filter(Boolean);
}

/** Best-effort cleanup; a failed image delete should never block the user. */
export function removeCloudinaryImages(ids: string[]) {
  ids
    .filter(Boolean)
    .forEach((publicId) => {
      fetch('/api/cloudinary/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId }),
      }).catch(() => {});
    });
}