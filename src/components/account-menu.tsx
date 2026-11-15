"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { initials } from "@/lib/client/account";
import { PROFILE_LABEL, ROLE_LABEL, SCREENS, type AppUser } from "@/lib/roles";

/**
 * Round account button in the header. Opens a small panel with who is signed in and a big Sign out.
 * Keyboard and screen-reader friendly: a real button with aria-expanded, Escape closes it and puts
 * focus back on the button, and clicking anywhere else closes it too.
 */
export function AccountMenu({ user }: { user: AppUser | null | undefined }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  if (user === undefined) return <span aria-hidden="true" className="size-11 shrink-0 rounded-full bg-[#eef7f4]" />;
  if (user === null) {
    return (
      <Link href="/sign-in" className="flex min-h-11 items-center rounded-full bg-[#17323a] px-4 text-sm font-extrabold text-white">
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Account: ${user.name}, ${ROLE_LABEL[user.role]}`}
        onClick={() => setOpen(!open)}
        className="flex size-11 items-center justify-center rounded-full border-2 border-[#1e4a55] bg-[#ffd66b] text-base font-extrabold text-[#17323a]"
      >
        <span aria-hidden="true">{initials(user.name)}</span>
      </button>
      {open ? (
        <div
          ref={panel}
          id={panelId}
          role="region"
          aria-label="Account"
          className="absolute top-full right-0 z-40 mt-2 flex w-[min(18rem,calc(100vw-1.5rem))] flex-col gap-3 rounded-2xl border-2 border-[#cfe0dc] bg-white p-4 text-[#17323a] shadow-xl"
        >
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#ffd66b] text-lg font-extrabold">
              {initials(user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold">{user.name}</p>
              <p className="text-sm text-[#4f6970]">{ROLE_LABEL[user.role]}</p>
            </div>
          </div>
          <p className="rounded-xl bg-[#eef7f4] px-3 py-2 text-sm">
            In an emergency: <strong>{PROFILE_LABEL[user.profile]}</strong>. To change it, sign out and choose again when you sign back in.
          </p>
          <Link href="/" onClick={() => setOpen(false)} className="flex min-h-12 items-center justify-center rounded-2xl border-2 border-[#9ccfbd] bg-[#eef7f4] font-extrabold">
            Home
          </Link>
          <SignOutButton className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#c62828] text-lg font-extrabold text-white" />
        </div>
      ) : null}
    </div>
  );
}

/** Home plus the screens this person's role may open. The current one is marked for screen readers too. */
export function AppNav({ user }: { user: AppUser | null | undefined }) {
  const pathname = usePathname();
  const links = [
    { href: "/", short: "Home" },
    ...(user ? SCREENS.filter((s) => s.short && s.roles.includes(user.role)).map((s) => ({ href: s.href, short: s.short! })) : []),
  ];
  return (
    <nav aria-label="Main" className="-mx-3 overflow-x-auto px-3">
      <ul className="flex w-max gap-2 pb-1">
        {links.map((link) => {
          const current = pathname === link.href;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-[15px] font-bold whitespace-nowrap ${
                  current ? "border-[#17323a] bg-[#17323a] text-white" : "border-[#cfe0dc] bg-white text-[#17323a] hover:border-[#1e4a55]"
                }`}
              >
                {link.href === "/" ? (
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10" />
                  </svg>
                ) : null}
                {link.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
