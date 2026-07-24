import type { Campaign, CampaignId } from '../types';
import { infiltratorCampaign } from './infiltrator';
import { sentinelCampaign } from './sentinel';

export const chapter1Campaigns: Record<CampaignId, Campaign> = {
  infiltrator: infiltratorCampaign,
  sentinel: sentinelCampaign,
};
