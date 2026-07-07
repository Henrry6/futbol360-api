import * as roundRobin from "./round-robin";
import * as groups from "./groups";
import * as knockout from "./knockout";
import * as roundRobinDouble from "./round-robin-double";

const competitions = {
  round_robin: roundRobin,
  round_robin_double: roundRobinDouble,
  groups,
  knockout,
};
export function getCompetition(mode: keyof typeof competitions) {
  return competitions[mode];
}
