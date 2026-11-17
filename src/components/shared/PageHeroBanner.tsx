import React from 'react';

export interface PageHeroBannerProps {
  imageSrc: string;
  imageAlt?: string;
  tag: string;
  title: string;
  caption: string;
  description: string;
  imagePosition?: string;
}

export const PageHeroBanner: React.FC<PageHeroBannerProps> = ({
  imageSrc,
  imageAlt = 'Dairy illustration',
  tag,
  title,
  caption,
  description,
  imagePosition = 'center 30%',
}) => {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-emerald-200/80 shadow-xs bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 min-h-[140px] flex items-center mb-6">
      <img
        src={imageSrc}
        alt={imageAlt}
        className="absolute inset-y-0 right-0 w-full sm:w-3/5 h-full object-cover pointer-events-none select-none"
        style={{
          objectPosition: imagePosition,
          maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 20%, rgba(0,0,0,1) 55%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 20%, rgba(0,0,0,1) 55%)',
        }}
      />
      <div className="relative z-10 px-5 sm:px-8 py-4 sm:py-5 max-w-xl bg-gradient-to-r from-white/95 via-white/85 sm:via-white/75 to-transparent">
        <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full uppercase tracking-wider mb-1 border border-emerald-200 shadow-2xs">
          {tag}
        </span>
        <h2 className="text-xl sm:text-2xl font-extrabold text-emerald-950 tracking-tight leading-tight">
          {title}
        </h2>
        <p className="text-xs sm:text-sm font-bold text-emerald-700 mt-0.5">
          {caption}
        </p>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed hidden sm:block">
          {description}
        </p>
      </div>
    </div>
  );
};
