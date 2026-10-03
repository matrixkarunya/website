'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { doc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Check, ExternalLink, Link2, Mail, Users } from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  ACHIEVEMENTS_COLLECTION,
  Achievement,
  TeamMemberEntry,
  Winner,
  formatDate,
  initialsOf,
  toAchievement,
} from '@/lib/hallOfFame';
import s from './achievement.module.css';

/** Up to this many winners: list beside the story. More: story on top, winners grid below. */
const GRID_THRESHOLD = 6;

function LinkedInIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

function Photo({ name, src, team }: { name: string; src: string; team?: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, [src]);

  const cls = `${s.photo} ${team ? s.photoTeam : s.photoPerson}`;

  if (!src || failed) {
    return (
      <div className={cls}>
        <div className={s.photoFallback}>{team ? <Users size={28} /> : initialsOf(name)}</div>
      </div>
    );
  }

  return (
    <div className={cls}>
      {team && <span className={s.photoBlur} style={{ backgroundImage: `url("${src}")` }} aria-hidden />}
      <img
        ref={ref}
        className={team ? s.imgContain : s.imgCover}
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

/** Icons stay on a single line (flex nowrap). Each renders only if filled in. */
type Contactable = { name: string; linkedinUrl?: string; email?: string };

function Contacts({ winner }: { winner: Contactable }) {
  if (!winner.linkedinUrl && !winner.email) return null;
  return (
    <div className={s.contacts}>
      {winner.linkedinUrl && (
        <a
          href={winner.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={s.iconBtn}
          aria-label={`${winner.name} on LinkedIn`}
          title="LinkedIn"
        >
          <LinkedInIcon />
        </a>
      )}
      {winner.email && (
        <a href={`mailto:${winner.email}`} className={s.iconBtn} aria-label={`Email ${winner.name}`} title={winner.email}>
          <Mail size={15} />
        </a>
      )}
    </div>
  );
}

const INLINE_MEMBERS_MAX = 2;

/** Member photo when there is one (and it loads); initials otherwise. */
function MemberAvatar({ m }: { m: TeamMemberEntry }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={s.memberDot} aria-hidden>
      {m.imageUrl && !failed ? (
        <img
          className={s.memberImg}
          src={m.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        initialsOf(m.name)
      )}
    </span>
  );
}

function MemberItem({ m }: { m: TeamMemberEntry }) {
  return (
    <li className={s.member}>
      <MemberAvatar m={m} />
      <span className={s.memberText}>
        <span className={s.memberName}>{m.name}</span>
        {m.detail && <span className={s.memberDetail}>{m.detail}</span>}
      </span>
      <Contacts winner={m} />
    </li>
  );
}

/** Small teams: members listed under the team name. */
function Members({ winner }: { winner: Winner }) {
  if (winner.members.length === 0 || winner.members.length > INLINE_MEMBERS_MAX) return null;
  return (
    <>
      <p className={s.membersLabel}>Team members · {winner.members.length}</p>
      <ul className={s.members}>
        {winner.members.map((m, i) => (
          <MemberItem key={`${m.name}-${i}`} m={m} />
        ))}
      </ul>
    </>
  );
}

/* ----- people: list row (few) ----- */

function PersonRow({ winner, showRank }: { winner: Winner; showRank: boolean }) {
  return (
    <div className={s.winner}>
      <Photo name={winner.name} src={winner.imageUrl} />
      <div className={s.winnerText}>
        {showRank && winner.rank && <span className={s.rank}>{winner.rank}</span>}
        <h3 className={s.name}>{winner.name}</h3>
        {winner.detail && <p className={s.detail}>{winner.detail}</p>}
        <Contacts winner={winner} />
      </div>
    </div>
  );
}

/* ----- people: grid tile (many) ----- */

function PersonTile({ winner, showRank }: { winner: Winner; showRank: boolean }) {
  return (
    <div className={s.tile}>
      <Photo name={winner.name} src={winner.imageUrl} />
      <div className={s.tileText}>
        {showRank && winner.rank && <span className={s.rank}>{winner.rank}</span>}
        <h3 className={s.tileName}>{winner.name}</h3>
        {winner.detail && <p className={s.detail}>{winner.detail}</p>}
        <Contacts winner={winner} />
      </div>
    </div>
  );
}

/* ----- team row: photo, name, title (members inline only when 2 or fewer) ----- */

function TeamRow({ winner, showRank }: { winner: Winner; showRank: boolean }) {
  return (
    <div className={`${s.winner} ${s.winnerTeam}`}>
      <Photo name={winner.name} src={winner.imageUrl} team />
      <div className={s.winnerText}>
        {showRank && winner.rank && <span className={s.rank}>{winner.rank}</span>}
        <h3 className={s.name}>{winner.name}</h3>
        {winner.detail && <p className={s.detail}>{winner.detail}</p>}
        <Members winner={winner} />
      </div>
    </div>
  );
}

/* ─────────────────────────────── Page ─────────────────────────────── */

export default function AchievementDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const reduceMotion = useReducedMotion();

  const [achievement, setAchievement] = useState<Achievement | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [copied, setCopied] = useState(false);

  const [heroLoaded, setHeroLoaded] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);
  const heroRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!id) return;
    setState('loading');
    setHeroLoaded(false);
    setHeroFailed(false);
    return onSnapshot(
      doc(db, ACHIEVEMENTS_COLLECTION, id),
      (snap) => {
        if (!snap.exists()) {
          setAchievement(null);
          setState('missing');
          return;
        }
        setAchievement(toAchievement(snap.id, snap.data()));
        setState('ready');
      },
      (err) => {
        console.error('Error loading achievement:', err);
        setState('error');
      }
    );
  }, [id]);

  useEffect(() => {
    const el = heroRef.current;
    if (el && el.complete && el.naturalWidth > 0) setHeroLoaded(true);
  }, [achievement?.id, achievement?.coverImageUrl]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (state === 'loading') {
    return (
      <div className={s.fullscreen}>
        <div className={s.dots}>
          <span className={s.dot} />
          <span className={s.dot} />
          <span className={s.dot} />
        </div>
      </div>
    );
  }

  if (state !== 'ready' || !achievement) {
    return (
      <div className={s.fullscreen}>
        <h1 className={s.notFoundTitle}>
          {state === 'missing' ? 'We couldn’t find that achievement' : 'We couldn’t load this achievement'}
        </h1>
        <p className={s.notFoundText}>
          {state === 'missing'
            ? 'It may have been removed, or the link is incorrect.'
            : 'Check your connection and try again.'}
        </p>
        <Link href="/hall-of-fame" className={s.pill}>
          <ArrowLeft size={16} />
          Back to Hall of Fame
        </Link>
      </div>
    );
  }

  const a = achievement;
  const hasCover = !!a.coverImageUrl && !heroFailed;

  const paragraphs = a.story
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const [first, ...rest] = paragraphs;
  const firstIsLead = !!first && first.length <= 320;

  const people = a.winners.filter((w) => w.kind !== 'team');
  const teams = a.winners.filter((w) => w.kind === 'team');
  const hasWinners = a.winners.length > 0;
  const useGrid = people.length > GRID_THRESHOLD;
  const twoColumns = hasWinners && !!first && !useGrid;
  const bigTeams = teams.filter((w) => w.members.length > INLINE_MEMBERS_MAX);
  const winnersHeading =
    teams.length === a.winners.length
      ? teams.length === 1 ? 'Winning team' : 'Winning teams'
      : a.winners.length === 1 ? 'Winner' : 'Winners';
  const peopleHeading = people.length === 1 ? 'Winner' : 'Winners';

  const glowStyle: CSSProperties = { backgroundImage: `url("${a.coverImageUrl}")` };
  const eyebrow = [a.category, a.date ? formatDate(a.date) : '', a.organizer].filter(Boolean);

  const storyEl = first ? (
    <section className={`${s.story} ${useGrid ? s.storyWide : ''}`} aria-labelledby="story-title">
      <h2 id="story-title" className={s.h2}>
        The story
      </h2>
      <div className={s.storyBody}>
        <p className={firstIsLead ? s.lead : s.body}>{first}</p>
        {rest.map((p, i) => (
          <p key={i} className={s.body}>
            {p}
          </p>
        ))}
      </div>
    </section>
  ) : null;

  return (
    <div className={s.page}>
      <header className={s.hero}>
        <div className={s.wrap}>
          <div className={s.topRow}>
            <Link href="/hall-of-fame" className={s.back}>
              <ArrowLeft size={16} />
              Hall of Fame
            </Link>
            <button type="button" onClick={copyLink} className={s.copy}>
              {copied ? <Check size={15} /> : <Link2 size={15} />}
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>

          {eyebrow.length > 0 && (
            <p className={s.eyebrow}>
              {eyebrow.map((e, i) => (
                <span key={i}>{e}</span>
              ))}
            </p>
          )}
          <h1 className={s.title}>{a.title}</h1>
          {a.summary && <p className={s.summary}>{a.summary}</p>}

          {hasCover && (
            <motion.div
              className={s.stage}
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className={`${s.glow} ${heroLoaded ? s.glowOn : ''}`} style={glowStyle} aria-hidden />
              {!heroLoaded && <div className={s.skeleton} />}
              <div className={s.frame} style={{ display: heroLoaded ? 'block' : 'none' }}>
                <img
                  ref={heroRef}
                  className={s.cover}
                  src={a.coverImageUrl}
                  alt={a.title}
                  fetchPriority="high"
                  decoding="async"
                  onLoad={() => setHeroLoaded(true)}
                  onError={() => setHeroFailed(true)}
                />
              </div>
            </motion.div>
          )}
        </div>
      </header>

      <div className={s.sheet}>
        <div className={s.wrap}>
          {useGrid ? (
            <>
              {storyEl}
              <section className={s.gridSection} aria-labelledby="winners-title">
                <div className={s.gridHead}>
                  <h2 id="winners-title" className={s.h2}>
                    {peopleHeading}
                  </h2>
                  <span className={s.count}>{people.length}</span>
                </div>
                <div className={s.grid}>
                  {people.map((w) => (
                    <PersonTile key={w.id} winner={w} showRank={a.showRanks} />
                  ))}
                </div>
                {teams.length > 0 && (
                  <div className={s.teamStrip}>
                    {teams.map((w) => (
                      <TeamRow key={w.id} winner={w} showRank={a.showRanks} />
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            (hasWinners || storyEl) && (
              <div className={`${s.layout} ${twoColumns ? '' : s.layoutSolo}`}>
                {hasWinners && (
                  <aside className={s.aside} aria-label={winnersHeading}>
                    <h2 className={s.asideTitle}>{winnersHeading}</h2>
                    <div className={s.list}>
                      {a.winners.map((w) =>
                        w.kind === 'team' ? (
                          <TeamRow key={w.id} winner={w} showRank={a.showRanks} />
                        ) : (
                          <PersonRow key={w.id} winner={w} showRank={a.showRanks} />
                        )
                      )}
                    </div>
                  </aside>
                )}
                {storyEl}
              </div>
            )
          )}

          {/* Teams with more than 2 members: full-width grid, 5 per row */}
          {bigTeams.map((w) => (
            <section key={w.id} className={s.membersSection} aria-label={`${w.name} team members`}>
              <div className={s.gridHead}>
                <h2 className={s.h2}>{bigTeams.length > 1 ? `${w.name} · Team members` : 'Team members'}</h2>
                <span className={s.count}>{w.members.length}</span>
              </div>
              <ul className={s.membersGrid}>
                {w.members.map((m, i) => (
                  <MemberItem key={`${m.name}-${i}`} m={m} />
                ))}
              </ul>
            </section>
          ))}

          {a.linkUrl && (
            <div className={s.actions}>
              <a href={a.linkUrl} target="_blank" rel="noopener noreferrer" className={s.cta}>
                Read more
                <ExternalLink size={16} />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}