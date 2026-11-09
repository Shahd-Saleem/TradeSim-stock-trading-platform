import s from "./WorkspaceSkeleton.module.css";
export function WorkspaceSkeleton() {
  return (
    <main className={s.shell} aria-busy="true" aria-label="Loading workspace">
      <div role="status">Loading TradeSim UAE…</div>
      <div className={s.title} aria-hidden="true" />
      <div className={s.cards} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className={s.panel} aria-hidden="true" />
    </main>
  );
}
