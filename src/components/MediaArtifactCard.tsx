import React, { useState } from 'react';
import { Play, Layers, ExternalLink, Disc3, BookOpen, Film, Smartphone, Tv } from 'lucide-react';

export type ArtifactType = 'book' | 'vinyl' | 'movie' | 'app' | 'video' | 'default';

export interface MediaArtifactCardProps {
  id: string;
  title: string;
  authorOrCreator?: string;
  categoryOrType: string;
  imageUrl?: string;
  fallbackIcon?: React.ReactNode;
  isCollection?: boolean;
  collectionCount?: number;
  isPlayable?: boolean;
  rating?: number;
  statusBadge?: React.ReactNode;
  review?: string;
  actionLabel?: string;
  onReviewClick?: (e: React.MouseEvent) => void;
  onImageError?: () => void;
}

export function resolveArtifactType(categoryOrType: string, isWidescreenVideo: boolean): ArtifactType {
  const norm = (categoryOrType || '').toLowerCase().trim();
  if (isWidescreenVideo || norm === 'video & media' || norm === 'video') {
    return 'video';
  }
  if (norm === 'books' || norm === 'book') {
    return 'book';
  }
  if (norm === 'podcasts' || norm === 'podcast' || norm === 'music') {
    return 'vinyl';
  }
  if (norm === 'movies' || norm === 'movie' || norm === 'shows' || norm === 'series') {
    return 'movie';
  }
  if (norm === 'apps' || norm === 'app') {
    return 'app';
  }
  return 'default';
}

