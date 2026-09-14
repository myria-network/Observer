import test from 'node:test';
import assert from 'node:assert/strict';
import {tokenAvatarArt,tokenAvatarPng,tokenInitial} from '../src/token-avatar.js';

test('token portraits are deterministic, seed-specific and slightly dense',()=>{
  const first='01'.repeat(32),second='02'.repeat(32),portrait=tokenAvatarArt(first,'SPORE');
  assert.deepEqual(portrait,tokenAvatarArt(first,'SPORE'));
  assert.notDeepEqual(portrait,tokenAvatarArt(second,'SPORE'));
  assert.ok(portrait.pixels.length>=50&&portrait.pixels.length<=196);
  assert.equal(tokenAvatarArt(first,'MYR').primary,'#a78bfa');
  assert.equal(tokenInitial('TMYR','Test MYR'),'M');
});

test('token portrait validates public inputs and requires a browser for PNG output',()=>{
  assert.throws(()=>tokenAvatarArt('not-an-asset','BAD'),/INVALID_ASSET_ID/);
  assert.throws(()=>tokenAvatarPng('01'.repeat(32),'SPORE','Spore'),/TOKEN_CANVAS_UNAVAILABLE/);
});
