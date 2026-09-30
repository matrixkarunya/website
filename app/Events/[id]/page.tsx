// app/Events/[id]/page.tsx
'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  animate,
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from 'framer-motion';
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Image as ImageIcon,
  MapPin,
  Maximize2,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  EventItem,
  MomentImage,
  formatEventDate,
  getWeekday,
  getEventFullUrl,
  getEventAmbientUrl,
  getMomentMasonryUrl,
  getMomentFilmstripUrl,
  getMomentFullUrl,
} from '@/lib/events';
import s from './event.module.css';

// 2 rows of 3 on tablet/desktop; load more in steps of 6 keeps rows complete
// (on phones: 2 columns, 6 photos = 3 full rows)
const INITIAL_MOMENTS = 6;
const LOAD_MORE_STEP = 6;

// ===== participants number counts up once when it scrolls into view =====
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setShown(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 1.4,
      ease: 'easeOut',
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, reduce, value]);

  return <span ref={ref}>{shown.toLocaleString('en-US')}+</span>;
}

// ===== one row of the details list =====
function Detail({
  icon: Icon,
  label,
  sub,
  children,
}: {
  icon: LucideIcon;
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={s.detail}>
      <div className={s.detailIcon}>
        <Icon size={18} />
      </div>
      <div className={s.detailText}>
        <dt className={s.detailLabel}>{label}</dt>
        <dd className={s.detailValue}>{children}</dd>
        {sub && <dd className={s.detailSub}>{sub}</dd>}
      </div>
    </div>
  );
}

