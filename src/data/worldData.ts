import { CommunityType } from '../types';

export interface TradeCommunity {
  id: CommunityType;
  region: string;
  marketCharacter: string;
}

export const GAME_WORLD = {
  title: 'タタルの大繁盛商店',
  companyName: 'タタルの大繁盛商店',
  playerRole: '交易実務担当',
  advisorName: 'タタル',
  advisorRole: '会計係・助言役',
  premise:
    'プレイヤーは自分のカンパニーの交易実務担当として、市場調査・買収・資金管理を行う。タタルは重要な会計係として報告を受け、資金面の方針と助言を示す。',
} as const;

export const COMMUNITY_CAMPAIGN_ORDER: CommunityType[] = [
  'グリダニア',
  'リムサ・ロミンサ',
  'ウルダハ',
  'イシュガルド',
  'クガネ',
  'クリスタリウム',
  'オールド・シャーレアン',
  'ラザハン',
  'トライヨラ',
  'ソリューション・ナイン',
];

export const TRADE_COMMUNITIES: TradeCommunity[] = [
  { id: 'グリダニア', region: '黒衣森', marketCharacter: '林業・農園' },
  { id: 'リムサ・ロミンサ', region: 'バイルブランド', marketCharacter: '海運・造船' },
  { id: 'ウルダハ', region: 'ザナラーン', marketCharacter: '金融・商業' },
  { id: 'イシュガルド', region: 'クルザス', marketCharacter: '武具・建設' },
  { id: 'クガネ', region: 'ひんがしの国', marketCharacter: '海運・情報' },
  { id: 'クリスタリウム', region: 'ノルヴラント', marketCharacter: '宿泊・復興需要' },
  { id: 'オールド・シャーレアン', region: '北洋', marketCharacter: '学術・技術' },
  { id: 'ラザハン', region: 'サベネア島', marketCharacter: '錬金・交易' },
  { id: 'トライヨラ', region: 'トラル大陸', marketCharacter: '食文化・工芸・国際交易' },
  { id: 'ソリューション・ナイン', region: 'ヘリテージファウンド（エバーキープ）', marketCharacter: '先端技術・電力・娯楽' },
];

export const getCommunityDefinition = (community: CommunityType) =>
  TRADE_COMMUNITIES.find((entry) => entry.id === community);
