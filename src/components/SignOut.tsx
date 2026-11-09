"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import s from "./Profile.module.css";
export function SignOut() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(false);
          try {
            const response = await fetch("/api/auth/sign-out", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            if (!response.ok) throw new Error("Sign out failed");
            router.replace("/");
            router.refresh();
          } catch {
            setError(true);
          } finally {
            setPending(false);
          }
        }}
        className={s.logout}
      >
        <LogOut size={14} aria-hidden="true" />
        {pending ? "Logging out…" : "Log Out"}
      </button>
      {error && (
        <small role="alert" className={s.error}>
          Unable to log out. Try again.
        </small>
      )}
    </div>
  );
}
