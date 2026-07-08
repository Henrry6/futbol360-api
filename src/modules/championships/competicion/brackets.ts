// brackets.ts

import { Types } from "mongoose";
import { Standing } from "./standings";

export interface BracketMatch {
  order: number;
  local: {
    team: Types.ObjectId;
    position: number;
  };
  visitor: {
    team: Types.ObjectId;
    position: number;
  };
}

export function createBracket(qualifiers: Standing[]): BracketMatch[] {
  const matches: BracketMatch[] = [];

  const total = qualifiers.length;

  for (let i = 0; i < total / 2; i++) {
    matches.push({
      order: i + 1,
      local: qualifiers[i],
      visitor: qualifiers[total - 1 - i],
    });
  }

  return matches;
}
