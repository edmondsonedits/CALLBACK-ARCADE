import type { CrownState } from "../../../lib/presentation/types";

export function Crown({ state = "brand", title, className = "" }: { state?: CrownState; title?: string; className?: string }) {
  const label = title ?? ({ brand: "King Prompter crown", candidate: "Candidate", advancing: "Advancing", "round-winner": "Round winner", "overall-champion": "Overall champion", tie: "Tied winner", disabled: "Unavailable" } satisfies Record<CrownState, string>)[state];
  return (
    <svg className={`kp-crown kp-crown-${state} ${className}`} viewBox="0 0 512 512" role="img" aria-label={label}>
      <path className="kp-crown-body" d="M62 164 153 251 194 95 256 229 318 95 359 251 450 164 417 381H95Z" />
      <path className="kp-crown-rim" d="M94 347H418L408 410H104Z" />
      <path className="kp-crown-centre" d="m256 252 34 46-34 46-34-46Z" />
      <circle className="kp-crown-jewel kp-crown-jewel-coral" cx="151" cy="309" r="17" />
      <circle className="kp-crown-jewel kp-crown-jewel-cyan" cx="361" cy="309" r="17" />
    </svg>
  );
}

