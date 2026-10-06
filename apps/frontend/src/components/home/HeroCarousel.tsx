import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-animated";

import type { MediaItem } from "../../api/cinemeta";

import PosterCard from "./PosterCard";

const ROTATION_MS = 5_000;
const GAP_PX = -16;
const TITLE_ZONE_PX = 28;
const TOP_SLACK_PX = 4;
const CAPTION_MARGIN_PX = 16;

interface Slot {
  w: number;
  h: number;
}

interface TierDefinition {
  min: number;
  slots: Slot[];
}

interface Geometry {
  offsets: number[];
  captions: number[];
  edgeStep: number;
  width: number;
}

const TIER_DEFS: TierDefinition[] = [
  {
    min: 900,
    slots: [
      { w: 160, h: 240 },
      { w: 200, h: 300 },
      { w: 240, h: 360 },
      { w: 200, h: 300 },
      { w: 160, h: 240 },
    ],
  },
  {
    min: 580,
    slots: [
      { w: 200, h: 300 },
      { w: 240, h: 360 },
      { w: 200, h: 300 },
    ],
  },
  {
    min: 460,
    slots: [
      { w: 128, h: 192 },
      { w: 192, h: 288 },
      { w: 128, h: 192 },
    ],
  },
  {
    min: 0,
    slots: [
      { w: 96, h: 144 },
      { w: 144, h: 216 },
      { w: 96, h: 144 },
    ],
  },
];

function buildGeometry(slots: Slot[]): Geometry {
  const half = (slots.length - 1) / 2;
  const centers: number[] = [];

  let cursor = 0;

  for (let position = 0; position < slots.length; position += 1) {
    centers.push(cursor + slots[position].w / 2);
    cursor += slots[position].w + GAP_PX;
  }

  const center = centers[half];

  const offsets = centers.map((value) => Math.round(value - center));

  const captions = slots.map((slot, position) => {
    let width = slot.w;

    if (position > 0) {
      width = Math.min(
        width,
        offsets[position] - offsets[position - 1] - CAPTION_MARGIN_PX,
      );
    }

    if (position < slots.length - 1) {
      width = Math.min(
        width,
        offsets[position + 1] - offsets[position] - CAPTION_MARGIN_PX,
      );
    }

    return width;
  });

  return {
    offsets,
    captions,
    edgeStep: slots[0].w + GAP_PX,
    width: cursor - GAP_PX,
  };
}

const TIERS = TIER_DEFS.map((definition) => {
  const maxHeight = definition.slots.reduce(
    (max, slot) => Math.max(max, slot.h),
    0,
  );

  return {
    min: definition.min,
    slots: definition.slots,
    half: (definition.slots.length - 1) / 2,
    maxHeight,
    geometry: buildGeometry(definition.slots),
  };
});

interface HeroCarouselProps {
  items: MediaItem[];
}

