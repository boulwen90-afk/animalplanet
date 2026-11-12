import { RESOURCE_TYPES, type Cost, type ResourceType } from '../data/resources';
import type { PlayerState } from './state';

/** The resources a side lacks to pay a cost; empty if it can afford it. */
export function missingResources(player: PlayerState, cost: Cost): ResourceType[] {
  return RESOURCE_TYPES.filter((resource) => player.resources[resource] < (cost[resource] ?? 0));
}

/** Takes a cost out of a side's stock. The caller checks that it can afford it. */
export function pay(player: PlayerState, cost: Cost): void {
  for (const resource of RESOURCE_TYPES) player.resources[resource] -= cost[resource] ?? 0;
}

/** Puts a cost back into a side's stock. */
export function refund(player: PlayerState, cost: Cost): void {
  for (const resource of RESOURCE_TYPES) player.resources[resource] += cost[resource] ?? 0;
}
