"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu, AppNav, MobileNav } from "@/components/account-menu";
import { SunSafeLogo } from "@/components/sunsafe-logo";
import { useAccount } from "@/lib/client/account";
import type { Turn } from "@/lib/floor/types";

// The pieces every phone screen shares, in the "Your way out" style: header with a status pill,
// big title, the rounded teal 3D map, a summary card, a step card and the button styles.

export const MAP_SIZE = "h-[clamp(380px,62svh,640px)] w-full";

/** WebGL only exists in the browser, so the map is never rendered on the server. */
export const RouteMap3D = dynamic(() => import("@/components/route-map-3d").then((m) => m.RouteMap3D), {
  ssr: false,
  loading: () => <div className={`${MAP_SIZE} rounded-[28px] bg-[#1e4a55]`} />,
});

export const SCREEN = "mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 bg-white px-3 pt-3 pb-10 text-[#17323a]";

export const BUTTON = {
  base: "flex min-h-16 items-center justify-center gap-2 rounded-2xl px-4 text-xl font-extrabold disabled:opacity-50",
  primary: "bg-[#ffd84d] text-[#3d2c00]",
  quiet: "border-2 border-[#9ccfbd] bg-[#eef7f4] text-[#17323a]",
  danger: "bg-[#c62828] text-white",
  dark: "bg-[#17323a] text-white",
};

export type PillTone = "alarm" | "calm" | "info";

type HeaderProps = {
  pill?: string;
  tone?: PillTone;
  home?: string;
  right?: ReactNode;
  /** Show the account button (who is signed in, Sign out). Off on screens with nobody signed in: sign-in, classroom computers. */
  account?: boolean;
  /** Show the Home / screens bar under the header. Off where it would distract, like the alarm itself. */
  nav?: boolean;
};

export function ScreenHeader({ account = true, nav = true, ...props }: HeaderProps) {
  return account || nav ? <SignedInHeader account={account} nav={nav} {...props} /> : <HeaderRow {...props} />;
}

/**
 * The app bar on signed-in screens. It spans the whole window even inside the narrow phone layouts,
 * so on a computer the nav has room to sit in one row; on a phone the links fold into a menu button.
 * Sticks to the top while scrolling.
 */
function SignedInHeader({ account, nav, pill, tone, home = "/", right }: HeaderProps & { account: boolean; nav: boolean }) {
  const user = useAccount();
  return (
    <div className="sticky top-0 z-30 -mt-3 w-screen self-center border-b border-[#e3eeeb] bg-white/95 backdrop-blur">
      <header className="relative mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:px-5 md:gap-4">
        <Link href={home} className="flex min-h-11 shrink-0 items-center gap-2 rounded-full pr-2 text-lg font-extrabold tracking-tight">
          <SunSafeLogo />
          SunSafe
        </Link>
        {nav ? <AppNav user={user} /> : <span className="flex-1" />}
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {right}
          {pill ? <Pill text={pill} tone={tone} /> : null}
          {account ? <AccountMenu user={user} /> : null}
          {nav ? <MobileNav user={user} /> : null}
        </div>
      </header>
    </div>
  );
}

function Pill({ text, tone }: { text: string; tone?: PillTone }) {
  return (
    <span
      className={`flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
        tone === "alarm" ? "bg-[#c62828] text-white" : tone === "info" ? "bg-[#ffe3cc] text-[#8a3f0c]" : "bg-[#dff3e8] text-[#14532d]"
      }`}
    >
      {tone === "alarm" ? <span aria-hidden="true" className="size-2 shrink-0 animate-pulse rounded-full bg-white" /> : null}
      <span className="truncate">{text}</span>
    </span>
  );
}

function HeaderRow({ pill, tone, home = "/", right }: Omit<HeaderProps, "account" | "nav">) {
  return (
    <header className="flex items-center justify-between gap-2">
      <Link href={home} className="flex min-h-11 items-center gap-2 rounded-full pr-2 text-lg font-extrabold tracking-tight">
        <SunSafeLogo />
        SunSafe
      </Link>
      <div className="flex min-w-0 items-center gap-2">
        {right}
        {pill ? <Pill text={pill} tone={tone} /> : null}
      </div>
    </header>
  );
}

export function ScreenTitle({ title, subtitle, id }: { title: string; subtitle?: ReactNode; id?: string }) {
  return (
    <div className="px-1">
      <h1 id={id} className="text-[28px] leading-tight font-extrabold">
        {title}
      </h1>
      {subtitle ? <p className="text-[15px] text-[#4f6970]">{subtitle}</p> : null}
    </div>
  );
}

export const MapHint = () => <p className="text-center text-xs text-[#6b8288]">Drag to rotate · pinch to zoom</p>;

export function Summary({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 rounded-2xl bg-[#eef7f4] px-4 py-3 text-[15px]">
      {rows.map(([label, value], i) => (
        <div key={i} className="contents">
          <dt className="flex items-center gap-2 text-[#4f6970]">{label}</dt>
          <dd className="font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export const StartDot = () => <span aria-hidden="true" className="size-3 rounded-full bg-[#2f6fed] ring-2 ring-white" />;
export const EndDot = () => <span aria-hidden="true" className="size-3 rounded-[4px] bg-[#ff7a1a] ring-2 ring-white" />;

const ARROW_DEGREES: Record<Turn, number> = { straight: 0, right: 90, back: 180, left: -90 };

/** Current instruction with a big turn arrow. Pass `live` where screen readers should hear each change. */
export function StepCard({ label, text, turn, live }: { label?: string; text: string; turn?: Turn; live?: boolean }) {
  return (
    <section
      aria-live={live ? "assertive" : undefined}
      aria-atomic={live ? true : undefined}
      className="flex items-center gap-3 rounded-2xl border-2 border-[#f5c451] bg-[#fff4d6] px-3 py-3"
    >
      {turn ? (
        <span aria-hidden="true" className="flex size-14 flex-none items-center justify-center rounded-2xl bg-[#17323a] text-[#ffd66b]">
          <svg viewBox="0 0 24 24" className="size-10" style={{ transform: `rotate(${ARROW_DEGREES[turn]}deg)` }}>
            <path d="M12 3 19 11h-4.5v10h-5V11H5z" fill="currentColor" />
          </svg>
        </span>
      ) : null}
      <div>
        {label ? <p className="text-xs font-semibold text-[#7a5200]">{label}</p> : null}
        <p className="text-xl leading-snug font-bold">{text}</p>
      </div>
    </section>
  );
}

/** Status and errors that need reading, not just seeing. */
export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "danger" }) {
  return (
    <p
      aria-live="polite"
      className={`rounded-2xl px-4 py-3 text-[17px] font-bold ${tone === "danger" ? "bg-[#fde8e7] text-[#8f1d14]" : "bg-[#e6f0ff] text-[#1d3f8f]"}`}
    >
      {children}
    </p>
  );
}

export const FIELD = "rounded-2xl border-2 border-[#cfe0dc] bg-white p-4 text-xl font-normal text-[#17323a] focus:border-[#1e4a55]";