export const MediaArtifactCard: React.FC<MediaArtifactCardProps> = ({
  id,
  title,
  authorOrCreator,
  categoryOrType,
  imageUrl,
  fallbackIcon,
  isCollection = false,
  collectionCount = 0,
  isPlayable = false,
  rating,
  statusBadge,
  review,
  actionLabel,
  onReviewClick,
  onImageError,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const isWidescreen =
    !isCollection &&
    (categoryOrType.toLowerCase().includes('video') ||
      (imageUrl && (imageUrl.includes('youtube') || imageUrl.includes('vimeo'))));

  const artifactType = resolveArtifactType(categoryOrType, isWidescreen);

  const handleImgError = () => {
    setImgFailed(true);
    if (onImageError) onImageError();
  };

  const renderCoverImage = (className = "w-full h-full object-cover") => {
    if (imageUrl && !imgFailed) {
      return (
        <img
          src={imageUrl}
          alt={title}
          className={className}
          referrerPolicy="no-referrer"
          onError={handleImgError}
        />
      );
    }
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-ink/[0.04] to-ink/[0.12] text-ink/60">
        <div className="text-accent mb-2.5 transform group-hover:scale-110 transition-transform duration-300">
          {fallbackIcon || (
            artifactType === 'book' ? <BookOpen size={24} /> :
            artifactType === 'vinyl' ? <Disc3 size={24} /> :
            artifactType === 'movie' ? <Film size={24} /> :
            artifactType === 'app' ? <Smartphone size={24} /> :
            artifactType === 'video' ? <Tv size={24} /> :
            <Layers size={24} />
          )}
        </div>
        <p className="font-serif text-[11px] font-bold line-clamp-3 leading-snug px-1">
          {title}
        </p>
        {authorOrCreator && (
          <p className="text-[7.5px] uppercase tracking-widest text-ink/40 mt-1.5 font-black truncate max-w-full">
            {authorOrCreator}
          </p>
        )}
      </div>
    );
  };

  /* -------------------------------------------------------------
     1. BOOK: Real 3D Hardcover with Spine, Page Thickness & Tilt
     ------------------------------------------------------------- */
  if (artifactType === 'book') {
    return (
      <div className="relative w-full aspect-[2/3] [perspective:1200px] select-none group/book">
        {/* Contact Shadow on Shelf */}
        <div className="absolute -bottom-2.5 left-3.5 right-1.5 h-3.5 bg-black/45 dark:bg-black/60 blur-md rounded-full transition-all duration-500 group-hover:scale-x-105 group-hover:opacity-80 group-hover:translate-y-1 pointer-events-none" />

        {/* 3D Book Container */}
        <div className="relative w-full h-full transition-transform duration-500 ease-out transform-gpu [transform-style:preserve-3d] group-hover:[transform:rotateY(-15deg)_rotateX(5deg)_scale(1.02)]">
          {/* Stacked Pages Block (Right and Bottom Edge) */}
          <div
            className="absolute -right-2 top-1.5 bottom-1.5 w-2 rounded-r-xs z-0 shadow-[inset_1px_0_2px_rgba(0,0,0,0.4),1px_1px_3px_rgba(0,0,0,0.3)] pointer-events-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to bottom, #f3eedc 0px, #f3eedc 2px, #d5c8a8 3px, #d5c8a8 4px)',
            }}
          />

          {/* Hardcover Front Board (extends 2px past pages) */}
          <div className="relative w-full h-full rounded-r-md rounded-l-xs overflow-hidden bg-surface shadow-xl z-10 border border-black/20 dark:border-white/10">
            {renderCoverImage()}

            {/* Realistic Spine Hinge Crease Line (16px from left edge) */}
            <div className="absolute left-3.5 sm:left-4 top-0 bottom-0 w-[2px] bg-gradient-to-r from-black/50 via-white/15 to-black/35 z-20 pointer-events-none" />

            {/* Left Spine Curve Shadow (0-16px from left) */}
            <div className="absolute left-0 top-0 bottom-0 w-3.5 sm:w-4 bg-gradient-to-r from-black/60 via-black/15 to-transparent z-20 pointer-events-none rounded-l-xs" />

            {/* Top & Right Edge Highlights on Book Cloth */}
            <div className="absolute inset-0 border-t border-r border-white/25 pointer-events-none z-20 rounded-r-md" />

            {/* Hardcover Light Glint */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.08] to-transparent z-20 pointer-events-none group-hover:opacity-100 transition-opacity duration-500" />

            {/* Subtle Category Badge on Hover */}
            <div className="absolute top-3 left-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/15 text-white text-[7px] uppercase tracking-widest font-black flex items-center gap-1.5">
                <BookOpen size={11} className="text-accent" />
                <span>Bok</span>
              </div>
            </div>

            {/* Persistent Status Badge (Top-Right) */}
            {statusBadge && <div className="absolute top-3 right-3 z-30">{statusBadge}</div>}

            {/* Hover Reveal Details */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-4 z-30">
              <div className="transform translate-y-3 group-hover:translate-y-0 transition-transform duration-500">
                {authorOrCreator && (
                  <p className="text-white/60 text-[8px] uppercase tracking-[0.2em] font-black mb-1 truncate">
                    {authorOrCreator}
                  </p>
                )}
                <h4 className="text-white font-serif text-xs sm:text-sm font-bold leading-snug line-clamp-2">
                  {title}
                </h4>
                {review && (
                  <p className="text-white/80 font-serif italic text-[10px] line-clamp-2 mt-1">
                    «{review}»
                  </p>
                )}
                <div className="mt-2.5 pt-2 border-t border-white/15 flex items-center justify-between text-white/50 text-[7.5px] uppercase tracking-widest font-black">
                  <span>{actionLabel || 'Se detaljer'}</span>
                  <ExternalLink size={10} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------
     2. VINYL: Cardboard Jacket with Animated Slide-Out & Spinning Record
     ------------------------------------------------------------- */
  if (artifactType === 'vinyl') {
    return (
      <div className="relative w-full aspect-square select-none group/vinyl">
        {/* Soft Shadow */}
        <div className="absolute -bottom-2.5 left-4 right-4 h-3.5 bg-black/40 blur-md rounded-full pointer-events-none" />

        {/* Outer Vinyl Container with Overflow Visible for Slide-Out */}
        <div className="relative w-full h-full">
          {/* The Vinyl Record Disc (Slides out to the right and continuously spins on group-hover) */}
          <div className="absolute top-1 bottom-1 right-0 aspect-square rounded-full bg-[#0a0a0c] border border-black/90 shadow-2xl z-0 transition-transform duration-500 ease-out transform-gpu group-hover:translate-x-[46%] sm:group-hover:translate-x-[48%] group-hover:z-20 pointer-events-none">
            {/* Grooves & Specular Sheen (Animated rotation inside disc) */}
            <div className="relative w-full h-full rounded-full overflow-hidden group-hover:animate-vinyl-spin">
              {/* Concentric Sound Grooves */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  backgroundImage: `radial-gradient(circle at center, transparent 28%, rgba(255,255,255,0.07) 28.5%, transparent 29%, transparent 37%, rgba(255,255,255,0.06) 37.5%, transparent 38%, transparent 47%, rgba(255,255,255,0.07) 47.5%, transparent 48%, transparent 58%, rgba(255,255,255,0.06) 58.5%, transparent 59%, transparent 69%, rgba(255,255,255,0.07) 69.5%, transparent 70%, transparent 80%, rgba(255,255,255,0.06) 80.5%, transparent 81%, transparent 90%, rgba(255,255,255,0.05) 90.5%, transparent 91%)`,
                }}
              />

              {/* Conic Specular Sheen (Vinyl Reflection Angle) */}
              <div
                className="absolute inset-0 rounded-full opacity-80"
                style={{
                  backgroundImage: `conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.16) 45deg, transparent 90deg, transparent 180deg, rgba(255,255,255,0.16) 225deg, transparent 270deg)`,
                }}
              />

              {/* Center Paper Label */}
              <div className="absolute inset-0 m-auto w-[35%] h-[35%] rounded-full bg-accent text-white flex flex-col items-center justify-center p-1 shadow-inner border border-white/30 text-center overflow-hidden">
                <span className="text-[6.5px] uppercase tracking-wider font-black line-clamp-1 px-1">
                  {authorOrCreator || 'Vinyl'}
                </span>
                {/* Spindle Center Hole */}
                <div className="w-2.5 h-2.5 rounded-full bg-[#0a0a0c] border border-white/40 my-0.5 shadow-inner" />
                <span className="text-[5.5px] font-mono text-white/70">33⅓ RPM</span>
              </div>
            </div>
          </div>

          {/* Square Cardboard Album Jacket */}
          <div className="relative w-full h-full rounded-md overflow-hidden bg-neutral-900 shadow-xl z-10 border border-white/10 transition-transform duration-500 group-hover:scale-[1.01]">
            {renderCoverImage()}

            {/* Left Cardboard Spine Band */}
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-black/80 to-transparent z-20 pointer-events-none" />

            {/* Right Opening Slit (Where vinyl slides out) */}
            <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-gradient-to-l from-black/90 to-transparent z-20 pointer-events-none" />

            {/* Vintage Ring Wear Impression */}
            <div className="absolute inset-0 m-auto w-[84%] h-[84%] rounded-full border border-white/[0.04] pointer-events-none z-20" />

            {/* Category Badge */}
            <div className="absolute top-3 left-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/15 text-white text-[7px] uppercase tracking-widest font-black flex items-center gap-1.5">
                <Disc3 size={11} className="text-accent" />
                <span>{categoryOrType}</span>
              </div>
            </div>

            {/* Play Overlay if playable */}
            {isPlayable && (
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                <div className="w-11 h-11 rounded-full bg-black/70 backdrop-blur-md border border-white/25 text-white flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:bg-accent group-hover:border-accent transition-all duration-300">
                  <Play size={16} className="fill-white ml-0.5" />
                </div>
              </div>
            )}

            {/* Persistent Status Badge */}
            {statusBadge && <div className="absolute top-3 right-3 z-30">{statusBadge}</div>}

            {/* Hover Details Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-4 z-30">
              <div className="transform translate-y-3 group-hover:translate-y-0 transition-transform duration-500">
                {authorOrCreator && (
                  <p className="text-white/60 text-[8px] uppercase tracking-[0.2em] font-black mb-1 truncate">
                    {authorOrCreator}
                  </p>
                )}
                <h4 className="text-white font-serif text-xs sm:text-sm font-bold leading-snug line-clamp-2">
                  {title}
                </h4>
                {review && (
                  <p className="text-white/80 font-serif italic text-[10px] line-clamp-2 mt-1">
                    «{review}»
                  </p>
                )}
                <div className="mt-2.5 pt-2 border-t border-white/15 flex items-center justify-between text-white/50 text-[7.5px] uppercase tracking-widest font-black">
                  <span>{actionLabel || 'Spill av / Vis'}</span>
                  <ExternalLink size={10} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------
     3. MOVIE & SHOWS: VHS / DVD Clamshell Amaray Case
     ------------------------------------------------------------- */
  if (artifactType === 'movie') {
    return (
      <div className="relative w-full aspect-[2/3] select-none group/movie">
        {/* Soft Case Shadow */}
        <div className="absolute -bottom-2.5 left-3.5 right-3.5 h-3.5 bg-black/45 blur-md rounded-full transition-all duration-500 group-hover:scale-x-105 pointer-events-none" />

        {/* Plastic Clamshell Outer Frame */}
        <div className="relative w-full h-full rounded-xl p-1 sm:p-1.5 bg-gradient-to-b from-[#242429] via-[#161619] to-[#0d0d0f] shadow-xl border border-white/10 transition-transform duration-500 group-hover:scale-[1.02] group-hover:-translate-y-1">
          {/* Top Plastic Case Clip Tab */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-black/60 rounded-b-xs border-b border-white/15 z-20 pointer-events-none" />

          {/* Bottom Plastic Case Clip Tab */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-black/60 rounded-t-xs border-t border-white/15 z-20 pointer-events-none" />

          {/* Left Spine Plastic Hinge Highlight */}
          <div className="absolute left-1 top-2 bottom-2 w-1.5 bg-gradient-to-r from-black/80 via-white/15 to-black/40 rounded-l-xs z-20 pointer-events-none" />

          {/* Inner Inset Cover Slot with Glossy Cellophane Wrap */}
          <div className="relative w-full h-full rounded-lg overflow-hidden bg-surface">
            {renderCoverImage()}

            {/* Glossy Plastic Shrink-Wrap Reflection Overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent z-10 pointer-events-none group-hover:opacity-90 transition-opacity duration-500" />

            {/* Category Badge */}
            <div className="absolute top-3 left-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/15 text-white text-[7px] uppercase tracking-widest font-black flex items-center gap-1.5">
                <Film size={11} className="text-accent" />
                <span>{categoryOrType}</span>
              </div>
            </div>

            {/* Center Play Overlay */}
            {isPlayable && (
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                <div className="w-11 h-11 rounded-full bg-black/70 backdrop-blur-md border border-white/25 text-white flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:bg-accent group-hover:border-accent transition-all duration-300">
                  <Play size={16} className="fill-white ml-0.5" />
                </div>
              </div>
            )}

            {/* Persistent Status Badge */}
            {statusBadge && <div className="absolute top-3 right-3 z-30">{statusBadge}</div>}

            {/* Hover Details Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-4 z-30">
              <div className="transform translate-y-3 group-hover:translate-y-0 transition-transform duration-500">
                {authorOrCreator && (
                  <p className="text-white/60 text-[8px] uppercase tracking-[0.2em] font-black mb-1 truncate">
                    {authorOrCreator}
                  </p>
                )}
                <h4 className="text-white font-serif text-xs sm:text-sm font-bold leading-snug line-clamp-2">
                  {title}
                </h4>
                {review && (
                  <p className="text-white/80 font-serif italic text-[10px] line-clamp-2 mt-1">
                    «{review}»
                  </p>
                )}
                <div className="mt-2.5 pt-2 border-t border-white/15 flex items-center justify-between text-white/50 text-[7.5px] uppercase tracking-widest font-black">
                  <span>{actionLabel || 'Spill av / Vis'}</span>
                  <ExternalLink size={10} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------
     4. APPS: Classic iOS Squircle App Icon
     ------------------------------------------------------------- */
  if (artifactType === 'app') {
    return (
      <div className="relative w-full aspect-square select-none group/app flex items-center justify-center p-1 sm:p-2">
        {/* Soft Ambient Icon Drop Shadow */}
        <div className="absolute inset-2 bg-black/40 dark:bg-black/70 blur-xl rounded-[22%] pointer-events-none transition-all duration-300 group-hover:scale-110 group-hover:blur-2xl group-hover:opacity-75" />

        {/* Squircle App Icon Container */}
        <div className="relative w-full h-full rounded-[22%] overflow-hidden bg-neutral-900 border border-black/15 dark:border-white/15 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.4),0_6px_10px_-4px_rgba(0,0,0,0.2)] dark:shadow-[0_14px_30px_-5px_rgba(0,0,0,0.8)] transition-all duration-300 group-hover:scale-[1.04] group-hover:-translate-y-1 group-hover:shadow-[0_18px_36px_-6px_rgba(0,0,0,0.5)]">
          {renderCoverImage('w-full h-full object-cover rounded-[22%]')}

          {/* iOS App Icon Gloss & Bevel Highlights */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/15 pointer-events-none rounded-[22%]" />
          <div className="absolute inset-0 rounded-[22%] border border-white/30 pointer-events-none" />

          {/* Category Badge on hover */}
          <div className="absolute top-2.5 left-2.5 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-white text-[7px] uppercase tracking-widest font-black flex items-center gap-1">
              <Smartphone size={10} className="text-accent" />
              <span>App</span>
            </div>
          </div>

          {/* Persistent Status Badge */}
          {statusBadge && <div className="absolute top-2.5 right-2.5 z-30">{statusBadge}</div>}

          {/* Hover Details Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3 sm:p-4 z-30 rounded-[22%]">
            <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
              {authorOrCreator && (
                <p className="text-white/60 text-[7.5px] uppercase tracking-[0.2em] font-black mb-0.5 truncate">
                  {authorOrCreator}
                </p>
              )}
              <h4 className="text-white font-serif text-xs sm:text-sm font-bold leading-snug line-clamp-1">
                {title}
              </h4>
              {review && (
                <p className="text-white/80 font-serif italic text-[9.5px] line-clamp-1 mt-0.5">
                  «{review}»
                </p>
              )}
              <div className="mt-2 pt-1.5 border-t border-white/15 flex items-center justify-between text-white/50 text-[7px] uppercase tracking-widest font-black">
                <span>{actionLabel || 'Åpne'}</span>
                <ExternalLink size={9} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------
     5. VIDEO / WIDESCREEN: Cinema Display Monitor Frame
     ------------------------------------------------------------- */
  return (
    <div className={`relative ${isWidescreen ? 'aspect-video rounded-2xl' : 'aspect-[2/3] rounded-2xl'} w-full overflow-hidden bg-surface neu-card group-hover:scale-[1.02] transition-all duration-500 select-none`}>
      {renderCoverImage()}

      {/* Subtle Top Badge */}
      <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[7px] uppercase tracking-widest font-black flex items-center gap-1.5">
          {isCollection ? <Layers size={12} /> : fallbackIcon || <Tv size={12} />}
          <span>{isCollection ? `Samling (${collectionCount})` : categoryOrType}</span>
        </div>
      </div>

      {/* Play Overlay */}
      {isPlayable && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-black/65 backdrop-blur-md border border-white/25 text-white flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:bg-accent group-hover:border-accent transition-all duration-300">
            <Play size={18} className="fill-white ml-0.5" />
          </div>
        </div>
      )}

      {/* Persistent Status Badge */}
      {statusBadge && <div className="absolute top-3 right-3 z-10">{statusBadge}</div>}

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-5">
        <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
          {!isCollection && authorOrCreator && (
            <p className="text-white/50 text-[8px] uppercase tracking-[0.2em] font-black mb-1 truncate">
              {authorOrCreator}
            </p>
          )}
          <h3 className="text-white font-serif text-sm font-bold leading-snug line-clamp-2">
            {title}
          </h3>
          {review && (
            <p className="text-white/75 font-serif italic text-[11px] line-clamp-2 mt-1.5">
              «{review}»
            </p>
          )}
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-white/40 text-[8px] uppercase tracking-widest font-black">
            <span>{isCollection ? 'Åpne samling' : actionLabel || 'View Details'}</span>
            {isCollection ? <Layers size={10} /> : <ExternalLink size={10} />}
          </div>
        </div>
      </div>
    </div>
  );
};
