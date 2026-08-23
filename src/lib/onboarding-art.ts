/**
 * The onboarding photographs.
 *
 * Placeholders for now — soft washes with a faint grid, deliberately not stock family
 * photos. A stand-in that looks like a real photograph is the worst option: whoever
 * picks up this screen next cannot tell whether the art is finished, and a launch
 * with someone else's family on the first screen of a product about *your* family is
 * a mistake that only gets noticed after it ships.
 *
 * Swapping in the real assets is a file replacement, not a code change. Drop images
 * with these exact names into `assets/onboarding/` and nothing here needs editing:
 *
 *   slide-one.png     ~4:3, the first tour panel
 *   slide-two.png     ~4:3
 *   slide-three.png   ~4:3
 *   face-one.png      ~3:4 portrait, the left card on the splash
 *   face-two.png      ~3:4 portrait, the centre card (drawn larger)
 *   face-three.png    ~3:4 portrait, the right card
 *
 * `require` is resolved at bundle time, so the paths must stay literal — this is why
 * they are listed rather than built from a loop.
 */

export const splashFaces = [
  require('../../assets/onboarding/face-one.png'),
  require('../../assets/onboarding/face-two.png'),
  require('../../assets/onboarding/face-three.png'),
] as const;

export const tourArt = [
  require('../../assets/onboarding/slide-one.png'),
  require('../../assets/onboarding/slide-two.png'),
  require('../../assets/onboarding/slide-three.png'),
] as const;

/** True while the shipped art is still the generated stand-in. */
export const usingPlaceholderArt = true;
