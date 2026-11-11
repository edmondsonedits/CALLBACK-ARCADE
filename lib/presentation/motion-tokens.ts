export const motionDurations = { instant: .08, micro: .16, standard: .24, stage: .42, dramatic: .7, ceremonial: 1.2 } as const;
export const motionEasing = { standard: [.2, .8, .2, 1], exit: [.4, 0, 1, 1], mascot: [.2, 1.25, .4, 1] } as const;

export const reducedMotionTransition = { duration: motionDurations.instant, ease: "linear" as const };

export interface PresentationMotionPolicy {
  travel: boolean;
  ambient: boolean;
  particles: boolean;
  pigeonTravel: boolean;
  transitionSeconds: number;
}

export function presentationMotionPolicy(reduced: boolean): PresentationMotionPolicy {
  return reduced
    ? { travel: false, ambient: false, particles: false, pigeonTravel: false, transitionSeconds: motionDurations.instant }
    : { travel: true, ambient: true, particles: true, pigeonTravel: true, transitionSeconds: motionDurations.stage };
}
