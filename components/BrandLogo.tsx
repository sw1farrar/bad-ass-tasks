import Image from "next/image";
import { cn } from "@/lib/utils";

const SIZE_PX = {
  sm: 28,
  md: 32,
  lg: 40,
  xl: 64,
  hero: 112,
} as const;

const SIZE_CLASS = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-16 w-16",
  hero: "h-[5.5rem] w-[5.5rem] sm:h-24 sm:w-24 md:h-28 md:w-28",
} as const;

type BrandLogoProps = {
  size?: keyof typeof SIZE_PX;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ size = "md", className, priority = false }: BrandLogoProps) {
  const px = SIZE_PX[size];

  return (
    <Image
      src="/brand/donkey-logo.jpg"
      alt="Badazz Tasks"
      width={px}
      height={px}
      priority={priority}
      className={cn("brand-logo rounded-lg object-cover shrink-0", SIZE_CLASS[size], className)}
    />
  );
}