// Stable part IDs are shared by the renderer, editor and server payload contract.
export const AVATAR_PIECES = [
  ['face', 'Face'], ['hair', 'Hair'], ['fringe', 'Signature fringe'],
  ['leftEar', 'Left ear'], ['rightEar', 'Right ear'],
  ['leftBrow', 'Left eyebrow'], ['rightBrow', 'Right eyebrow'],
  ['leftEye', 'Left eye'], ['rightEye', 'Right eye'],
  ['nose', 'Nose'], ['mouth', 'Mouth'], ['faceDetail', 'Face lines'],
  ['glasses', 'Glasses'], ['facialHair', 'Facial hair'],
  ['hat', 'Hat'], ['hatDecoration', 'Hat decoration'],
  ['outfit', 'Clothing'], ['outfitDecoration', 'Clothing pattern'],
  ['leftArm', 'Left arm'], ['rightArm', 'Right arm'],
  ['leftLeg', 'Left leg & shoe'], ['rightLeg', 'Right leg & shoe'],
  ['freckles', 'Freckles'], ['leftEarring', 'Left earring'], ['rightEarring', 'Right earring'],
  ['necklace', 'Necklace'], ['choker', 'Choker'], ['crossbody', 'Bag & strap'], ['tattoos', 'Tattoos'],
].map(([id, label]) => ({ id, label }));
export const AVATAR_PIECE_IDS = AVATAR_PIECES.map(part => part.id);
export const DEFAULT_PIECE_TRANSFORM = Object.freeze({ x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, flipY: false, hidden: false });
export const PIECE_LIMITS = Object.freeze({ position: 390, minScale: .1, maxScale: 4, rotation: 180 });
const bounded = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
export function getPieceTransform(config, id) {
  const t = config.pieceTransforms?.[id] ?? {};
  return {
    x: bounded(t.x, 0, -390, 390), y: bounded(t.y, 0, -390, 390),
    scale: bounded(t.scale, 1, .1, 4), scaleX: bounded(t.scaleX, 1, .1, 4), scaleY: bounded(t.scaleY, 1, .1, 4),
    rotation: bounded(t.rotation, 0, -180, 180), flipX: t.flipX === true, flipY: t.flipY === true, hidden: t.hidden === true,
  };
}
export function pieceTransformAttribute(t, cx, cy) {
  return `translate(${t.x} ${t.y}) translate(${cx} ${cy}) rotate(${t.rotation}) scale(${t.scale * t.scaleX * (t.flipX ? -1 : 1)} ${t.scale * t.scaleY * (t.flipY ? -1 : 1)}) translate(${-cx} ${-cy})`;
}
export function availableAvatarPieces(a) {
  const extras = a.extras ?? [];
  const optional = {
    hair: a.hairStyle !== 'none', fringe: a.signatureDetail === 'blueFrames',
    faceDetail: a.ageDetail !== 'none', glasses: a.glasses !== 'none', facialHair: a.facialHair !== 'none',
    hat: a.hat !== 'none', hatDecoration: a.hat === 'blackCap' && ['capPatch', 'redCapMark'].includes(a.signatureDetail),
    outfitDecoration: a.signatureDetail === 'geometricTop' || (a.signatureDetail === 'sunsetFlorals' && a.outfit === 'floral') || (a.signatureDetail === 'tropicalPrint' && a.outfit === 'openShirt'),
    freckles: extras.includes('freckles'), leftEarring: extras.includes('earrings'), rightEarring: extras.includes('earrings'),
    necklace: extras.includes('necklace'), choker: extras.includes('choker'), crossbody: extras.includes('crossbody'),
    tattoos: a.signatureDetail === 'starTattoos',
  };
  const photoHidden = new Set(['hair','fringe','leftEar','rightEar','leftBrow','rightBrow','leftEye','rightEye','nose','mouth','faceDetail','glasses','facialHair','hat','hatDecoration','freckles','leftEarring','rightEarring','choker']);
  return AVATAR_PIECES.filter(part => optional[part.id] !== false && (!a.photoFaceId || !photoHidden.has(part.id))).map(part => a.photoFaceId && part.id === 'face' ? { ...part, label: 'Photo head' } : part);
}
