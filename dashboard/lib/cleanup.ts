import { kv } from "@vercel/kv";
import { getAssignments } from "./assignments";
import { getSendEnabled, getSent } from "./sendEnabled";
import { getWorkspaces } from "./workspaces";

/** Drops per-recording assignment/send-toggle/workspace state for recordings
 * that have rolled off the visible window, so old entries don't pile up in KV.
 */
export async function pruneStaleMeetingState(currentIds: string[]): Promise<void> {
  // An empty list means Pocket returned nothing (outage, rate limit, bad
  // page) - not that every recording vanished. Pruning then would wipe every
  // "already sent" flag and assignment, making old meetings look new.
  if (currentIds.length === 0) return;

  const currentSet = new Set(currentIds);
  const [assignments, sendEnabled, workspaces, sent] = await Promise.all([
    getAssignments(),
    getSendEnabled(),
    getWorkspaces(),
    getSent(),
  ]);
  const staleSentKeys = Object.keys(sent).filter((id) => !currentSet.has(id));

  const staleAssignmentKeys = Object.keys(assignments).filter((id) => !currentSet.has(id));
  const staleSendEnabledKeys = Object.keys(sendEnabled).filter((id) => !currentSet.has(id));
  const staleWorkspaceKeys = Object.keys(workspaces).filter((id) => !currentSet.has(id));

  await Promise.all([
    staleAssignmentKeys.length > 0 ? kv.hdel("assignments", ...staleAssignmentKeys) : Promise.resolve(),
    staleSendEnabledKeys.length > 0 ? kv.hdel("sendEnabled", ...staleSendEnabledKeys) : Promise.resolve(),
    staleSentKeys.length > 0 ? kv.hdel("sentAt", ...staleSentKeys) : Promise.resolve(),
    staleWorkspaceKeys.length > 0 ? kv.hdel("workspaces", ...staleWorkspaceKeys) : Promise.resolve(),
  ]);
}
