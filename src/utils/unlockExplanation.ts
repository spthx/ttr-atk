import type { GroupSynergy, TacticalSkill } from '../types';

export type UnlockExplanationKind = 'synergy' | 'skill';

export interface UnlockExplanation {
  key: string;
  kind: UnlockExplanationKind;
  kicker: string;
  title: string;
  dialogue: string;
  detail: string;
  operation: string;
}

const formatDuration = (durationMs: number) => {
  const seconds = durationMs / 1000;
  return Number.isInteger(seconds) ? `${seconds}秒` : `${seconds.toFixed(1)}秒`;
};

export const getSkillUnlockExplanation = (
  skill: TacticalSkill
): UnlockExplanation => {
  const usageLimit = skill.oncePerBattle
    ? '使用回数は1争奪戦につき1回。'
    : `リキャストタイムは${formatDuration(skill.cooldownMs)}。`;

  return {
    key: `skill:${skill.id}`,
    kind: 'skill',
    kicker: 'NEW ABILITY',
    title: `${skill.name} 修得`,
    dialogue: `${skill.name}を修得したでっす！ 商戦前に装備して、ここぞという場面で使うでっす。`,
    detail: `${skill.description} ${usageLimit}`,
    operation:
      '「アビリティ」画面でアビリティ装備を設定します。開幕アビリティ・瀕死アビリティに設定した技は、手動発動の一覧から外れます。控えの技は商戦中に使えません。',
  };
};

export const getSynergyUnlockExplanation = (
  synergy: GroupSynergy
): UnlockExplanation => {
  if (synergy.battleOnly && synergy.battleEffect) {
    const ownershipPush = synergy.battleEffect.ownershipPush
      ? `、発動時に所有率ゲージを${synergy.battleEffect.ownershipPush}%分押し込みます`
      : '';
    const limitBreakCharge = synergy.battleEffect.limitBreakChargeMultiplier
      ? `、LB蓄積が${synergy.battleEffect.limitBreakChargeMultiplier.toFixed(2)}倍`
      : '';
    const continuousPressure = synergy.battleEffect.continuousGaugePushPerSecond
      ? `、継続圧力+${synergy.battleEffect.continuousGaugePushPerSecond.toFixed(2)}/秒`
      : '';
    const marketWindCounter = synergy.battleEffect.countersMarketWind
      ? '、敵の相場風を解除して効果中の再発を防ぎます'
      : '';

    return {
      key: `synergy:${synergy.id}`,
      kind: 'synergy',
      kicker: 'NEW SYNERGY',
      title: `${synergy.name} 解放`,
      dialogue: `${synergy.name}が商戦シナジーとして使えるようになったでっす！ 新しいシナジーへ切り替えておいたでっす。`,
      detail: `${synergy.description} 発動すると${formatDuration(
        synergy.battleEffect.durationMs
      )}、資本圧力が${synergy.battleEffect.capitalPressureMultiplier.toFixed(
        2
      )}倍${ownershipPush}${limitBreakCharge}${continuousPressure}${marketWindCounter}。使用回数は1争奪戦につき1回。`,
      operation:
        '「アビリティ」画面のSYNERGY枠で選択し、商戦中に手動発動します。',
    };
  }

  const yieldIncrease = Math.round(
    (synergy.bonusYieldMultiplier - 1) * 100
  );
  return {
    key: `synergy:${synergy.id}`,
    kind: 'synergy',
    kicker: 'NEW SYNERGY',
    title: `${synergy.name} 成立`,
    dialogue: `${synergy.name}が成立したでっす！ 事業同士がつながり、普段の収益と商戦の支援が強くなるでっす。`,
    detail: `${synergy.description} 成立中は毎秒収益が${yieldIncrease}%上昇します。`,
    operation:
      '収益効果は自動。「アビリティ」画面のSYNERGY枠へ選ぶと、商戦中に手動で一斉出資できます。',
  };
};
