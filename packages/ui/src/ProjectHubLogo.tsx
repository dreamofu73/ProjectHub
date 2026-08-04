import React, { useId } from 'react';

interface ProjectHubLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  variant?: 'solid-cutout' | 'monochrome';
}

/**
 * ProjectHub Modern Vector Logo Icon
 * Concept: Expanded Radiant Hub Shield with 6 Outer Connection Nodes & Single-Tone Gradient.
 */
export function ProjectHubLogo({ 
  size = 26, 
  className = "text-[var(--primary)]", 
  variant = 'solid-cutout',
  ...props 
}: ProjectHubLogoProps) {
  const gradId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      {...props}
    >
      <defs>
        {/* Single-Tone Gradient (Tone-on-tone 100% to 65% opacity) */}
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.65" />
        </linearGradient>
      </defs>

      {/* Expanded Radiant Hub Shield Base */}
      <path
        d="M 12 1.25 L 21.5 5.5 V 13.5 C 21.5 18.5 17 21.8 12 22.8 C 7 21.8 2.5 18.5 2.5 13.5 V 5.5 L 12 1.25 Z"
        fill={`url(#${gradId})`}
      />

      {/* Radiant Inward Channels (6 Convergence Rays) */}
      <path
        d="M 12 2.5 V 11.5 M 4.2 6.5 L 11.5 11.5 M 19.8 6.5 L 12.5 11.5 M 4.8 14 L 11.5 12.2 M 19.2 14 L 12.5 12.2 M 12 21.5 V 12.8"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeOpacity="0.85"
      />

      {/* 6 Outer Connection Nodes (Including Bottom Node) */}
      <circle cx="12" cy="2.5" r="1.1" fill="white" />
      <circle cx="4.2" cy="6.5" r="1.1" fill="white" />
      <circle cx="19.8" cy="6.5" r="1.1" fill="white" />
      <circle cx="4.8" cy="14" r="1.1" fill="white" />
      <circle cx="19.2" cy="14" r="1.1" fill="white" />
      <circle cx="12" cy="21.5" r="1.1" fill="white" />

      {/* Central Core Hub Node */}
      <circle cx="12" cy="12" r="2.3" fill="white" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    </svg>
  );
}
