// components/admin/EventCard.tsx
import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Pencil, Trash2, MapPin, Calendar, Images, Users, Clock } from 'lucide-react';
import { EventItem, formatEventDate, getEventThumbUrl } from '@/lib/events';

interface EventCardProps {
  event: EventItem;
  onEdit: (event: EventItem) => void;
  onMoments: (event: EventItem) => void;
  onDelete: (event: EventItem) => void;
}

export default function EventCard({ event, onEdit, onMoments, onDelete }: EventCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Handle cached images that finished loading before hydration
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);

  const momentCount = event.moments?.length ?? 0;

  return (
    <div className="group bg-white/5 backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-2xl overflow-hidden transition-all shadow-lg hover:shadow-xl">
      {/* Image */}
      <div className="relative aspect-[16/10] w-full bg-white/5">
        {!loaded && !failed && (
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 animate-pulse" />
        )}

        {failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-900/40 to-purple-900/40">
            <span className="text-[10px] tracking-widest uppercase text-white/40">
              Image unavailable
            </span>
          </div>
        )}

        {!failed && (
          <Image
            ref={imgRef}
            src={getEventThumbUrl(event.imageUrl)}
            alt={event.title}
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`object-cover transition-opacity duration-500 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

        <span className="absolute top-3 left-3 px-3 py-1 text-[10px] font-semibold tracking-wider uppercase bg-black/40 backdrop-blur-md border border-white/20 rounded-full text-white">
          {event.category}
        </span>
        <span className="absolute top-3 right-3 px-3 py-1 text-[10px] font-semibold bg-blue-500/20 backdrop-blur-md border border-blue-400/30 rounded-full text-blue-200">
          {event.academicYear}
        </span>

        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-black/50 backdrop-blur-md border border-white/20 rounded-full text-white">
          <Images className="w-3 h-3" />
          {momentCount} photo{momentCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Details */}
      <div className="p-5">
        <h3 className="text-lg font-bold text-white mb-3 line-clamp-1">{event.title}</h3>

        <div className="space-y-1.5 text-sm text-white/60 mb-5">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span>{formatEventDate(event.date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="line-clamp-1">{event.venue}</span>
          </div>
          {(event.participants || event.duration) && (
            <div className="flex items-center gap-4 text-white/50">
              {event.participants ? (
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {event.participants}+
                </span>
              ) : null}
              {event.duration ? (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {event.duration}
                </span>
              ) : null}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onEdit(event)}
            className="flex items-center justify-center gap-1.5 px-2 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white text-sm rounded-lg transition-all font-medium"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={() => onMoments(event)}
            className="flex items-center justify-center gap-1.5 px-2 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-400/20 hover:border-blue-400/40 text-blue-200 text-sm rounded-lg transition-all font-medium"
          >
            <Images className="w-3.5 h-3.5" />
            Moments
          </button>
          <button
            onClick={() => onDelete(event)}
            className="flex items-center justify-center gap-1.5 px-2 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-300 text-sm rounded-lg transition-all font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}