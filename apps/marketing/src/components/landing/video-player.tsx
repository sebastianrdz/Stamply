"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";

/**
 * Click-to-play: the video has a music track, so no autoplay. preload="none"
 * + poster keeps it off the critical path until someone asks for it.
 */
export function VideoPlayer({
  src,
  poster,
  label,
  playLabel,
}: {
  src: string;
  poster: string;
  label: string;
  playLabel: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  return (
    <div className="bg-card border-border relative aspect-video overflow-hidden rounded-2xl border shadow-xl">
      <video
        ref={ref}
        src={src}
        poster={poster}
        preload="none"
        playsInline
        controls={started}
        aria-label={label}
        onEnded={() => setStarted(false)}
        className="size-full object-cover"
      />
      {!started && (
        <button
          type="button"
          aria-label={playLabel}
          onClick={() => {
            setStarted(true);
            void ref.current?.play();
          }}
          className="focus-visible:ring-ring group absolute inset-0 grid cursor-pointer place-items-center bg-black/10 transition-colors hover:bg-black/20 focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="bg-primary text-primary-foreground grid size-20 place-items-center rounded-full shadow-lg transition-transform group-hover:scale-105 md:size-24">
            <Play aria-hidden className="size-8 translate-x-0.5 fill-current md:size-10" />
          </span>
        </button>
      )}
    </div>
  );
}
