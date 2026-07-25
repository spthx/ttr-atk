import React from 'react';
import { TacticalSkill, GroupSynergy, Property } from '../types';
import { soundFx } from '../utils/audio';
import { Zap, Check, Lock, Shield, Sparkles, Layers, ArrowRight } from 'lucide-react';
import { HelpTip } from './HelpTip';
import { HELP_TEXT } from '../data/helpText';
import { isSkillUnlocked } from '../utils/gameBalance';

const skillScaleLabel = {
  low: '小',
  medium: '中',
  high: '大',
} as const;

const operationDifficultyLabel = {
  '危険度急上昇': '高',
  '中程度': '中',
  '低（耐えうる）': '低',
} as const;

interface SkillsSynergyViewProps {
  skills: TacticalSkill[];
  equippedSkillIds: string[];
  groupSynergies: GroupSynergy[];
  ownedProperties: Property[];
  totalFunds: number;
  activeSynergyCount: number;
  onToggleEquipSkill: (skillId: string) => void;
}

export const SkillsSynergyView: React.FC<SkillsSynergyViewProps> = ({
  skills,
  equippedSkillIds,
  groupSynergies,
  ownedProperties,
  onToggleEquipSkill,
  totalFunds,
  activeSynergyCount,
}) => {
  const ownedPropertyIds = new Set(ownedProperties.map((p) => p.id));

  const handleToggle = (skill: TacticalSkill) => {
    soundFx.playSkillSpark();
    onToggleEquipSkill(skill.id);
  };

  return (
    <div className="space-y-8">
      {/* 1. Tactical Skills (かけひき技) Section */}
      <div className="space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              かけひき技（戦術スキル）スロット管理
              <HelpTip term="かけひき技" description="買収交渉中に使える特殊コマンドです。修得済みの技を最大8個まで装備できます。" />
            </h2>
            <p className="mt-1 text-xs text-slate-400">物件や業界の条件を満たすと修得できます。使用後は再使用時間が必要です。</p>
          </div>

          <div className="bg-slate-950 px-4 py-2 rounded-lg border border-slate-800 text-xs font-bold text-amber-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>
              装備スロット: {equippedSkillIds.length} / 8
            </span>
          </div>
        </div>

        {/* Skills Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill) => {
            const unlocked = isSkillUnlocked({ skill, ownedProperties, totalFunds, activeSynergyCount });
            const isEquipped = equippedSkillIds.includes(skill.id);

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
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      技の規模: {skillScaleLabel[skill.costType]}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {skill.oncePerBattle ? '使用制限: 1交渉1回' : `再使用: ${(skill.cooldownMs / 1000).toFixed(1)}秒`}
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
                      <HelpTip term="修得条件" description="表示された物件・業界・総資産・SYNERGYの条件を満たすと装備できます。" />
                    </strong>
                    {skill.unlockRequirements}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  {unlocked ? (
                    <button
                      onClick={() => handleToggle(skill)}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        isEquipped
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 cursor-pointer'
                          : equippedSkillIds.length >= 8
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer'
                      }`}
                    >
                      {isEquipped ? (
                        <>
                          <Check className="w-4 h-4 text-amber-400" />
                          <span>スロット装備中 (解除)</span>
                        </>
                      ) : equippedSkillIds.length >= 8 ? (
                        <span>スロット満載 (8/8)</span>
                      ) : (
                        <span>スロットに装備</span>
                      )}
                    </button>
                  ) : isEquipped ? (
                    <button
                      type="button"
                      onClick={() => handleToggle(skill)}
                      className="w-full rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-xs font-bold text-rose-300"
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
            SYNERGY（自社内の事業連携）
            <HelpTip term="SYNERGY" description={HELP_TEXT.synergy} />
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            原料・加工・輸送・販売など、つながりのある必要物件をすべて所有すると毎秒収益倍率が自動で発動します。
            <span className="ml-1 inline-flex"><HelpTip term="バリューチェーン" description={HELP_TEXT.valueChain} /></span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupSynergies.map((synergy) => {
            const totalRequired = synergy.requiredPropertyIds.length;
            const ownedCount = synergy.requiredPropertyIds.filter((id) =>
              ownedPropertyIds.has(id)
            ).length;

            const isActive = ownedCount === totalRequired;

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
                          SYNERGY ACTIVE!
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
                      {ownedCount} / {totalRequired}
                    </span>
                  </div>
                </div>

                {/* Properties Checklist */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
                  <span className="text-[11px] text-slate-400 font-semibold block">
                    必要な物件:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {synergy.requiredPropertyIds.map((propId) => {
                      const prop = ownedProperties.find((p) => p.id === propId);
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
                          {prop ? prop.name : propId}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Synergy Benefits & Risk */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      SYNERGY規模（目安）
                      <HelpTip term="SYNERGY規模" description="効果の大きさを示す目安です。実際の収益効果は右の倍率で確認できます。" />
                    </span>
                    <strong className="text-amber-400 font-bold">{synergy.fundSupplyPower}</strong>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">毎秒収益倍率</span>
                    <strong className="text-emerald-400 font-bold">x{synergy.bonusYieldMultiplier}</strong>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      運用難度（目安）
                      <HelpTip term="運用難度" description="維持に必要な物件数や地域の広さを示す参考表示です。直接の追加ペナルティはありません。" align="right" />
                    </span>
                    <strong className="text-rose-400 font-bold">{operationDifficultyLabel[synergy.systemRisk]}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
