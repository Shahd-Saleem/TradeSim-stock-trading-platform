"use client";
import Link from "next/link";
import { ChevronDown, UserRound } from "lucide-react";
import { SignOut } from "./SignOut";
import s from "./Profile.module.css";
export function Profile({
  user,
}: {
  user: { name: string; email: string } | null;
}) {
  if (!user)
    return (
      <div className={s.guest}>
        <Link href="/login?returnTo=%2Fdashboard" aria-label="Sign In">
          <UserRound size={20} aria-hidden="true" />
          <span>Sign in to your workspace</span>
        </Link>
      </div>
    );
  const identity = (
    <>
      <strong title={user.name}>{user.name}</strong>
      <small title={user.email}>{user.email}</small>
    </>
  );
  return (
    <details
      className={s.profile}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label={`Account menu for ${user.name}`}>
        <span className={s.avatar} aria-hidden="true">
          {user.name.trim().charAt(0).toUpperCase()}
        </span>
        <span className={s.identity}>{identity}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </summary>
      <div className={s.menu}>
        <div className={s.menuIdentity}>{identity}</div>
        <span className={s.label}>PERSISTENT VIRTUAL ACCOUNT</span>
        <SignOut />
      </div>
    </details>
  );
}
