import test from 'node:test';
import assert from 'node:assert/strict';
import {walletAvatar,walletAvatarRgba} from '../src/wallet-avatar.js';

const first='myr_w_'+'a'.repeat(52);
const second='myr_w_'+'b'.repeat(52);

test('wallet portraits are deterministic, address-specific and fill the frame',()=>{
  const portrait=walletAvatar(first);
  assert.deepEqual(portrait,walletAvatar(first));
  assert.notDeepEqual(portrait,walletAvatar(second));
  assert.equal(portrait.version,10);
  assert.equal(portrait.size,96);
  assert.ok(['islands','stream','canopy','forks','rift'].includes(portrait.composition));
  assert.ok(portrait.density>=.28&&portrait.density<=.72);
  assert.ok(portrait.pixels.length>40);
  assert.ok(portrait.nodes.length>=4);
  assert.ok(portrait.gridRegions.length>=1);
  assert.equal(Object.hasOwn(portrait,'letter'),false);
  assert.equal(Object.hasOwn(portrait,'core'),false);
});

test('wallet raster output is square RGBA and validates public inputs',()=>{
  const image=walletAvatarRgba(first,300);
  assert.equal(image.width,300);
  assert.equal(image.height,300);
  assert.equal(image.bytes.length,300*300*4);
  assert.throws(()=>walletAvatar(''),/INVALID_WALLET_ADDRESS/);
  assert.throws(()=>walletAvatarRgba(first,299),/INVALID_WALLET_AVATAR_SIZE/);
  assert.throws(()=>walletAvatarRgba(first,1025),/INVALID_WALLET_AVATAR_SIZE/);
});