// ===== gallery tile: fixed 16:9, blurred backdrop + centered photo =====
function MomentTile({
  moment,
  index,
  alt,
  onOpen,
}: {
  moment: MomentImage;
  index: number;
  alt: string;
  onOpen: (index: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const src = getMomentMasonryUrl(moment.url);

  // Cached images can finish before React attaches onLoad
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <button
      type="button"
      className={`${s.tile} ${loaded || failed ? '' : s.tileLoading}`}
      onClick={() => onOpen(index)}
      aria-label={`Open photo ${index + 1}`}
    >
      {failed ? (
        <span className={s.tileBroken}>
          <ImageIcon size={26} />
        </span>
      ) : (
        <>
          {/* blurred copy fills the whole 16:9 tile */}
          <span
            className={`${s.tileBlur} ${loaded ? s.tileBlurOn : ''}`}
            style={{ backgroundImage: `url("${src}")` }}
            aria-hidden
          />
          {/* the real photo, whole and centered */}
          <img
            ref={imgRef}
            className={`${s.tileImg} ${loaded ? s.tileImgOn : ''}`}
            src={src}
            alt={`${alt}, photo ${index + 1}`}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        </>
      )}
      <span className={s.tileZoom} aria-hidden>
        <Maximize2 size={16} />
      </span>
    </button>
  );
}

// ===== lightbox with filmstrip =====
function Lightbox({
  moments,
  index,
  title,
  onClose,
  onChange,
}: {
  moments: MomentImage[];
  index: number;
  title: string;
  onClose: () => void;
  onChange: (i: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const activeThumb = useRef<HTMLButtonElement>(null);
  const total = moments.length;

  const go = useCallback(
    (dir: number) => onChange((index + dir + total) % total),
    [index, total, onChange]
  );

  useEffect(() => {
    setLoaded(false);
  }, [index]);

  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, [index]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Keyboard + scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [go, onClose]);

  // Preload the neighbours so next/previous feels instant
  useEffect(() => {
    if (total < 2) return;
    [1, -1].forEach((d) => {
      const m = moments[(index + d + total) % total];
      if (m) {
        const img = new window.Image();
        img.src = getMomentFullUrl(m.url);
      }
    });
  }, [index, moments, total]);

  // Keep the active thumbnail in view
  useEffect(() => {
    activeThumb.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [index]);

  const current = moments[index];
  if (!current) return null;

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <motion.div
      className={s.lb}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} photos`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className={s.lbTop}>
        <span>
          Photo {index + 1} of {total}
        </span>
        <button
          ref={closeRef}
          type="button"
          className={s.lbBtn}
          onClick={(e) => {
            stop(e);
            onClose();
          }}
          aria-label="Close photo viewer"
        >
          <X size={20} />
        </button>
      </div>

      <div className={s.lbStage}>
        {total > 1 && (
          <>
            <button
              type="button"
              className={`${s.lbBtn} ${s.lbNav} ${s.lbPrev}`}
              onClick={(e) => {
                stop(e);
                go(-1);
              }}
              aria-label="Previous photo"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              className={`${s.lbBtn} ${s.lbNav} ${s.lbNext}`}
              onClick={(e) => {
                stop(e);
                go(1);
              }}
              aria-label="Next photo"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}

        {!loaded && <div className={s.spinner} />}
        <img
          key={current.publicId || index}
          ref={imgRef}
          className={`${s.lbImg} ${loaded ? s.lbImgOn : ''}`}
          src={getMomentFullUrl(current.url)}
          alt={`${title}, photo ${index + 1}`}
          onClick={stop}
          onLoad={() => setLoaded(true)}
        />
      </div>

      {total > 1 && (
        <div className={s.lbStrip} onClick={stop}>
          <div className={s.lbStripInner}>
            {moments.map((m, i) => (
              <button
                key={m.publicId || m.url}
                ref={i === index ? activeThumb : undefined}
                type="button"
                className={`${s.lbThumb} ${i === index ? s.lbThumbOn : ''}`}
                onClick={() => onChange(i)}
                aria-label={`Go to photo ${i + 1}`}
                aria-current={i === index}
              >
                <img src={getMomentFilmstripUrl(m.url)} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ===== PAGE =====
export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const reduceMotion = useReducedMotion();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(INITIAL_MOMENTS);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [heroLoaded, setHeroLoaded] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);
  const heroRef = useRef<HTMLImageElement>(null);

  // Live event
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setHeroLoaded(false);
    setHeroFailed(false);
    setVisibleCount(INITIAL_MOMENTS);
    const unsubscribe = onSnapshot(
      doc(db, 'events', id),
      (snap) => {
        setEvent(snap.exists() ? ({ id: snap.id, ...snap.data() } as EventItem) : null);
        setLoading(false);
      },
      (error) => {
        console.error('Event listener error:', error);
        setEvent(null);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [id]);

  // Cached hero image can finish before onLoad is attached
  useEffect(() => {
    const el = heroRef.current;
    if (el && el.complete && el.naturalWidth > 0) setHeroLoaded(true);
  }, [event?.id]);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  if (loading) {
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

  if (!event) {
    return (
      <div className={s.fullscreen}>
        <h1 className={s.notFoundTitle}>We couldn&apos;t find that event</h1>
        <p className={s.notFoundText}>It may have been removed, or the link is incorrect.</p>
        <Link href="/Events" className={s.pill}>
          <ArrowLeft size={16} />
          Back to events
        </Link>
      </div>
    );
  }

  const moments = event.moments ?? [];
  const visible = moments.slice(0, visibleCount);
  const remaining = moments.length - visible.length;

  const paragraphs = (event.description ?? '')
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const [first, ...rest] = paragraphs;
  const firstIsLead = !!first && first.length <= 320;

  const hasParticipants = !!event.participants && event.participants > 0;
  const hasDuration = !!event.duration && event.duration.trim().length > 0;

  const glowStyle: CSSProperties = {
    backgroundImage: `url("${getEventAmbientUrl(event.imageUrl)}")`,
  };

  return (
    <div className={s.page}>
      {/* ===== HERO: title, then the WHOLE photo ===== */}
      <header className={s.hero}>
        <div className={s.wrap}>
          <Link href="/Events" className={s.back}>
            <ArrowLeft size={16} />
            All events
          </Link>

          <h1 className={s.title}>{event.title}</h1>

          <div className={s.chips}>
            <span className={s.chip}>{event.category}</span>
            {event.academicYear && (
              <span className={`${s.chip} ${s.chipAccent}`}>{event.academicYear}</span>
            )}
          </div>

          <motion.div
            className={s.stage}
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={`${s.glow} ${heroLoaded ? s.glowOn : ''}`} style={glowStyle} aria-hidden />

            {!heroLoaded && !heroFailed && <div className={s.skeleton} />}

            {heroFailed ? (
              <div className={s.fallback}>Cover photo unavailable</div>
            ) : (
              <div className={s.frame} style={{ display: heroLoaded ? 'block' : 'none' }}>
                <img
                  ref={heroRef}
                  className={s.photo}
                  src={getEventFullUrl(event.imageUrl)}
                  alt={event.title}
                  fetchPriority="high"
                  decoding="async"
                  onLoad={() => setHeroLoaded(true)}
                  onError={() => setHeroFailed(true)}
                />
              </div>
            )}
          </motion.div>
        </div>
      </header>

      {/* ===== BODY ===== */}
      <div className={s.sheet}>
        <div className={s.wrap}>
          {/* details + description: one static block, scrolls together with the page */}
          <div className={s.layout}>
            <aside className={s.aside} aria-label="Event details">
              <h2 className={s.asideTitle}>Event details</h2>
              <dl className={s.details}>
                <Detail icon={CalendarDays} label="Date" sub={getWeekday(event.date)}>
                  {formatEventDate(event.date)}
                </Detail>
                <Detail icon={MapPin} label="Venue">
                  {event.venue}
                </Detail>
                {hasParticipants && (
                  <Detail icon={Users} label="Participants">
                    <CountUp value={event.participants as number} />
                  </Detail>
                )}
                {hasDuration && (
                  <Detail icon={Clock} label="Duration">
                    {event.duration}
                  </Detail>
                )}
              </dl>
            </aside>

            {first && (
              <section className={s.about} aria-labelledby="about-title">
                <h2 id="about-title" className={s.h2}>
                  About this event
                </h2>
                <p className={firstIsLead ? s.lead : s.body}>{first}</p>
                {rest.map((p, i) => (
                  <p key={i} className={s.body}>
                    {p}
                  </p>
                ))}
              </section>
            )}
          </div>

          {/* moments: full width, below everything */}
          <section className={s.moments} aria-labelledby="moments-title">
            <div className={s.sectionHead}>
              <h2 id="moments-title" className={s.h2}>
                Moments
              </h2>
              {moments.length > 0 && (
                <p className={s.count}>
                  {moments.length} {moments.length === 1 ? 'photo' : 'photos'}
                </p>
              )}
            </div>

            {moments.length === 0 ? (
              <div className={s.empty}>
                <ImageIcon size={32} className={s.emptyIcon} />
                <p className={s.emptyTitle}>No photos yet</p>
                <p className={s.emptyText}>
                  Photos from this event will show up here once they&apos;re uploaded.
                </p>
              </div>
            ) : (
              <>
                <div className={s.grid}>
                  {visible.map((m, i) => (
                    <MomentTile
                      key={m.publicId || m.url}
                      moment={m}
                      index={i}
                      alt={event.title}
                      onOpen={setLightboxIndex}
                    />
                  ))}
                </div>

                {remaining > 0 && (
                  <div className={s.loadMoreWrap}>
                    <button
                      type="button"
                      className={s.loadMore}
                      onClick={() => setVisibleCount((n) => n + LOAD_MORE_STEP)}
                    >
                      Show {Math.min(LOAD_MORE_STEP, remaining)} more photos
                    </button>
                    <p className={s.loadMoreInfo}>
                      Showing {visible.length} of {moments.length}
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      <AnimatePresence>
        {lightboxIndex !== null && (
          <Lightbox
            moments={moments}
            index={Math.min(lightboxIndex, Math.max(moments.length - 1, 0))}
            title={event.title}
            onClose={closeLightbox}
            onChange={setLightboxIndex}
          />
        )}
      </AnimatePresence>
    </div>
  );
}