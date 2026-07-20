"use client";
import { useState } from "react";

export function CopyLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
      className="font-mono text-[10px] font-bold px-2 py-1 rounded border-2"
      style={copied ? { background: "#0D9488", color: "#fff", borderColor: "#0D9488" } : { borderColor: "#E7DFCE", color: "#3E3A30" }}>
      {copied ? "✓ COPIED" : `COPY LINK — ${label.toUpperCase()}`}
    </button>
  );
}
