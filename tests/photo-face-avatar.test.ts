import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AVATAR, renderAvatar } from '../lib/avatar-runtime';
import { availableAvatarPieces } from '../lib/avatar-pieces';
import { AvatarConfigSchema } from '../lib/contracts';
import { changeCharacter, defaultCharacterProfile, undoCharacter, redoCharacter } from '../lib/character-profile';
const faceId = 'ba11958b-767c-4e45-a92d-b6a59ad3346c';
test('photo face survives validation and history without changing body', () => {
 const avatar = AvatarConfigSchema.parse({...DEFAULT_AVATAR, photoFaceId: faceId});
 const before = defaultCharacterProfile();
 const after = changeCharacter(before, avatar, null);
 assert.equal(after.avatarConfig.photoFaceId, faceId);
 assert.equal(after.avatarConfig.outfit, before.avatarConfig.outfit);
 assert.equal(undoCharacter(after).avatarConfig.photoFaceId, undefined);
 assert.equal(redoCharacter(undoCharacter(after)).avatarConfig.photoFaceId, faceId);
});
test('photo head is inside the moving head group and replaces drawn facial features', () => {
 const svg = renderAvatar({...DEFAULT_AVATAR, photoFaceId: faceId}, {animation: 'wave'});
 assert.match(svg, new RegExp('/api/profile/face/' + faceId));
 assert.ok(svg.indexOf('class="head-group"') < svg.indexOf('/api/profile/face/'));
 assert.doesNotMatch(svg, /data-avatar-piece="(?:eyes|hair|nose|mouth|glasses)"/);
 assert.match(svg, /data-avatar-piece="outfit"/);
});
test('photo face cannot inject arbitrary URLs or SVG markup', () => {
 for (const photoFaceId of ['https://tracker.example/x', '" onload="alert(1)', '../other', '']) {
  assert.equal(AvatarConfigSchema.safeParse({...DEFAULT_AVATAR, photoFaceId}).success, false);
  assert.doesNotMatch(renderAvatar({...DEFAULT_AVATAR, photoFaceId}), /<image|tracker\.example|onload/);
 }
 assert.match(renderAvatar(DEFAULT_AVATAR), /data-avatar-piece="face"/);
});

test('photo head can be positioned as one piece without invisible facial controls', () => {
 const avatar = {...DEFAULT_AVATAR, photoFaceId:faceId};
 const parts = availableAvatarPieces(avatar);
 assert.equal(parts.find(p=>p.id==='face')?.label, 'Photo head');
 assert.equal(parts.some(p=>p.id==='nose'), false);
 assert.equal(parts.some(p=>p.id==='outfit'), true);
 assert.match(renderAvatar(avatar), /data-avatar-piece="face"/);
});
