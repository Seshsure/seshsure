// Empty states are invitations, not apologies.
export function Empty({ title, hint }: { title: string; hint: string; dark?: boolean }) {
  return (
    <div className="rounded-lg border-2 border-dashed px-5 py-8 text-center"
      style={{ borderColor: "#E7DFCE", background: "#FFFFFF88" }}>
      <p className="text-[12px] font-bold" style={{ color: "#514C41" }}>{title}</p>
      <p className="font-mono text-[9px] mt-1.5 leading-relaxed" style={{ color: "#7A7365" }}>{hint}</p>
    </div>
  );
}
