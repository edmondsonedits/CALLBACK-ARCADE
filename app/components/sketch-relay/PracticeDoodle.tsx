import { starterOperations } from "../../../lib/drawing-editor";
/** Free deterministic practice art. This component never requests generated media. */
export function PracticeDoodle({ seed = "practice", className, label = "Free practice doodle · no AI", restriction, starter }: { seed?: string; className?: string; label?: string; restriction?: string; starter?: string }) {
  const variant = [...seed].reduce((value, character) => value + character.charCodeAt(0), 0) % 3;
  if (starter || restriction === "circles" || restriction === "lines") return <figure className={className} style={{ margin: 0 }}><svg viewBox="0 0 1024 1024" role="img" aria-label={starter ? `Practice sketch using a ${starter}` : `Practice sketch: ${restriction}`} style={{ display: "block", width: "100%", height: "auto", background: "white", borderRadius: 12 }}><g fill="none" stroke="#111a39" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round">
    {starter ? starterOperations(starter).map((op, i) => op.type === "stroke" ? <polyline key={i} points={op.points.map(p => `${p.x * 1024},${p.y * 1024}`).join(" ")} /> : op.type === "line" ? <line key={i} x1={op.from.x*1024} y1={op.from.y*1024} x2={op.to.x*1024} y2={op.to.y*1024}/> : op.type === "ellipse" ? <ellipse key={i} cx={(op.from.x+op.to.x)*512} cy={(op.from.y+op.to.y)*512} rx={Math.abs(op.to.x-op.from.x)*512} ry={Math.abs(op.to.y-op.from.y)*512}/> : null) : restriction === "circles" ? <><circle cx="512" cy="520" r="235"/><circle cx="320" cy="310" r="95"/><circle cx="700" cy="310" r="95"/><circle cx="425" cy="475" r="30"/><circle cx="600" cy="475" r="30"/><circle cx="512" cy="590" r="55"/></> : <><polyline points="230,800 230,350 350,350 350,220 460,350 570,220 680,350 800,350 800,800 230,800"/><polyline points="440,800 440,620 580,620 580,800"/><line x1="320" y1="450" x2="320" y2="520"/><line x1="700" y1="450" x2="700" y2="520"/></>}
  </g></svg><figcaption style={{ padding: "8px 0", fontSize: 12, textAlign: "center" }}>{label}</figcaption></figure>;
  return <figure className={className} style={{ margin: 0 }}>
    <svg viewBox="0 0 480 480" role="img" aria-label="A hand-drawn cat wearing a party hat" style={{ display: "block", width: "100%", height: "auto", background: "white", borderRadius: 12 }}>
      <g fill="none" stroke="#111a39" strokeWidth={restriction === "giant-brush" ? 23 : 8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M136 246 123 157 184 189M294 187 353 154 339 249" />
        <path d="M139 220C106 270 135 356 239 361S373 279 336 222C297 179 179 180 139 220Z" />
        <path d="m177 185 60-112 58 113" fill={restriction === "no-fill" ? "none" : restriction === "limited-palette" ? "#ffd84b" : ["#ffd84b", "#46dbdc", "#ff6f61"][variant]} />
        <path d="M153 269h-50m50 21-52 14m224-36h49m-50 20 52 18M224 298l16 13 16-13m-16 13v20m-25 2c15 11 35 11 49 0" />
        <path d="m182 251 15-5m84 0 15 5" />
        <circle cx="197" cy="267" r="4" fill={restriction === "no-fill" ? "none" : "#111a39"} /><circle cx="281" cy="267" r="4" fill={restriction === "no-fill" ? "none" : "#111a39"} />
        <path d="m116 107 5-15m-22 7 16 7m246 14 9-12m-3 33 17 3" stroke={restriction === "limited-palette" ? "#ff6f61" : "#9c7cff"} />
      </g>
    </svg>
    <figcaption style={{ padding: "8px 0", fontSize: 12, textAlign: "center" }}>{label}</figcaption>
  </figure>;
}
