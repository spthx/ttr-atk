import React from 'react';
import {
  CheckCircle2,
  Crown,
  Lock,
  ShieldAlert,
  Sparkles,
  Swords,
} from 'lucide-react';
import type { BattleMode, Cartel, GroupSynergy, Property } from '../types';
import { FANKIT_ART } from '../data/fankitAssets';
import { formatCurrency } from '../utils/formatter';
import type { BattleReadinessResult } from '../utils/battleReadiness';
import { isCartelFullyPrepared } from '../utils/cartel';
import {
  calculateCruelEntryRequirement,
  calculateCruelSignatureRequirement,
} from '../utils/cruelBattle';
import { StrengthComparison } from './StrengthComparison';
import {
  SAVAGE_GROUP_MULTIPLIER_BASE,
  SAVAGE_GROUP_MULTIPLIER_BONUS_PER_RANK,
  SAVAGE_PROPERTY_YIELD_BONUS,
  SAVAGE_RAID_DEFINITIONS,
  SAVAGE_SERIES_DEFINITIONS,
  SAVAGE_YIELD_BONUS_PER_RANK,
  CRUEL_RAID_DEFINITION,
  ULTIMATE_RAID_DEFINITION,
  getDefaultOpenSavageSeries,
  type SavageSeries,
} from '../utils/savage';
import '../high-end-raids.css';

interface HighEndRaidViewProps {
  savageProperties: Property[];
  properties: Property[];
  cartels: Cartel[];
  savageClearedIds: ReadonlySet<string>;
  savageUnlockedIds: ReadonlySet<string>;
  groupSynergies: GroupSynergy[];
  totalFunds: number;
  ultimateProperty: Property;
  ultimateUnlocked: boolean;
  ultimateCleared: boolean;
  cruelProperty: Property;
  cruelUnlocked: boolean;
  cruelCleared: boolean;
  getStrengthComparison: (
    property: Property,
    mode: BattleMode
  ) => BattleReadinessResult;
  onStartSavage: (property: Property) => void;
  onStartUltimate: (property: Property) => void;
  onStartCruel: (property: Property) => void;
  onReplayEnding: () => void;
  onOpenCartels: () => void;
}

