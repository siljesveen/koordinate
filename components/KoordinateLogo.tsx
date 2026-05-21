type Props = {
  size?: number;
  className?: string;
};

/** Hub-logo: sentral ring med linjer ut til koblingspunkter. */
export default function KoordinateLogo({ size = 28, className }: Props) {
  const cx = 16;
  const cy = 16;
  const hubR = 3.2;
  const nodeR = 2;
  const lineEnd = 13;

  const nodes = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * 60 - 90) * (Math.PI / 180);
    return {
      x: cx + lineEnd * Math.cos(angle),
      y: cy + lineEnd * Math.sin(angle),
    };
  });

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {nodes.map((n, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={n.x}
          y2={n.y}
          stroke="var(--brand-sky, #06B6D4)"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.85"
        />
      ))}
      {nodes.map((n, i) => (
        <circle
          key={`n-${i}`}
          cx={n.x}
          cy={n.y}
          r={nodeR}
          fill="var(--brand-primary, #2563EB)"
        />
      ))}
      <circle
        cx={cx}
        cy={cy}
        r={hubR}
        stroke="var(--brand-light, #F1F5F9)"
        strokeWidth="1.4"
        fill="none"
      />
      <circle cx={cx} cy={cy} r="1.1" fill="var(--brand-primary, #2563EB)" />
    </svg>
  );
}
