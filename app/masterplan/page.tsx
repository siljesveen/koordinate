import dynamic from "next/dynamic";

const MasterplanClient = dynamic(() => import("./MasterplanClient"), {
  loading: () => (
    <div style={{ padding: "2rem", fontWeight: 600, color: "var(--brand-muted)" }}>
      Laster masterplan …
    </div>
  ),
});

export default function MasterplanPage() {
  return <MasterplanClient />;
}
