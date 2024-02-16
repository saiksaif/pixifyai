import { useEffect, useRef } from 'react';
import { useAdsContext } from '~/components/Ads/AdsProvider';
import { useFiltersContext } from '~/providers/FiltersProvider';
import { BrowsingMode } from '~/server/common/enums';
import { AddViewSchema } from '~/server/schema/track.schema';
import { trpc } from '~/utils/trpc';

export function TrackView({
  type,
  entityType,
  entityId,
  details,
  nsfw: nsfwOverride,
}: AddViewSchema) {
  const trackMutation = trpc.track.addView.useMutation();
  const observedEntityId = useRef<number | null>(null);

  const status = useAdViewSatus();
  const nsfw = useFiltersContext(
    (state) => nsfwOverride ?? state.browsingMode !== BrowsingMode.SFW
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (entityId !== observedEntityId.current) {
        observedEntityId.current = entityId;
        trackMutation.mutate({
          type,
          entityType,
          entityId,
          details,
          ads: status,
          nsfw,
        });
      }
    }, 1000);
    return () => {
      clearTimeout(timeout);
    };
  }, [entityId, type, entityType, details]);

  return null;
}

function useAdViewSatus() {
  const { isMember, enabled, adsBlocked } = useAdsContext();
  if (isMember) return 'Member';
  if (!enabled) return 'Off';
  if (adsBlocked) return 'Blocked';
  return 'Served';
}
