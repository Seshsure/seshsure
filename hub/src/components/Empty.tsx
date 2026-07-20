// Empty states are invitations, not apologies.
export function Empty({ title, hint, dark = true }: { title: string; hint: string; dark?: boolean }) {
  return (
    <div className="rounded-lg border border-dashed px-5 py-8 text-center"
      style={{ borderColor: dark ? "#262C31" : "#E4E1DA", background: dark ? "transparent" : "#FFFFFF66" }}>
      <p className="text-[12px] font-bold" style={{ color: dark ? "#8B949C" : "#6E756B" }}>{title}</p>
      <p className="font-mono text-[9px] mt-1.5 leading-relaxed" style={{ color: dark ? "#5C666D" : "#9B9F98" }}>{hint}</p>
    </div>
  );
}
