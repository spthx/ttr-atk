import React from 'react';
import {
  TacticalSkill,
  GroupSynergy,
  Property,
  CommunityType,
} from '../types';
import { soundFx } from '../utils/audio';
import { Zap, Check, Lock, Layers, Swords } from 'lucide-react';
import { HelpTip } from './HelpTip';
import { HELP_TEXT } from '../data/helpText';
import {
  BATTLE_SUPPORT_BALANCE,
  isSkillUnlocked,
} from '../utils/gameBalance';
import { INITIAL_PROPERTIES } from '../data/initialData';
import {
  GRAND_COMPANY_EORZEA_ID,
  getLatestProgressionBattleSynergy,
  isGroupSynergyUnlocked,
} from '../utils/synergy';
import {
  MANUAL_ABILITY_SLOT_COUNT,
  TOTAL_ABILITY_LOADOUT_SLOTS,
  type AbilityActivationMode,
} from '../utils/abilityLoadout';

const SKILL_PROGRESSION_ORDER = [
  'skill_fast_horse',
  'skill_synergy_push',
  'skill_demoralize',
  'skill_capital_boost',
  'skill_sns_blitz',
  'skill_sabotage',
] as const;
const SKILL_PROGRESSION_RANK = new Map<string, number>(
  SKILL_PROGRESSION_ORDER.map((skillId, index) => [skillId, index])
);

const formatSavageUnlockLabel = (raidId: string) => {
  const match = /^savage_raid_(\d+)_layer_(\d+)$/.exec(raidId);
  return match
    ? `零式 第${match[1]}編 ${match[2]}層クリア`
    : `零式「${raidId}」クリア`;
};

interface SkillsSynergyViewProps {
  skills: TacticalSkill[];
  equippedSkillIds: string[];
  groupSynergies: GroupSynergy[];
  conqueredCommunityIds: ReadonlySet<CommunityType>;
  ownedProperties: Property[];
  totalFunds: number;
  activeSynergyCount: number;
  openingAutoUnlocked: boolean;
  criticalAutoUnlocked: boolean;
  openingAutoSkillId: string | null;
  criticalAutoSkillId: string | null;
  reserveSkillId: string | null;
  savageClearedRaidIds: ReadonlySet<string>;
  selectedBattleSynergyId: string | null;
  onToggleEquipSkill: (skillId: string) => void;
  onSetSkillActivationMode: (
    skillId: string,
    mode: AbilityActivationMode
  ) => void;
  onSelectBattleSynergy: (synergyId: string) => void;
}