function HeroCarousel({ items }: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const [sectionWidth, setSectionWidth] = useState(() => {
    const width = document.documentElement.clientWidth;
    return width - (width >= 1024 ? 328 : 48);
  });

  const [tabVisible, setTabVisible] = useState(
    () => document.visibilityState === "visible",
  );

  const [reduceMotion, setReduceMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const [titleZone, setTitleZone] = useState(TITLE_ZONE_PX);

  const viewportRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const handleVisibility = () => {
      setTabVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handleChange = () => setReduceMotion(media.matches);

    media.addEventListener("change", handleChange);

    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, []);

  useLayoutEffect(() => {
    const element = viewportRef.current;

    if (!element) {
      return;
    }

    setSectionWidth(element.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      setSectionWidth(entries[0].contentRect.width);
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [items.length]);

  useLayoutEffect(() => {
    const caption = captionRef.current;

    if (!caption) {
      return;
    }

    const measure = () => {
      const style = window.getComputedStyle(caption);

      setTitleZone(
        caption.getBoundingClientRect().height + parseFloat(style.marginTop),
      );
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(caption);

    return () => {
      observer.disconnect();
    };
  }, [items.length]);

  const rotating = !hovered && !focused && tabVisible && !reduceMotion;

  useEffect(() => {
    if (!rotating || items.length < 2) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setIndex((current) => (current + 1) % items.length);
    }, ROTATION_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [rotating, index, items.length]);

  if (items.length === 0) {
    return null;
  }

  const tier =
    TIERS.find((candidate) => sectionWidth >= candidate.min) ??
    TIERS[TIERS.length - 1];

  const carouselHeight = tier.maxHeight + titleZone + TOP_SLACK_PX * 2;

  const goTo = (next: number) => {
    setIndex(((next % items.length) + items.length) % items.length);
  };

  const relativePositionAt = (position: number, at: number) => {
    const raw =
      (((position - at) % items.length) + items.length) % items.length;

    return raw >= items.length / 2 ? raw - items.length : raw;
  };

  const relativePosition = (position: number) =>
    relativePositionAt(position, index);

  const isCircularJump = (position: number, rel: number) => {
    if (Math.abs(rel) <= tier.half) {
      return false;
    }

    const wrap = items.length - 1;
    const previous = relativePositionAt(position, index - 1);
    const next = relativePositionAt(position, index + 1);

    return (
      (Math.abs(rel - previous) === wrap && Math.abs(previous) > tier.half) ||
      (Math.abs(rel - next) === wrap && Math.abs(next) > tier.half)
    );
  };

  return (
    <section aria-label="Destacados" className="space-y-4">
      <div
        ref={viewportRef}
        className="relative overflow-hidden transition-[height] duration-300 ease-out [@media(prefers-reduced-motion:reduce)]:transition-none"
        style={{ height: carouselHeight }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <div
          className="absolute left-1/2 top-1/2 h-full -translate-x-1/2 -translate-y-1/2 overflow-hidden transition-[width] duration-500 ease-out [@media(prefers-reduced-motion:reduce)]:transition-none"
          style={{ width: tier.geometry.width }}
        >
          {items.map((item, position) => {
            const rel = relativePosition(position);

            const within = Math.abs(rel) <= tier.half;

            const slotIndex = within
              ? rel + tier.half
              : rel > 0
                ? tier.slots.length - 1
                : 0;

            const slot = tier.slots[slotIndex];

            const offset = within
              ? tier.geometry.offsets[slotIndex]
              : rel > 0
                ? tier.geometry.offsets[tier.slots.length - 1] +
                  (rel - tier.half) * tier.geometry.edgeStep
                : tier.geometry.offsets[0] +
                  (rel + tier.half) * tier.geometry.edgeStep;

            return (
              <div
                key={`${item.id}-${position}`}
                className={`absolute left-1/2 top-1/2 ${
                  isCircularJump(position, rel)
                    ? "transition-none"
                    : "transition-[transform,opacity] duration-500 ease-out [@media(prefers-reduced-motion:reduce)]:transition-none"
                }`}
                style={{
                  zIndex: 100 - Math.abs(rel) * 10,
                  opacity: rel === 0 ? 1 : 0.6,
                  transform: `translate(calc(-50% + ${offset}px), -50%)`,
                }}
              >
                <div
                  className="transition-[width,height] duration-500 ease-out [@media(prefers-reduced-motion:reduce)]:transition-none"
                  style={{
                    width: slot.w,
                    height: slot.h,
                  }}
                >
                  <PosterCard
                    item={item}
                    className="h-full w-full"
                    eager={within}
                    inert={!within}
                  />
                </div>

                <p
                  ref={position === 0 ? captionRef : undefined}
                  className="mx-auto mt-2 truncate text-center text-sm text-slate-300 transition-[width] duration-500 ease-out [@media(prefers-reduced-motion:reduce)]:transition-none"
                  style={{
                    width: tier.geometry.captions[slotIndex],
                  }}
                >
                  {item.name}
                </p>
              </div>
            );
          })}

          <button
            type="button"
            aria-label="Destacado anterior"
            onClick={() => goTo(index - 1)}
            className="absolute left-2 top-1/2 z-50 -translate-y-1/2 rounded-full border border-slate-700/70 bg-slate-950/80 p-2 text-white shadow-lg backdrop-blur-sm transition-all hover:scale-105 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
          >
            <ChevronLeftIcon
              size={22}
              animateOnHover={false}
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            aria-label="Siguiente destacado"
            onClick={() => goTo(index + 1)}
            className="absolute right-2 top-1/2 z-50 -translate-y-1/2 rounded-full border border-slate-700/70 bg-slate-950/80 p-2 text-white shadow-lg backdrop-blur-sm transition-all hover:scale-105 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
          >
            <ChevronRightIcon
              size={22}
              animateOnHover={false}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <div className="flex justify-center gap-2">
        {items.map((item, position) => (
          <button
            key={`${item.id}-dot-${position}`}
            type="button"
            aria-label={`Ir al destacado ${position + 1}`}
            aria-current={position === index}
            onClick={() => goTo(position)}
            className={`h-2.5 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 ${
              position === index
                ? "w-6 bg-teal-400"
                : "w-2.5 bg-slate-600 hover:bg-slate-500"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

export default HeroCarousel;
