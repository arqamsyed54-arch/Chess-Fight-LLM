/* Unit: square<->3D mapping + position diff (rules live server-side; this only describes animation). */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sqToPos, posToSq, parsePlacement, diffPositions } from '../backend/static/js/coord.js';

describe('square mapping', () => {
  it('corners land correctly (white perspective, +z near)', () => {
    assert.deepEqual(sqToPos('a1'), { x: -4.375, z: 4.375 });
    assert.deepEqual(sqToPos('h8'), { x: 4.375, z: -4.375 });
    assert.deepEqual(sqToPos('e4'), { x: 0.625, z: 0.625 });
  });
  it('round-trips all 64 squares', () => {
    for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
      const sq = 'abcdefgh'[f] + (r + 1);
      const p = sqToPos(sq);
      assert.equal(posToSq(p.x, p.z), sq);
    }
  });
  it('rejects off-board points', () => {
    assert.equal(posToSq(99, 99), null);
  });
});
describe('diffPositions', () => {
  const START = parsePlacement('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  it('normal move e2e4', () => {
    const nx = { ...START }; delete nx.e2; nx.e4 = 'P';
    const f = diffPositions(START, nx);
    assert.equal(f.from, 'e2'); assert.equal(f.to, 'e4'); assert.equal(f.moved, 'P');
    assert.equal(f.captured, null); assert.equal(f.castle, null);
  });
  it('capture e4xd5', () => {
    const p = { ...START, e4: 'P' }; delete p.e2;
    const mid = { ...p, d5: 'p' }; delete mid.d7;
    const nx = { ...mid }; delete nx.e4; delete nx.d5; nx.d5 = 'P';
    const f = diffPositions(mid, nx);
    assert.equal(f.from, 'e4'); assert.equal(f.to, 'd5');
    assert.equal(f.captured, 'p'); assert.equal(f.captureSq, 'd5');
  });
  it('kingside castling moves king + rook', () => {
    const p = parsePlacement('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
    const nx = { ...p }; delete nx.e1; delete nx.h1; nx.g1 = 'K'; nx.f1 = 'R';
    const f = diffPositions(p, nx);
    assert.equal(f.from, 'e1'); assert.equal(f.to, 'g1');
    assert.deepEqual(f.castle, { rookFrom: 'h1', rookTo: 'f1' });
  });
  it('en passant removes the bypassed pawn', () => {
    const p = parsePlacement('k7/3p4/8/4P3/8/8/8/7K b - - 0 1');
    const mid = { ...p }; delete mid.d7; mid.d5 = 'p';
    const nx = { ...mid }; delete nx.e5; delete nx.d5; nx.d6 = 'P';
    const f = diffPositions(mid, nx);
    assert.equal(f.from, 'e5'); assert.equal(f.to, 'd6');
    assert.equal(f.captured, 'p'); assert.equal(f.captureSq, 'd5'); assert.equal(f.ep, true);
  });
  it('promotion swaps the pawn', () => {
    const p = parsePlacement('k7/4P3/8/8/8/8/8/7K w - - 0 1');
    const nx = { ...p }; delete nx.e7; nx.e8 = 'Q';
    const f = diffPositions(p, nx);
    assert.equal(f.from, 'e7'); assert.equal(f.promotion, 'Q');
  });
});
