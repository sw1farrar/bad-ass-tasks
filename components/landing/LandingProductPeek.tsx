"use client";

import Image from "next/image";

const DESKTOP_ALT =
  "Badazz Tasks Home view on desktop showing due-now tasks and workspace overview";
const MOBILE_ALT =
  "Badazz Tasks Home view on mobile showing compact task summary and navigation";

export function LandingProductPeek() {
  return (
    <>
      {/* Mobile — shallow peek, keeps the page one screen */}
      <div
        className="landing-peek-mobile lg:hidden w-full max-w-[260px] mx-auto"
        aria-hidden={false}
      >
        <div className="landing-peek-mobile__frame">
          <Image
            src="/landing/screenshots/mobile-home.png"
            alt={MOBILE_ALT}
            width={390}
            height={844}
            priority
            className="landing-peek-mobile__image"
            sizes="260px"
          />
        </div>
      </div>

      {/* Desktop — single screenshot scaled to viewport */}
      <div className="landing-peek-desktop hidden lg:flex items-center justify-center">
        <div className="landing-peek-desktop__frame">
          <Image
            src="/landing/screenshots/desktop-home.png"
            alt={DESKTOP_ALT}
            width={1440}
            height={900}
            priority
            className="landing-peek-desktop__image"
            sizes="(min-width: 1024px) 52vw, 0px"
          />
        </div>
      </div>
    </>
  );
}