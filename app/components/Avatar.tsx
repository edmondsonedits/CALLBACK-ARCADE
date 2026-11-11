import { useState } from "react";
import type { AvatarConfig } from "../../lib/avatar-runtime";
import { DEFAULT_AVATAR, clone, renderAvatar } from "../../lib/avatar-runtime";
import type { AvatarPose } from "../../lib/avatar-pose";
import { useAvatarPose } from "./AvatarPoseProvider";

const FALLBACK_FACES = ["oval", "round", "long", "heart", "softSquare", "diamond"];
const FALLBACK_HAIR = ["sidepart", "waves", "crop", "bob", "sweptUp", "shortCurls", "pixie", "spikyCrop", "lowPony", "tightCurls", "receding", "braid"];
const FALLBACK_HAIR_COLORS = ["darkBrown", "auburn", "black", "brown", "copper", "ashBlonde", "espresso", "blonde", "gray", "strawberry", "darkBrown", "brown"];
const FALLBACK_EYES = ["blue", "green", "brown", "hazel", "grayBlue", "dark"];

function generatedAvatar(index: number, color: string): AvatarConfig {
  return {
    ...clone(DEFAULT_AVATAR),
    faceShape: FALLBACK_FACES[index % FALLBACK_FACES.length],
    hairStyle: FALLBACK_HAIR[index % FALLBACK_HAIR.length],
    hairColor: FALLBACK_HAIR_COLORS[index % FALLBACK_HAIR_COLORS.length],
    browColor: FALLBACK_HAIR_COLORS[index % FALLBACK_HAIR_COLORS.length],
    eyeColor: FALLBACK_EYES[index % FALLBACK_EYES.length],
    eyeStyle: index % 3 === 0 ? "happy" : index % 3 === 1 ? "almond" : "soft",
    mouthStyle: index % 2 === 0 ? "toothy" : "softSmile",
    outfit: index % 4 === 0 ? "hoodie" : index % 4 === 1 ? "openShirt" : index % 4 === 2 ? "tee" : "button",
    outfitColor: color,
    outfitAccent: index % 2 === 0 ? "yellow" : "blue",
    extras: index % 5 === 0 ? ["freckles"] : [],
  };
}

export function Avatar({
  index,
  color,
  config,
  size = "medium",
  label,
  animation = "idle",
  playerId,
  pose: suppliedPose,
  interactive = false,
}: {
  index: number;
  color: string;
  config?: AvatarConfig | null;
  size?: "small" | "medium" | "large";
  label?: string;
  animation?: string;
  playerId?: string;
  pose?: AvatarPose | null;
  interactive?: boolean;
}) {
  const [failedFace, setFailedFace] = useState<string | null>(null);
  const shownConfig = config?.photoFaceId === failedFace ? { ...config, photoFaceId: undefined } : config;
  const remotePose = useAvatarPose(playerId);
  const pose = suppliedPose ?? remotePose;
  const markup = renderAvatar(shownConfig ?? generatedAvatar(index, color), { animation, label: label ?? "CALLBACK avatar", ...(pose ? { pose } : {}), interactive });
  return (
    <span
      className={`avatar avatar-${size} callback-avatar${pose ? " live-pose" : ""}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      onErrorCapture={() => { if (config?.photoFaceId) setFailedFace(config.photoFaceId); }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
