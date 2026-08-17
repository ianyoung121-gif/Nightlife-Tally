import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

interface WheelItem {
  label: string;
  sublabel?: string;
}

interface RouletteWheelProps {
  items: WheelItem[];
  onResult: (index: number, item: WheelItem) => void;
  disabled?: boolean;
  spinLabel?: string;
  accentColor?: string;
}

const SEGMENT_COLORS = [
  { bg: "#FF2D78", text: "#ffffff" },
  { bg: "#7B2FFF", text: "#ffffff" },
  { bg: "#00E5FF", text: "#0A0A0F" },
  { bg: "#FF6B35", text: "#ffffff" },
  { bg: "#C026D3", text: "#ffffff" },
  { bg: "#0E7490", text: "#ffffff" },
  { bg: "#DB2777", text: "#ffffff" },
  { bg: "#6D28D9", text: "#ffffff" },
  { bg: "#059669", text: "#ffffff" },
  { bg: "#D97706", text: "#0A0A0F" },
  { bg: "#DC2626", text: "#ffffff" },
  { bg: "#4F46E5", text: "#ffffff" },
];

const CX = 150;
const CY = 150;
const R = 128;
const TEXT_R = R * 0.65;
const SPIN_DURATION_MS = 4400;

function toRad(deg: number) { return deg * Math.PI / 180; }

function segmentPath(startDeg: number, endDeg: number, cx: number, cy: number, r: number) {
  const x1 = cx + r * Math.sin(toRad(startDeg));
  const y1 = cy - r * Math.cos(toRad(startDeg));
  const x2 = cx + r * Math.sin(toRad(endDeg));
  const y2 = cy - r * Math.cos(toRad(endDeg));
  const large = (endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

export function RouletteWheel({ items, onResult, disabled, spinLabel = "SPIN", accentColor = "#FF2D78" }: RouletteWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const N = Math.max(items.length, 1);
  const segAngle = 360 / N;

  const handleSpin = () => {
    if (isSpinning || disabled || items.length === 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    setWinner(null);

    const winnerIdx = Math.floor(Math.random() * N);
    const midAngle = (winnerIdx + 0.5) * segAngle;
    // After rotating by R deg clockwise, pointer (at top=0°) covers angle (360-R%360)%360
    // We want that to equal midAngle, so: finalAngle = (360 - midAngle + 360) % 360
    const finalAngle = (360 - midAngle + 3600) % 360;
    const spins = 8;
    const base = Math.floor(rotation / 360) * 360 + spins * 360 + finalAngle;
    const newRotation = base <= rotation + spins * 360 * 0.5 ? base + 360 : base;

    setIsSpinning(true);
    setRotation(newRotation);

    timerRef.current = setTimeout(() => {
      setIsSpinning(false);
      setWinner(winnerIdx);
      onResult(winnerIdx, items[winnerIdx]);
    }, SPIN_DURATION_MS);
  };

  return (
    <div className="flex flex-col items-center gap-6 select-none">
      <div className="relative" style={{ filter: `drop-shadow(0 0 18px ${accentColor}55)` }}>
        <svg viewBox="0 0 300 300" width="280" height="280" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="inner-shadow">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#000" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Outer ring */}
          <circle cx={CX} cy={CY} r={R + 8} fill="#1a1a2e" stroke={accentColor} strokeWidth="2" opacity="0.6" />

          {/* Spinning group */}
          <g
            style={{
              transformOrigin: `${CX}px ${CY}px`,
              transform: `rotate(${rotation}deg)`,
              transition: isSpinning
                ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.17,0.67,0.12,0.99)`
                : "none",
            }}
          >
            {items.map((item, i) => {
              const startDeg = i * segAngle;
              const endDeg = (i + 1) * segAngle;
              const midDeg = startDeg + segAngle / 2;
              const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
              const tx = CX + TEXT_R * Math.sin(toRad(midDeg));
              const ty = CY - TEXT_R * Math.cos(toRad(midDeg));
              const label = item.label.length > 11 ? item.label.slice(0, 9) + "…" : item.label;

              return (
                <g key={i}>
                  <path
                    d={segmentPath(startDeg, endDeg, CX, CY, R)}
                    fill={color.bg}
                    stroke="#0A0A0F"
                    strokeWidth="1.5"
                  />
                  <text
                    x={tx}
                    y={ty}
                    fill={color.text}
                    fontSize={N > 8 ? "8" : "9"}
                    fontWeight="800"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${midDeg}, ${tx}, ${ty})`}
                    style={{ fontFamily: "Outfit, sans-serif", letterSpacing: "0.3px", textTransform: "uppercase" }}
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Divider lines */}
            {items.map((_, i) => {
              const deg = i * segAngle;
              const x = CX + R * Math.sin(toRad(deg));
              const y = CY - R * Math.cos(toRad(deg));
              return (
                <line key={`div-${i}`} x1={CX} y1={CY} x2={x} y2={y}
                  stroke="#0A0A0F" strokeWidth="2" />
              );
            })}
          </g>

          {/* Center cap */}
          <circle cx={CX} cy={CY} r={32} fill="#0A0A0F" stroke={accentColor} strokeWidth="3" />
          <circle cx={CX} cy={CY} r={28} fill="#12121f" />
          <text x={CX} y={CY} fill={accentColor} fontSize="8" fontWeight="900"
            textAnchor="middle" dominantBaseline="middle"
            style={{ fontFamily: "Space Mono, monospace", letterSpacing: "1px" }}>
            {isSpinning ? "…" : winner !== null ? "✓" : "GO"}
          </text>

          {/* Pointer arrow — fixed, does not rotate */}
          <polygon
            points={`${CX},${CY - R - 8} ${CX - 10},${CY - R + 14} ${CX + 10},${CY - R + 14}`}
            fill={accentColor}
            style={{ filter: `drop-shadow(0 0 6px ${accentColor})` }}
          />
        </svg>

        {/* Winner glow ring */}
        {winner !== null && !isSpinning && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none animate-pulse"
            style={{ boxShadow: `0 0 40px 8px ${accentColor}55`, borderRadius: "50%" }}
          />
        )}
      </div>

      <Button
        onClick={handleSpin}
        disabled={isSpinning || disabled || items.length === 0}
        size="lg"
        className="w-full max-w-xs font-black uppercase tracking-widest text-lg h-14 relative overflow-hidden"
        style={{
          background: isSpinning
            ? "linear-gradient(135deg, #333, #555)"
            : `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`,
          boxShadow: isSpinning ? "none" : `0 0 20px ${accentColor}66`,
        }}
      >
        {isSpinning ? (
          <span className="animate-pulse">Spinning…</span>
        ) : (
          <span>{spinLabel}</span>
        )}
      </Button>
    </div>
  );
}
