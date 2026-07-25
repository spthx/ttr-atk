import type { AllianceAllyKind, AllianceRelationType } from '../types';

export interface AllianceCandidate {
  allyId: string;
  allyName: string;
  allyKind: AllianceAllyKind;
  relationType: AllianceRelationType;
  summary: string;
}

export const ALLIANCE_CANDIDATES: readonly AllianceCandidate[] = [
  {
    allyId: 'garland_ironworks',
    allyName: 'ガーロンド・アイアンワークス',
    allyKind: 'company',
    relationType: 'commercial_alliance',
    summary: '技術・輸送面で協力する外部カンパニー。相互不可侵を伴う協力協定です。',
  },
  {
    allyId: 'grand_company_twin_adder',
    allyName: '双蛇党',
    allyKind: 'grand_company',
    relationType: 'public_patronage',
    summary: '黒衣森の資源調達と通商許可に関する公的後援を申請します。',
  },
  {
    allyId: 'grand_company_maelstrom',
    allyName: '黒渦団',
    allyKind: 'grand_company',
    relationType: 'public_patronage',
    summary: '海運・港湾物流に関する公的後援を申請します。',
  },
  {
    allyId: 'grand_company_immortal_flames',
    allyName: '不滅隊',
    allyKind: 'grand_company',
    relationType: 'public_patronage',
    summary: '商都ウルダハの調達・通商に関する公的後援を申請します。',
  },
] as const;

export const GRAND_COMPANY_NAMES = ALLIANCE_CANDIDATES
  .filter((candidate) => candidate.allyKind === 'grand_company')
  .map((candidate) => candidate.allyName);