export const SkillsSynergyView: React.FC<SkillsSynergyViewProps> = ({
  skills,
  equippedSkillIds,
  groupSynergies,
  conqueredCommunityIds,
  ownedProperties,
  onToggleEquipSkill,
  totalFunds,
  activeSynergyCount,
  openingAutoUnlocked,
  criticalAutoUnlocked,
  openingAutoSkillId,
  criticalAutoSkillId,
  reserveSkillId,
  savageClearedRaidIds,
  selectedBattleSynergyId,
  onSetSkillActivationMode,
  onSelectBattleSynergy,
}) => {
  const ownedPropertyIds = new Set(ownedProperties.map((p) => p.id));
  const propertyNames = new Map(
    INITIAL_PROPERTIES.map((property) => [property.id, property.name])
  );
  const latestProgressionSynergy = getLatestProgressionBattleSynergy(
    groupSynergies.filter(
      (synergy) =>
        synergy.battleOnly &&
        isGroupSynergyUnlocked({
          synergy,
          ownedPropertyIds,
          conqueredCommunityIds,
          savageClearedRaidIds,
        })
    )
  );
  const selectedBattleSynergy =
    groupSynergies.find(
      (synergy) =>
        synergy.id === selectedBattleSynergyId &&
        (
          !synergy.battleOnly ||
          synergy.id === latestProgressionSynergy?.id
        ) &&
        isGroupSynergyUnlocked({
          synergy,
          ownedPropertyIds,
          conqueredCommunityIds,
          savageClearedRaidIds,
        })
    ) ??
    latestProgressionSynergy ??
    null;
  const resolvedSelectedBattleSynergyId =
    selectedBattleSynergy?.id ?? null;
  const orderedSkills = [...skills].sort(
      (left, right) =>
        (SKILL_PROGRESSION_RANK.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (SKILL_PROGRESSION_RANK.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    );
  const equippedSkills = orderedSkills.filter((skill) =>
    equippedSkillIds.includes(skill.id)
  );
  const manualSkillIds = equippedSkillIds.filter(
    (skillId) =>
      skillId !== openingAutoSkillId &&
      skillId !== criticalAutoSkillId &&
      skillId !== reserveSkillId
  );
  const manualSlotsFull =
    manualSkillIds.length >= MANUAL_ABILITY_SLOT_COUNT;
  const canEquipAnother =
    equippedSkillIds.length < TOTAL_ABILITY_LOADOUT_SLOTS &&
    (!manualSlotsFull || !reserveSkillId);

  const handleToggle = (skill: TacticalSkill) => {
    const isEquipped = equippedSkillIds.includes(skill.id);
    if (
      !isEquipped &&
      equippedSkillIds.length >= TOTAL_ABILITY_LOADOUT_SLOTS
    ) {
      return;
    }
    soundFx.playSkillSpark();
    onToggleEquipSkill(skill.id);
  };

  const handleActivationMode = (
    skill: TacticalSkill,
    mode: AbilityActivationMode
  ) => {
    if (!equippedSkillIds.includes(skill.id)) return;
    soundFx.playGaugeTick(mode === 'manual' ? 0.94 : 1.04);
    onSetSkillActivationMode(skill.id, mode);
  };

  const handleRoleSlotChange = (
    mode: Extract<
      AbilityActivationMode,
      'opening_auto' | 'critical_auto' | 'reserve'
    >,
    currentSkillId: string | null,
    nextSkillId: string
  ) => {
    soundFx.playGaugeTick(nextSkillId ? 1.04 : 0.94);
    if (!nextSkillId) {
      if (currentSkillId) {
        onSetSkillActivationMode(currentSkillId, 'manual');
      }
      return;
    }
    onSetSkillActivationMode(nextSkillId, mode);
  };

  return (
    <div className="space-y-8">
      {/* 1. Tactical Skills (かけひき技) Section */}
      <div className="space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              アビリティ装備
              <HelpTip term="アビリティ" description="手動3枠、開幕1枠、瀕死1枠、控え1枠へ装備します。開幕と瀕死は条件を満たした時に自動発動し、控えは商戦中に使用できません。" />
            </h2>
            <p className="mt-1 text-xs text-slate-400">事業・契約や業界の条件を満たすと修得できます。手動枠のアビリティは使用後にリキャストタイムが必要です。</p>
            <p className="mt-1 text-xs text-amber-200/80">
              開幕・瀕死・控えへ設定した技は、商戦中の手動一覧から外れます。控えは次の商戦に備える待機枠です。
            </p>
            <p className="mt-1 text-xs text-cyan-300/80">主な名称はFFXIVのアクションをモチーフにし、交易戦での効果は本作独自にアレンジしています。</p>
          </div>

          <div className="grid min-w-[12rem] grid-cols-2 gap-2 text-[11px] font-black">
            <span className="rounded-lg border border-amber-500/30 bg-slate-950 px-3 py-2 text-amber-300">
              手動 {manualSkillIds.length} / {MANUAL_ABILITY_SLOT_COUNT}
            </span>
            <span className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-300">
              全体 {equippedSkillIds.length} / {TOTAL_ABILITY_LOADOUT_SLOTS}
            </span>
          </div>
        </div>

        <section
          className="grid gap-3 rounded-xl border border-slate-700 bg-slate-950/80 p-4 md:grid-cols-3"
          aria-label="開幕・瀕死・控えアビリティ設定"
        >
          {openingAutoUnlocked ? (
            <label className="grid gap-2 rounded-lg border border-cyan-500/35 bg-cyan-950/25 p-3">
              <span>
                <b className="block text-sm text-cyan-100">開幕アビリティ</b>
                <small className="text-[11px] leading-relaxed text-cyan-200/70">
                  開始演出後に一度だけ自動発動。設定した技は手動一覧から外れます。
                </small>
              </span>
              <select
                value={openingAutoSkillId ?? ''}
                onChange={(event) =>
                  handleRoleSlotChange(
                    'opening_auto',
                    openingAutoSkillId,
                    event.target.value
                  )
                }
                className="min-h-11 w-full rounded-lg border border-cyan-400/45 bg-slate-900 px-3 text-sm font-bold text-cyan-50"
                aria-label="開幕アビリティへ設定するアビリティ"
              >
                <option value="" disabled={!!openingAutoSkillId && manualSlotsFull}>
                  {openingAutoSkillId && manualSlotsFull
                    ? '手動枠に空きを作って解除'
                    : '設定なし（手動へ戻す）'}
                </option>
                {equippedSkills.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="grid content-center gap-1 rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-slate-500">
              <b className="text-sm text-slate-300">開幕アビリティ</b>
              <small className="text-[11px] leading-relaxed">零式の解放後に使用できます。</small>
            </div>
          )}

          {criticalAutoUnlocked ? (
            <label className="grid gap-2 rounded-lg border border-rose-500/35 bg-rose-950/25 p-3">
              <span>
                <b className="block text-sm text-rose-100">瀕死アビリティ</b>
                <small className="text-[11px] leading-relaxed text-rose-200/70">
                  所有率25%以下へ入る時に一度だけ割り込み。設定した技は手動一覧から外れます。
                </small>
              </span>
              <select
                value={criticalAutoSkillId ?? ''}
                onChange={(event) =>
                  handleRoleSlotChange(
                    'critical_auto',
                    criticalAutoSkillId,
                    event.target.value
                  )
                }
                className="min-h-11 w-full rounded-lg border border-rose-400/45 bg-slate-900 px-3 text-sm font-bold text-rose-50"
                aria-label="瀕死アビリティへ設定するアビリティ"
              >
                <option value="" disabled={!!criticalAutoSkillId && manualSlotsFull}>
                  {criticalAutoSkillId && manualSlotsFull
                    ? '手動枠に空きを作って解除'
                    : '設定なし（手動へ戻す）'}
                </option>
                {equippedSkills.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="grid content-center gap-1 rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-slate-500">
              <b className="text-sm text-slate-300">瀕死アビリティ</b>
              <small className="text-[11px] leading-relaxed">最初の零式4層を制覇すると使用できます。</small>
            </div>
          )}

          <label className="grid gap-2 rounded-lg border border-violet-500/35 bg-violet-950/25 p-3">
            <span>
              <b className="block text-sm text-violet-100">控えアビリティ</b>
              <small className="text-[11px] leading-relaxed text-violet-200/70">
                装備を保持する待機枠です。この枠の技は商戦中に使用できません。
              </small>
            </span>
            <select
              value={reserveSkillId ?? ''}
              onChange={(event) =>
                handleRoleSlotChange(
                  'reserve',
                  reserveSkillId,
                  event.target.value
                )
              }
              className="min-h-11 w-full rounded-lg border border-violet-400/45 bg-slate-900 px-3 text-sm font-bold text-violet-50"
              aria-label="控えへ設定するアビリティ"
            >
              <option value="" disabled={!!reserveSkillId && manualSlotsFull}>
                {reserveSkillId && manualSlotsFull
                  ? '手動枠に空きを作って解除'
                  : '設定なし（手動へ戻す）'}
              </option>
              {equippedSkills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        {/* Skills Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orderedSkills.map((skill) => {
            const unlocked = isSkillUnlocked({ skill, ownedProperties, totalFunds, activeSynergyCount });
            const isEquipped = equippedSkillIds.includes(skill.id);
            const activationMode: AbilityActivationMode =
              openingAutoSkillId === skill.id
                ? 'opening_auto'
                : criticalAutoSkillId === skill.id
                  ? 'critical_auto'
                  : reserveSkillId === skill.id
                    ? 'reserve'
                    : 'manual';
            const activationModeLabel =
              activationMode === 'opening_auto'
                ? '開幕アビリティ'
                : activationMode === 'critical_auto'
                  ? '瀕死アビリティ'
                  : activationMode === 'reserve'
                    ? '控え（戦闘外）'
                    : '手動';

            return (
              <div
                key={skill.id}
                className={`bg-slate-900 border rounded-xl p-4 flex flex-col justify-between transition-all ${
                  !unlocked
                    ? 'border-slate-800/60 opacity-60 bg-slate-950/40'
                    : isEquipped
                    ? 'border-amber-500/50 bg-amber-950/10 shadow-md shadow-amber-500/5'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-end gap-2 mb-2">
                    {isEquipped && (
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-black ${
                        activationMode === 'manual'
                          ? 'border-slate-600 bg-slate-800 text-slate-300'
                          : activationMode === 'opening_auto'
                            ? 'border-cyan-400/50 bg-cyan-950/60 text-cyan-200'
                            : activationMode === 'critical_auto'
                              ? 'border-rose-400/50 bg-rose-950/60 text-rose-200'
                              : 'border-violet-400/50 bg-violet-950/60 text-violet-200'
                      }`}>
                        {activationModeLabel}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {skill.oncePerBattle ? '使用制限: 1争奪戦につき1回' : `リキャストタイム: ${(skill.cooldownMs / 1000).toFixed(1)}秒`}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    {unlocked ? (
                      <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    {skill.name}
                  </h3>

                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    {skill.description}
                  </p>

                  <div className="mt-3 p-2 rounded bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400">
                    <strong className="flex items-center gap-1 text-slate-300 font-medium">
                      修得条件
                      <HelpTip term="修得条件" description="表示された事業・契約、業界、総資産、事業連携の条件を満たすと装備できます。" />
                    </strong>
                    {skill.unlockRequirements}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  {unlocked && isEquipped ? (
                    <div className="space-y-2">
                      {activationMode !== 'manual' && (
                        <div
                          className={`rounded-lg border px-3 py-2 text-[11px] font-bold ${
                            activationMode === 'opening_auto'
                              ? 'border-cyan-400/35 bg-cyan-950/35 text-cyan-100'
                              : activationMode === 'critical_auto'
                                ? 'border-rose-400/35 bg-rose-950/35 text-rose-100'
                                : 'border-violet-400/35 bg-violet-950/35 text-violet-100'
                          }`}
                        >
                          {activationMode === 'reserve'
                            ? '控えへ設定中。このアビリティは商戦中に使用できません。'
                            : `${activationModeLabel}へ設定中。商戦中の手動一覧には表示されません。`}
                          <button
                            type="button"
                            onClick={() =>
                              handleActivationMode(skill, 'manual')
                            }
                            disabled={manualSlotsFull}
                            className={`mt-2 min-h-11 w-full rounded-lg border px-3 py-2 text-xs font-black ${
                              manualSlotsFull
                                ? 'cursor-not-allowed border-slate-800 bg-slate-950 text-slate-600'
                                : 'border-slate-600 bg-slate-900 text-slate-200'
                            }`}
                          >
                            {manualSlotsFull
                              ? '手動枠が満杯（3/3）'
                              : '手動へ戻す'}
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleToggle(skill)}
                        className="min-h-11 w-full rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500/30"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <Check className="h-4 w-4 text-amber-400" />
                          装備中（外す）
                        </span>
                      </button>
                    </div>
                  ) : unlocked ? (
                    <button
                      onClick={() => handleToggle(skill)}
                      disabled={!canEquipAnother}
                      className={`min-h-11 w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        !canEquipAnother
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer'
                      }`}
                    >
                      {!canEquipAnother ? (
                        <span>
                          {equippedSkillIds.length >= TOTAL_ABILITY_LOADOUT_SLOTS
                            ? `装備枠が満杯（${TOTAL_ABILITY_LOADOUT_SLOTS}/${TOTAL_ABILITY_LOADOUT_SLOTS}）`
                            : '先に手動技を開幕・瀕死へ移動'}
                        </span>
                      ) : (
                        <span>装備する</span>
                      )}
                    </button>
                  ) : isEquipped ? (
                    <button
                      type="button"
                      onClick={() => handleToggle(skill)}
                      className="min-h-11 w-full rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-xs font-bold text-rose-300"
                    >
                      条件未達で休止中（装備解除）
                    </button>
                  ) : (
                    <div className="w-full py-2 px-3 rounded-lg bg-slate-950 border border-slate-800/80 text-slate-500 text-xs text-center font-medium flex items-center justify-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      未修得 (条件未達成)
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Industry Group Synergies (産業グループシナジー) Section */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            事業連携（SYNERGY）
            <HelpTip term="SYNERGY" description={HELP_TEXT.synergy} />
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            原料・加工・輸送・販売など、つながりのある事業・契約をすべて保有すると毎秒収益倍率が自動で発動します。
            都市進行で修得する戦闘専用SYNERGYは毎秒収益へ掛かりません。
            <span className="ml-1 inline-flex"><HelpTip term="バリューチェーン" description={HELP_TEXT.valueChain} /></span>
          </p>
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-indigo-400/30 bg-indigo-950/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className="flex items-center gap-2 text-xs font-black text-indigo-200">
                <Swords className="h-4 w-4 text-indigo-300" />
                バトル用SYNERGY　{selectedBattleSynergy ? 1 : 0} / 1
              </span>
              <strong className="mt-1 block text-base text-white">
                {selectedBattleSynergy?.name ?? '未装備'}
              </strong>
            </div>
            <p className="max-w-xl text-xs leading-relaxed text-indigo-200/80">
              バトルで押せる事業連携は1つだけです。より上位の連携を修得すると自動で置き換わり、成立・修得済みカードからいつでも選び直せます。毎秒収益は戦闘専用を除く成立中の全連携が有効です。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupSynergies.map((synergy) => {
            const totalRequired = synergy.requiredPropertyIds.length;
            const ownedCount = synergy.requiredPropertyIds.filter((id) =>
              ownedPropertyIds.has(id)
            ).length;

            const isActive = isGroupSynergyUnlocked({
              synergy,
              ownedPropertyIds,
              conqueredCommunityIds,
              savageClearedRaidIds,
            });
            const isSupersededProgression =
              synergy.battleOnly === true &&
              isActive &&
              !!latestProgressionSynergy &&
              latestProgressionSynergy.id !== synergy.id;

            return (
              <div
                key={synergy.id}
                className={`bg-slate-900 border rounded-xl p-5 space-y-4 shadow-md transition-all ${
                  isActive
                    ? 'border-indigo-500/50 bg-indigo-950/10 shadow-indigo-500/5'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <span>{synergy.name}</span>
                      {isActive && (
                        <span className="text-[10px] bg-indigo-600 text-white font-black px-2 py-0.5 rounded animate-pulse">
                          {isSupersededProgression
                            ? '更新済み'
                            : synergy.battleOnly
                              ? '修得'
                              : '成立'}
                        </span>
                      )}
                      {!!synergy.savageRank && synergy.savageRank > 0 && (
                        <span className="rounded bg-rose-950 px-2 py-0.5 text-[10px] font-black text-rose-200">
                          零式強化 +{synergy.savageRank}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">{synergy.description}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-400 block">達成率</span>
                    <span
                      className={`text-base font-black ${
                        isActive ? 'text-indigo-400' : 'text-slate-400'
                      }`}
                    >
                      {synergy.battleOnly
                        ? isActive
                          ? '修得'
                          : '未修得'
                        : `${ownedCount} / ${totalRequired}`}
                    </span>
                  </div>
                </div>

                {/* Properties Checklist */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
                  <span className="text-[11px] text-slate-400 font-semibold block">
                    {synergy.battleOnly ? '修得条件:' : '必要な事業・契約:'}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {synergy.battleOnly && synergy.unlockAfterCommunity && (
                      <span
                        className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1 font-medium ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-900 text-slate-500 border-slate-800'
                        }`}
                      >
                        {isActive ? <Check className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {synergy.unlockAfterCommunity}人脈開通
                      </span>
                    )}
                    {synergy.battleOnly && synergy.unlockAfterSavageRaidId && (
                      <span
                        className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1 font-medium ${
                          savageClearedRaidIds.has(synergy.unlockAfterSavageRaidId)
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-900 text-slate-500 border-slate-800'
                        }`}
                      >
                        {savageClearedRaidIds.has(synergy.unlockAfterSavageRaidId) ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Lock className="w-3 h-3" />
                        )}
                        {formatSavageUnlockLabel(synergy.unlockAfterSavageRaidId)}
                      </span>
                    )}
                    {synergy.requiredPropertyIds.map((propId) => {
                      const isOwned = ownedPropertyIds.has(propId);

                      return (
                        <span
                          key={propId}
                          className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1 font-medium ${
                            isOwned
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-900 text-slate-500 border-slate-800'
                          }`}
                        >
                          {isOwned ? <Check className="w-3 h-3 text-emerald-400" /> : <Lock className="w-3 h-3" />}
                          {propertyNames.get(propId) ?? propId}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-xs text-slate-400 block">毎秒収益</span>
                    <strong className="text-emerald-400 font-bold">
                      {synergy.battleOnly
                        ? '戦闘専用'
                        : `×${synergy.bonusYieldMultiplier.toFixed(2)}`}
                    </strong>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-xs text-slate-400 block">
                      {synergy.battleOnly ? '手動バフ' : '戦闘連携の調達倍率'}
                    </span>
                    <strong className="text-amber-300 font-bold">
                      {synergy.battleOnly && synergy.battleEffect
                        ? `所有率ゲージ+${(synergy.battleEffect.ownershipPush ?? 0).toFixed(1)}%分・資本圧力×${synergy.battleEffect.capitalPressureMultiplier.toFixed(2)}${synergy.battleEffect.limitBreakChargeMultiplier ? `・LB蓄積×${synergy.battleEffect.limitBreakChargeMultiplier.toFixed(2)}` : ''}${synergy.battleEffect.continuousGaugePushPerSecond ? `・継続圧力+${synergy.battleEffect.continuousGaugePushPerSecond.toFixed(2)}/秒` : ''}${synergy.battleEffect.countersMarketWind ? '・敵の相場風を解除' : ''}・${Math.round(synergy.battleEffect.durationMs / 1000)}秒`
                        : `×${(
                            synergy.battleGroupMultiplier ??
                            BATTLE_SUPPORT_BALANCE.synergyDefaultMultiplier
                          ).toFixed(2)}`}
                    </strong>
                  </div>
                </div>

                {synergy.id === GRAND_COMPANY_EORZEA_ID && (
                  <p className="rounded-lg border border-amber-400/20 bg-amber-950/20 px-3 py-2 text-[11px] leading-relaxed text-amber-100/80">
                    全26事業の統合で資本圧力+0.07。各零式編の第4層クリアごとにさらに+0.02され、上の倍率表示へ反映されます。
                  </p>
                )}

                {isActive && !isSupersededProgression && (
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playSkillSpark();
                      onSelectBattleSynergy(synergy.id);
                    }}
                    className={`min-h-11 w-full rounded-lg border px-3 py-2 text-xs font-black ${
                      resolvedSelectedBattleSynergyId === synergy.id
                        ? 'border-indigo-300/50 bg-indigo-500/25 text-indigo-100'
                        : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-indigo-400/50 hover:bg-indigo-950/40'
                    }`}
                  >
                    {resolvedSelectedBattleSynergyId === synergy.id
                      ? '戦闘連携に装備中'
                      : '戦闘連携へ装備'}
                  </button>
                )}
                {isSupersededProgression && (
                  <div className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center text-xs font-black text-slate-500">
                    {latestProgressionSynergy?.name}へ更新済み
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
