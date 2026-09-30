// components/admin/TeamMemberCard.tsx
'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { TeamMember } from '@/app/admin/team/page';
import { getThumbnailUrl } from '@/lib/cloudinary';
import { Edit2, Trash2, Archive } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';

interface TeamMemberCardProps {
  member: TeamMember;
  onEdit: (member: TeamMember) => void;
  onMoveToPast?: (member: TeamMember) => void;
  onDelete: (member: TeamMember) => void;
  isPast?: boolean;
}

export default function TeamMemberCard({
  member,
  onEdit,
  onMoveToPast,
  onDelete,
  isPast = false,
}: TeamMemberCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const initialClipPath = 'circle(48px at 72px 72px)';
  const hoverClipPath = 'circle(150% at 72px 72px)';

  useGSAP(
    () => {
      if (overlayRef.current) {
        gsap.set(overlayRef.current, { clipPath: initialClipPath });
      }
    },
    { scope: containerRef }
  );

  const handleMouseEnter = () => {
    if (overlayRef.current) {
      gsap.killTweensOf(overlayRef.current);
      gsap.to(overlayRef.current, {
        clipPath: hoverClipPath,
        duration: 0.7,
        ease: 'expo.inOut',
      });
    }
  };

  const handleMouseLeave = () => {
    if (overlayRef.current) {
      gsap.killTweensOf(overlayRef.current);
      gsap.to(overlayRef.current, {
        clipPath: initialClipPath,
        duration: 1.2,
        ease: 'expo.out(1, 1)',
      });
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative w-full max-w-[300px] h-[380px] mx-auto overflow-hidden rounded-3xl border-2 border-white/20"
    >
      {/* Base Card */}
      <div className="bg-[#1a1a1a] p-7 h-full flex flex-col">
        {/* Profile Image */}
        <div className="mb-5 flex-shrink-0">
          <div className="relative w-24 h-24 rounded-full border-3 border-white/20 overflow-hidden bg-gradient-to-br from-slate-700/50 to-slate-800/50">
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-700/50 to-slate-800/50 animate-pulse" />
            )}
            <Image
              src={getThumbnailUrl(member.imageUrl)}
              alt={member.name}
              fill
              className={`object-cover transition-all duration-500 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              loading="lazy"
              sizes="96px"
            />
          </div>
        </div>

        {/* Location */}
        <p className="text-white/60 text-xs mb-3 flex-shrink-0">
          {member.registerId || 'Bengaluru, India'}
        </p>

        {/* Name */}
        <h3 className="text-white text-2xl font-bold mb-4 flex-shrink-0 line-clamp-1">
          {member.name}
        </h3>

        {/* Bio/Description - Fixed height container */}
        <div className="flex-shrink-0 mb-5" style={{ height: '40px' }}>
          <p className="text-white/80 text-sm leading-relaxed line-clamp-2">
            {member.description}
          </p>
        </div>

        {/* Spacer */}
        <div className="flex-grow" />

        {/* Social Icons Placeholder */}
        <div className="flex gap-3 flex-shrink-0">
          <div className="w-4 h-4 text-white/40">
            <Edit2 className="w-4 h-4" />
          </div>
          <div className="w-4 h-4 text-white/40">
            <Archive className="w-4 h-4" />
          </div>
          <div className="w-4 h-4 text-white/40">
            <Trash2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Overlay Card */}
      <div ref={overlayRef} className="absolute inset-0 bg-[#1a1a1a]">
        <div className="p-7 h-full flex flex-col">
          {/* Profile Image */}
          <div className="mb-5 flex-shrink-0">
            <div className="relative w-24 h-24 rounded-full border-3 border-white/20 overflow-hidden bg-gradient-to-br from-slate-700/50 to-slate-800/50">
              <Image
                src={getThumbnailUrl(member.imageUrl)}
                alt={member.name}
                fill
                className="object-cover"
                loading="lazy"
                sizes="96px"
              />
            </div>
          </div>

          {/* Location */}
          <p className="text-white/60 text-xs mb-3 flex-shrink-0">
            {member.registerId || 'Bengaluru, India'}
          </p>

          {/* Name */}
          <h3 className="text-white text-2xl font-bold mb-4 flex-shrink-0 line-clamp-1">
            {member.name}
          </h3>

          {/* Bio/Description - Fixed height container */}
          <div className="flex-shrink-0 mb-5" style={{ height: '40px' }}>
            <p className="text-white/80 text-sm leading-relaxed line-clamp-2">
              {member.description}
            </p>
          </div>

          {/* Spacer */}
          <div className="flex-grow" />

          {/* Action Icons */}
          <div className="flex gap-3 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(member);
              }}
              className="text-white/60 hover:text-white transition-colors"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            {!isPast && member.isCurrent && onMoveToPast && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveToPast(member);
                }}
                className="text-white/60 hover:text-white transition-colors"
                title="Archive"
              >
                <Archive className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(member);
              }}
              className="text-white/60 hover:text-white transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Order Badge */}
      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white/80 px-2 py-0.5 rounded-full text-[10px] font-medium border border-white/20 z-10">
        #{member.order}
      </div>
    </div>
  );
}
