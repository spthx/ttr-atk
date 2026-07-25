import type { AllianceState, Property } from '../types';

export const ALLIANCE_SUPPORT_MARKET_RATIO = 0.32;

export const getAllianceKind = (alliance: AllianceState) =>
  alliance.allyKind ?? 'company';

export const isPublicPatronage = (alliance: AllianceState) =>
  getAllianceKind(alliance) === 'grand_company';

export const shouldBreakAllianceForTarget = (
  alliance: AllianceState,
  targetProperty: Pick<Property, 'ownerName'>
) =>
  alliance.active &&
  !isPublicPatronage(alliance) &&
  alliance.allyName.length > 0 &&
  targetProperty.ownerName.includes(alliance.allyName);

export const calculateAllianceSupport = (marketPrice: number) =>
  Math.round(Math.max(0, marketPrice) * ALLIANCE_SUPPORT_MARKET_RATIO);
