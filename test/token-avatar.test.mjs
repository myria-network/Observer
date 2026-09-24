import test from 'node:test';
import assert from 'node:assert/strict';
import {tokenAvatarArt,tokenAvatarPng,tokenInitial} from '../src/token-avatar.js';
import {tokenAvatarArt as coreTokenAvatarArt} from '@myria-network/core';

test('token portraits are deterministic, seed-specific and slightly dense',()=>{
  const first='01'.repeat(32),second='02'.repeat(32),root='03'.repeat(32),portrait=tokenAvatarArt(first,'SPORE','Spore',root);
  assert.strictEqual(tokenAvatarArt,coreTokenAvatarArt);
  assert.deepEqual(portrait,tokenAvatarArt(first,'SPORE','Spore',root));
  assert.notDeepEqual(portrait,tokenAvatarArt(second,'SPORE','Spore',root));
  assert.ok(portrait.pixels.length>=50&&portrait.pixels.length<=196);
  assert.equal(tokenAvatarArt(root,'TMYR','MYRIA',root).primary,'#a78bfa');
  assert.notEqual(tokenAvatarArt(first,'MYR','MYRIA',root).primary,'#a78bfa');
  assert.equal(tokenInitial('TMYR','Test MYR'),'M');
});

test('token portrait validates public inputs and requires a browser for PNG output',()=>{
  assert.throws(()=>tokenAvatarArt('not-an-asset','BAD','Bad','03'.repeat(32)),/INVALID_ASSET_ID/);
  assert.throws(()=>tokenAvatarPng('01'.repeat(32),'SPORE','Spore','03'.repeat(32)),/TOKEN_CANVAS_UNAVAILABLE/);
});
