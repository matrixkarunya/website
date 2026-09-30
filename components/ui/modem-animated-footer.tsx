"use client";
import React from "react";
import Link from "next/link";
import {
  NotepadTextDashed,
  Twitter,
  Linkedin,
  Github,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FooterLink {
  label: string;
  href: string;
}

interface SocialLink {
  icon: React.ReactNode;
  href: string;
  label: string;
}

interface FooterProps {
  brandName?: string;
  brandDescription?: string;
  socialLinks?: SocialLink[];
  navLinks?: FooterLink[];
  creatorName?: string;
  creatorUrl?: string;
  brandIcon?: React.ReactNode;
  secondaryBrandIcon?: React.ReactNode;
  className?: string;
}

export const Footer = ({
  brandName = "YourBrand",
  brandDescription = "Your description here",
  socialLinks = [],
  navLinks = [],
  creatorName,
  creatorUrl,
  brandIcon,
  secondaryBrandIcon,
  className,
}: FooterProps) => {
  return (
    <section className={cn("relative w-full mt-0 overflow-hidden", className)}>

      <footer className="border-t bg-background relative">
        <div className="max-w-7xl flex flex-col justify-between mx-auto min-h-[22rem] sm:min-h-[24rem] md:min-h-[25rem] relative p-4 py-8 pt-12">
          <div className="flex flex-col mb-8 sm:mb-12 md:mb-0 w-full">
            <div className="w-full flex flex-col items-center">
              <div className="space-y-2 flex flex-col items-center flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-3xl font-extrabold tracking-tight" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {brandName}
                  </span>
                </div>
                <p className="text-muted-foreground font-medium text-center w-full max-w-sm sm:w-96 px-4 sm:px-0" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  {brandDescription}
                </p>
              </div>

              {socialLinks.length > 0 && (
                <div className="flex mb-6 mt-3 gap-4">
                  {socialLinks.map((link, index) => (
                    <Link
                      key={index}
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <div className="w-6 h-6 hover:scale-110 duration-300">
                        {link.icon}
                      </div>
                      <span className="sr-only">{link.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Copyright section - with proper spacing from logo */}
          <div className="mt-auto pt-20 md:pt-16 flex flex-col gap-2 md:gap-1 items-center justify-center md:flex-row md:items-center md:justify-between px-4 md:px-0">
            <p className="text-xs md:text-sm text-muted-foreground text-center md:text-left font-medium" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              ©{new Date().getFullYear()} {brandName} Karunya. All rights reserved.
            </p>
            {creatorName && creatorUrl && (
              <nav className="flex gap-4">
                <Link
                  href={creatorUrl}
                  target="_blank"
                  className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                >
                  Developed by <span className="font-bold">{creatorName}</span>
                </Link>
              </nav>
            )}
          </div>
        </div>

        {/* Large background text */}
        <div 
          className="bg-gradient-to-b from-foreground/20 via-foreground/10 to-transparent bg-clip-text text-transparent leading-none absolute left-1/2 -translate-x-1/2 bottom-36 sm:bottom-30 md:bottom-24 font-black tracking-tighter pointer-events-none select-none text-center px-2"
          style={{
            fontSize: 'clamp(4rem, 15vw, 8rem)',
            maxWidth: '90vw',
            fontWeight: '900',
            fontFamily: 'Inter, system-ui, sans-serif'
          }}
        >
          {brandName.toUpperCase()}
        </div>

        {/* Bottom logos - TWO LOGOS SIDE BY SIDE */}
        <div className="absolute bottom-24 md:bottom-16 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 md:gap-6">
          {/* First Logo */}
          <div className="hover:scale-105 transition-transform duration-300">
            {brandIcon || (
              <NotepadTextDashed className="w-12 sm:w-14 md:w-20 h-12 sm:h-14 md:h-20 text-foreground" />
            )}
          </div>
          
          {/* Second Logo */}
          {secondaryBrandIcon && (
            <div className="hover:scale-105 transition-transform duration-300">
              {secondaryBrandIcon}
            </div>
          )}
        </div>

        {/* Bottom line */}
        <div className="absolute bottom-28 sm:bottom-26 md:bottom-22 backdrop-blur-sm h-1 bg-gradient-to-r from-transparent via-border to-transparent w-full left-1/2 -translate-x-1/2"></div>

        {/* Bottom shadow */}
        <div className="bg-gradient-to-t from-background via-background/80 blur-[1em] to-background/40 absolute bottom-24 md:bottom-20 w-full h-20"></div>
      </footer>
    </section>
  );
};
