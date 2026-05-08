/**
 * TSUNAMI Memory Classifier — keyword-based text classification
 *
 * Maps memory content to wing/room/basin for automatic routing.
 * Keyword data lives in classifier_keywords.ts for maintainability.
 */

import { WING_KEYWORDS, ROOM_KEYWORDS } from './classifier_keywords';
import type { KeywordPair } from './classifier_keywords';

export type { KeywordPair };

export type StructuredClassification = {
  wing: string;
  room: string;
  basin: string;
  current: string;
  confidence: number;
};

/** Score a set of keywords against a text, returning matched weight total and max possible. */
function scoreKeywords(text: string, keywords: KeywordPair[]): { score: number; hits: number } {
  const lower = text.toLowerCase();
  let score = 0;
  let hits = 0;
  for (const [kw, weight] of keywords) {
    if (lower.includes(kw.toLowerCase())) {
      score += weight;
      hits += 1;
    }
  }
  return { score, hits };
}

/**
 * Normalize a raw keyword score into a [0, 1] confidence value.
 * Uses a sigmoid-ish curve: confidence = 1 - 1/(1 + score/FACTOR)
 * where FACTOR is the expected "strong match" total score threshold.
 */
function normalizeConfidence(rawScore: number): number {
  const FACTOR = 10; // calibrated so score=10 → ~0.5, score=25 → ~0.71, score=40 → ~0.8
  const confidence = 1 - 1 / (1 + rawScore / FACTOR);
  return Math.min(1.0, Math.round(confidence * 100) / 100);
}

const MIN_WING_SCORE = 1.5; // minimum score to classify — catches room-cascaded weak signals

/** Classify text into a single wing/room pair. Returns null if no wing exceeds minimum threshold. */
export function classifyMemory(text: string): StructuredClassification | null {
  const lower = text.toLowerCase();

  // Find best wing — cascade room keywords into wing scoring
  // so terms that only appear at the room level still contribute
  let bestWing = '';
  let bestScore = 0;
  for (const [wing, keywords] of Object.entries(WING_KEYWORDS)) {
    let { score } = scoreKeywords(lower, keywords);
    // Boost wing score from room-level matches within this wing
    const rooms = ROOM_KEYWORDS[wing];
    if (rooms) {
      for (const [, roomKws] of Object.entries(rooms)) {
        score += scoreKeywords(lower, roomKws).score * 0.6; // room hits are weaker wing signals
      }
    }
    if (score > bestScore) { bestWing = wing; bestScore = score; }
  }
  if (!bestWing || bestScore < MIN_WING_SCORE) return null;

  // Find best room within that wing
  const rooms = ROOM_KEYWORDS[bestWing];
  let bestRoom = 'general';
  let bestRoomScore = 0;
  if (rooms) {
    for (const [room, keywords] of Object.entries(rooms)) {
      const { score } = scoreKeywords(lower, keywords);
      if (score > bestRoomScore) { bestRoom = room; bestRoomScore = score; }
    }
  }

  return {
    wing: bestWing,
    room: bestRoom,
    basin: bestWing,
    current: bestRoom,
    confidence: normalizeConfidence(bestScore),
  };
}

/** classifyTsunamiText — simpler API returning basin/current/confidence. */
export function classifyTsunamiText(text: string): {
  basin: string; current: string; confidence: number;
} {
  const result = classifyMemory(text);
  if (!result) return { basin: 'surface', current: 'surface/bridge', confidence: 0.2 };
  return { basin: result.basin, current: result.current, confidence: result.confidence };
}

/** classifyTsunamiTextMulti — top-N classifications with proper room matching per wing. */
export function classifyTsunamiTextMulti(
  text: string,
  top = 3,
): Array<{ basin: string; current: string; confidence: number }> {
  const lower = text.toLowerCase();

  // Score each wing independently, cascading room keywords in
  const wingScores: Array<{ wing: string; score: number }> = [];
  for (const [wing, keywords] of Object.entries(WING_KEYWORDS)) {
    let { score } = scoreKeywords(lower, keywords);
    const rooms = ROOM_KEYWORDS[wing];
    if (rooms) {
      for (const [, roomKws] of Object.entries(rooms)) {
        score += scoreKeywords(lower, roomKws).score * 0.6;
      }
    }
    if (score > 0) wingScores.push({ wing, score });
  }
  wingScores.sort((a, b) => b.score - a.score);

  return wingScores.slice(0, Math.max(1, top)).map((entry) => {
    // Find best room within this wing
    const rooms = ROOM_KEYWORDS[entry.wing];
    let bestRoom = entry.wing;
    let bestRoomScore = 0;
    if (rooms) {
      for (const [room, keywords] of Object.entries(rooms)) {
        const { score } = scoreKeywords(lower, keywords);
        if (score > bestRoomScore) { bestRoom = room; bestRoomScore = score; }
      }
    }
    const current = bestRoomScore > 0 ? bestRoom : entry.wing;
    return {
      basin: entry.wing,
      current,
      confidence: normalizeConfidence(entry.score),
    };
  });
}