export const HighEndRaidView: React.FC<HighEndRaidViewProps> = ({
  savageProperties,
  properties,
  cartels,
  savageClearedIds,
  savageUnlockedIds,
  groupSynergies,
  totalFunds,
  ultimateProperty,
  ultimateUnlocked,
  ultimateCleared,
  cruelProperty,
  cruelUnlocked,
  cruelCleared,
  getStrengthComparison,
  onStartSavage,
  onStartUltimate,
  onStartCruel,
  onReplayEnding,
  onOpenCartels,
}) => {
  const propertyMap = new Map(
    savageProperties.map((property) => [property.id, property])
  );
  const synergyMap = new Map(
    groupSynergies.map((synergy) => [synergy.id, synergy])
  );
  const ultimateStrengthComparison = getStrengthComparison(
    ultimateProperty,
    'ultimate'
  );
  const cruelStrengthComparison = getStrengthComparison(
    cruelProperty,
    'cruel'
  );
  const cruelFee = Math.round(cruelProperty.marketPrice * 0.03);
  const cruelSignatureCapital = calculateCruelSignatureRequirement(
    cruelProperty.marketPrice
  );
  const cruelEntryRequirement = calculateCruelEntryRequirement(
    cruelProperty.marketPrice,
    cruelFee
  );
  const cruelAffordable = totalFunds >= cruelEntryRequirement;
  const ownedNormalPropertyIds = new Set(
    properties
      .filter((property) => property.owner === 'player')
      .map((property) => property.id)
  );
  const hasFullyPreparedCartel = cartels.some((cartel) =>
    isCartelFullyPrepared(cartel, ownedNormalPropertyIds)
  );
  const defaultOpenSeries = getDefaultOpenSavageSeries({
    clearedIds: [...savageClearedIds],
    unlockedIds: [...savageUnlockedIds],
  });
  const [openSeries, setOpenSeries] = React.useState<SavageSeries | null>(
    defaultOpenSeries
  );
  const previousDefaultOpenSeries = React.useRef(defaultOpenSeries);
  React.useEffect(() => {
    if (previousDefaultOpenSeries.current === defaultOpenSeries) return;
    previousDefaultOpenSeries.current = defaultOpenSeries;
    setOpenSeries(defaultOpenSeries);
  }, [defaultOpenSeries]);

  return (
    <div className="high-end-raids">
      <section className="high-end-raids__hero">
        <img
          src={FANKIT_ART.battleBackdrop}
          alt=""
          aria-hidden="true"
          decoding="async"
          className="high-end-raids__backdrop"
        />
        <div className="high-end-raids__party" aria-hidden="true">
          {FANKIT_ART.jobs.slice(0, 8).map((src) => (
            <img key={src} src={src} alt="" />
          ))}
        </div>
        <div className="high-end-raids__hero-copy">
          <small>HIGH-END TRADE DUTIES</small>
          <h2>商戦 零式</h2>
          <p>
            3編それぞれの第1～4層、全12章を順に攻略する本作独自の高難度交易戦です。
            失敗しても通常事業は失いません。
          </p>
          <strong>
            {savageClearedIds.size}/{SAVAGE_RAID_DEFINITIONS.length} CHAPTERS
            CLEARED
          </strong>
        </div>
      </section>

      <div className="savage-series-list" aria-label="商戦 零式 3編 全12章">
        {SAVAGE_SERIES_DEFINITIONS.map((series) => {
          const seriesRaids = SAVAGE_RAID_DEFINITIONS.filter(
            (raid) => raid.series === series.series
          );
          const seriesCleared = seriesRaids.filter((raid) =>
            savageClearedIds.has(raid.id)
          ).length;
          return (
          <details
            key={series.series}
            className="savage-series"
            aria-label={`第${series.series}編 ${series.name} 1層から4層`}
            open={series.series === openSeries}
            onToggle={(event) => {
              const isOpen = event.currentTarget.open;
              setOpenSeries((current) =>
                isOpen ? series.series : current === series.series ? null : current
              );
            }}
          >
            <summary className="savage-series__header">
              <span>第{series.series}編</span>
              <div>
                <h2>{series.name}</h2>
                <p>{series.subtitle}</p>
              </div>
              <strong>{seriesCleared}/4 踏破</strong>
            </summary>
            <div className="savage-layer-grid">
        {seriesRaids.map((raid) => {
          const raidIndex = SAVAGE_RAID_DEFINITIONS.findIndex(
            (candidate) => candidate.id === raid.id
          );
          const previousRaid =
            raidIndex > 0 ? SAVAGE_RAID_DEFINITIONS[raidIndex - 1] : null;
          const property = propertyMap.get(raid.id);
          if (!property) return null;
          const cleared = savageClearedIds.has(raid.id);
          const unlocked = savageUnlockedIds.has(raid.id);
          const fee = Math.round(property.marketPrice * 0.03);
          const affordable = totalFunds >= fee;
          const strengthComparison = getStrengthComparison(
            property,
            'savage'
          );
          const rewards = raid.rewardSynergyIds
            .map((id) => synergyMap.get(id))
            .filter((synergy): synergy is GroupSynergy => !!synergy);
          const needsCartelPreparation =
            raid.series === 1 && raid.layer === 4 && !hasFullyPreparedCartel;

          return (
            <article
              key={raid.id}
              className={`savage-layer-card ${
                cleared
                  ? 'savage-layer-card--cleared'
                  : unlocked
                    ? 'savage-layer-card--open'
                    : 'savage-layer-card--locked'
              }`}
            >
              <header>
                <span>
                  第{raid.layer}層
                  <small>CHAPTER {raidIndex + 1}/12</small>
                </span>
                <i className="savage-layer-card__boss-mark">
                  <Crown />
                  BOSS
                </i>
                <b>{cleared ? <CheckCircle2 /> : unlocked ? <Swords /> : <Lock />}</b>
              </header>
              <h3>{raid.encounterName}</h3>
              <p className="savage-layer-card__coalition">{raid.coalitionName}</p>
              <div className="savage-layer-card__regions">
                {raid.communities.map((community) => (
                  <span key={community}>{community}</span>
                ))}
              </div>
              <p className="savage-layer-card__description">{raid.description}</p>

              <dl>
                <div>
                  <dt>想定相場</dt>
                  <dd>{formatCurrency(property.marketPrice)}</dd>
                </div>
                <div>
                  <dt>参加手数料</dt>
                  <dd>{formatCurrency(fee)}</dd>
                </div>
              </dl>

              <StrengthComparison result={strengthComparison} compact />

              {needsCartelPreparation && (
                <aside className="savage-layer-card__preparation" role="note">
                  <b>第1編4層前の準備</b>
                  <p>
                    第1編4層は、企業連合の参加企業と本部を整えた戦力が目安です。ガーロンド等の外部支援だけでは足りません。
                  </p>
                  <button type="button" onClick={onOpenCartels}>
                    企業連合の準備へ
                  </button>
                </aside>
              )}

              <section className="savage-layer-card__reward">
                <span><Sparkles />初回踏破報酬：通常編の事業・連携強化</span>
                <p>
                  <b>連合地域の通常事業 {raid.memberPropertyIds.length}件</b>
                  <small>基礎収益 +{Math.round(SAVAGE_PROPERTY_YIELD_BONUS * 100)}%</small>
                </p>
                {rewards.length === 0 && (
                  <p>
                    <b>この層は地域事業を直接強化</b>
                    <small>新しい事業連携の追加や所有権の変更はありません</small>
                  </p>
                )}
                {rewards.map((synergy) => (
                  <p key={synergy.id}>
                    <b>{synergy.name}</b>
                    <small>
                      {synergy.battleOnly
                        ? cleared
                          ? `強化済み：資本圧力 +0.02（零式強化 ${synergy.savageRank ?? 0}/3）`
                          : '手動SYNERGYの資本圧力 +0.02'
                        : cleared
                        ? `強化済み：収益倍率 +${SAVAGE_YIELD_BONUS_PER_RANK.toFixed(2)}／戦闘支援 ×${synergy.battleGroupMultiplier?.toFixed(2)}`
                        : `収益倍率 +${SAVAGE_YIELD_BONUS_PER_RANK.toFixed(2)}／戦闘支援 ×${((synergy.battleGroupMultiplier ?? SAVAGE_GROUP_MULTIPLIER_BASE) + SAVAGE_GROUP_MULTIPLIER_BONUS_PER_RANK).toFixed(2)}へ`}
                    </small>
                  </p>
                ))}
              </section>

              <button
                type="button"
                disabled={!unlocked || !affordable}
                onClick={() => onStartSavage(property)}
                aria-label={
                  cleared
                    ? `第${raid.series}編・第${raid.layer}層 踏破済み。記録戦へ再挑戦`
                    : undefined
                }
              >
                {!unlocked ? (
                  previousRaid
                    ? `第${previousRaid.series}編・第${previousRaid.layer}層の踏破で解放`
                    : '前章の踏破で解放'
                ) : cleared ? (
                  <>
                    <CheckCircle2 />
                    {affordable
                      ? `第${raid.layer}層 踏破済み・再挑戦`
                      : `踏破済み・再挑戦まで あと${formatCurrency(fee - totalFunds)}`}
                  </>
                ) : !affordable ? (
                  `手数料まで あと${formatCurrency(fee - totalFunds)}`
                ) : (
                  `第${raid.layer}層へ挑戦`
                )}
              </button>
            </article>
          );
        })}
            </div>
          </details>
          );
        })}
      </div>

      {ultimateUnlocked && <section
        className={`ultimate-raid-card ${
          ultimateCleared
            ? 'ultimate-raid-card--cleared'
            : ultimateUnlocked
              ? 'ultimate-raid-card--open'
              : 'ultimate-raid-card--locked'
        }`}
      >
        <div className="ultimate-raid-card__art" aria-hidden="true">
          {FANKIT_ART.jobs.map((src) => <img key={src} src={src} alt="" />)}
        </div>
        <div className="ultimate-raid-card__copy">
          <small>
            <span className="ultimate-raid-card__boss-mark"><Crown /> BOSS</span>
            ULTIMATE TRADE DUTY / 本作独自
          </small>
          <h2>{ULTIMATE_RAID_DEFINITION.name}</h2>
          <p>
            3編・全12章踏破で解放される、別枠の単独最終戦です。
            全地域の交易共同戦線が、これまでの攻防を重ねて立ちはだかります。
          </p>
          <span>
            <ShieldAlert />
            想定相場 {formatCurrency(ultimateProperty.marketPrice)}・参加手数料{' '}
            {formatCurrency(Math.round(ultimateProperty.marketPrice * 0.03))}
          </span>
          <span>
            <ShieldAlert />
            AI LEVEL 6・地域／業界補正なし・通常事業と収益は保護
          </span>
          <StrengthComparison result={ultimateStrengthComparison} compact />
          <div className="ultimate-raid-card__actions">
            <button
              type="button"
              disabled={
                !ultimateUnlocked ||
                totalFunds < Math.round(ultimateProperty.marketPrice * 0.03)
              }
              onClick={() => onStartUltimate(ultimateProperty)}
            >
              <Crown />
              {totalFunds < Math.round(ultimateProperty.marketPrice * 0.03)
                  ? '参加手数料が不足'
                  : ultimateCleared
                    ? '絶へ再挑戦'
                    : '絶へ挑戦'}
            </button>
            {ultimateCleared && (
              <button type="button" onClick={onReplayEnding}>
                集合絵をもう一度見る
              </button>
            )}
          </div>
        </div>
      </section>}

      {cruelUnlocked && (
        <section
          className={`cruel-raid-card ${
            cruelCleared
              ? 'cruel-raid-card--cleared'
              : 'cruel-raid-card--open'
          }`}
        >
          <div className="cruel-raid-card__art" aria-hidden="true">
            <span />
            <img src={FANKIT_ART.tataru.windUp} alt="" />
          </div>
          <div className="cruel-raid-card__copy">
            <small>
              <span className="cruel-raid-card__boss-mark">
                <Crown /> BOSS
              </span>
              CRUEL TRADE DUTY / 絶商戦踏破後
            </small>
            <h2>{CRUEL_RAID_DEFINITION.name}</h2>
            <p>{CRUEL_RAID_DEFINITION.description}</p>
            <span>
              <ShieldAlert />
              想定相場 {formatCurrency(cruelProperty.marketPrice)}・参加手数料{' '}
              {formatCurrency(cruelFee)}
            </span>
            <span>
              <ShieldAlert />
              挑戦最低資金 {formatCurrency(cruelEntryRequirement)}（署名原資{' '}
              {formatCurrency(cruelSignatureCapital)}を含む）
            </span>
            <span>
              <ShieldAlert />
              AI LEVEL 6・強化かばう・通常事業と進行は保護
            </span>
            <div className="cruel-raid-card__warning" role="note">
              <b>二段階フェーズ「万象資本化」</b>
              <p>
                開始約15秒後に所有率10%へ（投入資本・資金・LBは維持）。復帰中は自社へ進む継続速度が50%になります。50%へ戻すと12秒の第二査定が始まり、所有率75%以上＋査定中の自社直接出資{formatCurrency(cruelSignatureCapital)}（相場10%）が必須。人脈・LB・SYNERGY・外部アライアンスは署名対象外です。
              </p>
            </div>
            <StrengthComparison result={cruelStrengthComparison} compact />
            <div className="cruel-raid-card__actions">
              <button
                type="button"
                disabled={!cruelAffordable}
                onClick={() => onStartCruel(cruelProperty)}
              >
                <Crown />
                {!cruelAffordable
                  ? '手数料＋署名原資が不足'
                  : cruelCleared
                    ? '酷へ再挑戦'
                    : '酷へ挑戦'}
              </button>
              {cruelCleared && (
                <span className="cruel-raid-card__record">
                  <CheckCircle2 /> 称号・踏破記録 獲得済み
                </span>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
