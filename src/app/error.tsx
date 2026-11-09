"use client";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <main style={{ padding: 48 }}>
      <h1>Workspace temporarily unavailable.</h1>
      <p>Your saved account has not been reset. Please try again.</p>
      <button onClick={reset}>Retry</button>
    </main>
  );
}
