"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import {
  LANDING_FEATURE_SECTIONS,
  type LandingFeatureScreenshot,
  type LandingFeatureSection,
} from "@/components/landing/landingFeatures";
import "@/components/landing/landing-features-modal.css";

interface LandingFeaturesModalProps {
  open: boolean;
  onClose: () => void;
  onSignIn: () => void;
  initialSectionId?: string;
}

function FeatureScreenshot({
  shot,
  reversed,
  stacked,
}: {
  shot: LandingFeatureScreenshot;
  reversed?: boolean;
  stacked?: boolean;
}) {
  return (
    <figure
      className={cn(
        "landing-tour-shot",
        reversed && "landing-tour-shot--reversed",
        stacked && "landing-tour-shot--stacked"
      )}
    >
      {shot.caption ? (
        <figcaption className="landing-tour-shot__caption">{shot.caption}</figcaption>
      ) : null}
      <div className="landing-tour-shot__desktop">
        <Image
          src={shot.desktopSrc}
          alt={shot.imageAlt}
          width={1440}
          height={900}
          className="landing-tour-shot__image"
          sizes="(min-width: 1024px) 52vw, 0px"
        />
      </div>
      {shot.mobileSrc ? (
        <div className="landing-tour-shot__mobile" aria-hidden>
          <Image
            src={shot.mobileSrc}
            alt=""
            width={390}
            height={844}
            className="landing-tour-shot__image"
            sizes="168px"
          />
        </div>
      ) : null}
    </figure>
  );
}

function FeatureScreenshots({
  section,
  reversed,
}: {
  section: LandingFeatureSection;
  reversed?: boolean;
}) {
  if (section.screenshots.length === 0) return null;

  return (
    <div
      className={cn(
        "landing-tour-shots",
        section.screenshots.length > 1 && "landing-tour-shots--multi"
      )}
    >
      {section.screenshots.map((shot, index) => (
        <FeatureScreenshot
          key={shot.desktopSrc}
          shot={shot}
          reversed={reversed}
          stacked={index > 0}
        />
      ))}
    </div>
  );
}

export function LandingFeaturesModal({
  open,
  onClose,
  onSignIn,
  initialSectionId,
}: LandingFeaturesModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState(
    LANDING_FEATURE_SECTIONS[0]?.id ?? "home"
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useScrollLock(open);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveSectionId(initialSectionId ?? LANDING_FEATURE_SECTIONS[0]?.id ?? "home");

    const frame = requestAnimationFrame(() => {
      const targetId = initialSectionId ?? LANDING_FEATURE_SECTIONS[0]?.id;
      const target = targetId ? sectionRefs.current[targetId] : null;
      if (target) {
        target.scrollIntoView({ behavior: "auto", block: "start" });
      } else {
        scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [open, initialSectionId]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (top?.target.id) {
          setActiveSectionId(top.target.id);
        }
      },
      {
        root: scrollEl,
        threshold: [0.2, 0.35, 0.5, 0.65],
        rootMargin: "-18% 0px -52% 0px",
      }
    );

    for (const section of LANDING_FEATURE_SECTIONS) {
      const node = sectionRefs.current[section.id];
      if (node) observer.observe(node);
    }

    const intro = sectionRefs.current.intro;
    if (intro) observer.observe(intro);

    return () => observer.disconnect();
  }, [open]);

  const scrollToSection = useCallback((sectionId: string) => {
    const target = sectionRefs.current[sectionId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="landing-tour fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-5 md:p-6">
      <div
        className="landing-tour__scrim absolute inset-0 overlay-scrim backdrop-blur-[6px]"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="landing-tour-title"
        className="landing-tour__panel relative flex h-[min(94dvh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border-glass bg-bg-panel modal-panel shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="landing-tour__header shrink-0 border-b border-border-glass bg-bg-panel/95 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted sm:text-[11px]">
                Product tour
              </p>
              <h2
                id="landing-tour-title"
                className="truncate text-base font-semibold tracking-tight text-text-primary sm:text-lg"
              >
                Explore Badazz Tasks
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="landing-tour__close flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-muted transition hover:bg-surface-hover hover:text-text-primary"
              aria-label="Close product tour"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav
            className="landing-tour__nav flex gap-1.5 overflow-x-auto px-4 pb-3 sm:px-6"
            aria-label="Feature sections"
          >
            {LANDING_FEATURE_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSectionId === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className={cn(
                    "landing-tour__nav-pill inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    isActive
                      ? "landing-tour__nav-pill--active border-neon-purple/40 bg-neon-purple/12 text-text-primary"
                      : "border-border-glass text-text-secondary hover:border-border hover:text-text-primary"
                  )}
                  aria-current={isActive ? "true" : undefined}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  {section.navLabel}
                </button>
              );
            })}
          </nav>
        </header>

        <div ref={scrollRef} className="landing-tour__scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <section
            id="intro"
            ref={(node) => {
              sectionRefs.current.intro = node;
            }}
            className="landing-tour__intro px-5 py-10 text-center sm:px-10 sm:py-14"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-muted">
              Scroll to explore
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-2xl font-semibold leading-tight tracking-[-0.03em] text-text-primary sm:text-3xl">
              One workspace for tasks, notes, lists, files, and your team.
            </p>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-text-muted sm:text-base">
              Real screenshots from the app — scroll down to see how each part fits together.
            </p>
            <div className="landing-tour__scroll-hint mt-8 inline-flex flex-col items-center gap-1 text-text-faint">
              <ChevronDown className="h-5 w-5 animate-bounce" aria-hidden />
              <span className="text-xs">Keep scrolling</span>
            </div>
          </section>

          {LANDING_FEATURE_SECTIONS.map((section, index) => {
            const reversed = index % 2 === 1;
            const Icon = section.icon;

            return (
              <section
                key={section.id}
                id={section.id}
                ref={(node) => {
                  sectionRefs.current[section.id] = node;
                }}
                className={cn(
                  "landing-tour__section",
                  reversed && "landing-tour__section--reversed"
                )}
              >
                <div className="landing-tour__copy">
                  <div className="landing-tour__section-label">
                    <Icon className="h-4 w-4 text-neon-purple" strokeWidth={2} aria-hidden />
                    <span>{section.eyebrow}</span>
                  </div>
                  <h3 className="landing-tour__section-title">{section.title}</h3>
                  <p className="landing-tour__section-desc">{section.description}</p>
                  {section.emailCallout ? (
                    <div className="landing-tour__email-callout">
                      <p className="landing-tour__email-callout-title">
                        {section.emailCallout.title}
                      </p>
                      <p className="landing-tour__email-callout-body">
                        {section.emailCallout.body}
                      </p>
                    </div>
                  ) : null}
                  <ul className="landing-tour__highlights">
                    {section.highlights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <FeatureScreenshots section={section} reversed={reversed} />
              </section>
            );
          })}

          <footer className="landing-tour__footer px-5 py-12 text-center sm:px-10 sm:py-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-muted">
              Ready when you are
            </p>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
              Get shit done. Beautifully.
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-text-muted sm:text-base">
              Free to use. Create an account and your workspace is ready in seconds.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSignIn();
                }}
                className="btn btn-primary h-12 min-w-[11rem] px-9 text-sm font-medium"
              >
                Get started free
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-medium text-text-secondary transition hover:text-text-primary min-h-[44px] px-4"
              >
                Keep exploring
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>,
    document.body
  );
}