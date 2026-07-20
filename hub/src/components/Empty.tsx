// Empty states are invitations, not apologies.
export function Empty({ title, hint }: { title: string; hint: string; dark?: boolean }) {
  return (
    <div className="rounded-lg border-2 border-dashed px-5 py-8 text-center"
      style={{ borderColor: "#E7DFCE", background: "#FFFFFF88" }}>
      <p className="text-[14px] font-bold" style={{ color: "#3E3A30" }}>{title}</p>
      <p className="font-mono text-[11px] mt-1.5 leading-relaxed" style={{ color: "#5C574A" }}>{hint}</p>
    </div>
  );
}
