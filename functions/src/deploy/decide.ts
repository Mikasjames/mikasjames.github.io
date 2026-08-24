export type DeployDecision = {
  trigger: boolean;
  reason: string;
};

function isLive(status?: string): boolean {
  return status === 'published' || status === 'unlisted';
}

export function decideDeploy(
  oldStatus: string | undefined,
  newStatus: string | undefined,
  deleted: boolean,
): DeployDecision {
  if (deleted) {
    return { trigger: true, reason: 'Post deleted — triggering deploy to remove from site' };
  }

  const wasLive = isLive(oldStatus);
  const isNowLive = isLive(newStatus);

  if (!wasLive && !isNowLive) {
    return { trigger: false, reason: 'Post is a draft — skipping deploy' };
  }
  if (wasLive && !isNowLive) {
    return { trigger: true, reason: 'Post moved to draft — triggering deploy to remove from site' };
  }
  return { trigger: true, reason: `Post status is "${newStatus}" — triggering deploy` };
}
