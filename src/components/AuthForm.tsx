"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import s from "./AuthForm.module.css";
import { safeReturnTo } from "@/lib/navigation";

export function AuthForm({
  mode,
  returnTo,
}: {
  mode: "login" | "register";
  returnTo?: string;
}) {
  const destination = safeReturnTo(returnTo);
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const registration = mode === "register";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(
        `/api/auth/${registration ? "sign-up" : "sign-in"}/email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.get("email"),
            password: data.get("password"),
            ...(registration ? { name: data.get("name") } : {}),
          }),
        },
      );
      if (!response.ok) {
        setError(
          response.status === 429
            ? "Too many attempts. Please wait before trying again."
            : registration
              ? "Unable to register. Check your details or try signing in."
              : "Unable to sign in. Check your email and password.",
        );
        return;
      }
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <main className={s.page}>
      <section className={s.card}>
        <Link href="/" className={s.brand}>
          ↗ TradeSim <span>UAE</span>
        </Link>
        <p className={s.eyebrow}>YOUR INVESTING JOURNEY, SIMULATED</p>
        <h1>{registration ? "Start with confidence." : "Welcome back."}</h1>
        <p>
          {registration
            ? "Create your account with AED 100,000.00 in virtual capital."
            : "Sign in to your persistent virtual portfolio."}
        </p>
        <form onSubmit={submit} aria-busy={pending}>
          {registration && (
            <label>
              Name
              <input
                name="name"
                autoComplete="name"
                required
                maxLength={100}
                disabled={pending}
              />
            </label>
          )}
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              disabled={pending}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={registration ? "new-password" : "current-password"}
              required
              minLength={12}
              maxLength={128}
              disabled={pending}
              aria-describedby="password-help"
            />
          </label>
          <small id="password-help">
            Use 12–128 characters. Never reuse a brokerage password.
          </small>
          {error && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}
          <button disabled={pending} type="submit">
            {pending
              ? "Please wait…"
              : registration
                ? "Create virtual account"
                : "Sign in"}
          </button>
        </form>
        <p>
          {registration ? "Already registered?" : "New to TradeSim?"}{" "}
          <Link
            href={`${registration ? "/login" : "/register"}?returnTo=${encodeURIComponent(destination)}`}
          >
            {registration ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <Link href="/markets" className={s.back}>
          ← Explore the simulated markets
        </Link>
        <p className={s.disclosure}>
          Virtual funds only. Prices are simulated. Buy/Sell execution is
          unavailable until Phase 3.
        </p>
      </section>
    </main>
  );
}
