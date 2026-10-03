import capitalCoinSpriteUrl from './assets/battle/capital-coin-sfc.png';
import capitalPedestalSpriteUrl from './assets/battle/capital-pedestal-sfc.png';
import casinoWideUrl from './assets/battle/battlefield-casino-wide.webp';
import casinoPortraitUrl from './assets/battle/battlefield-casino-mobile.webp';
import {
  createBattleCapitalCanvasScene,
  paintBattleCapitalCanvas,
  paintBattleCapitalGpuCanvas,
  disposeBattleCapitalGpuCanvas,
  type BattleCapitalCanvasSprites,
} from './components/BattleCapitalCanvas';
import {
  MAX_BATTLE_CAPITAL_VISIBLE_UNITS,
  getCapitalColumnHeights,
} from './utils/battlePresentation';

const root = document.querySelector<HTMLElement>('#audit-root');
if (!root) throw new Error('Capital contact audit root is missing.');

const query = new URLSearchParams(window.location.search);
const clampUnits = (value: number, fallback: number) => Math.max(
  0,
  Math.min(
    MAX_BATTLE_CAPITAL_VISIBLE_UNITS,
    Math.round(Number.isFinite(value) ? value : fallback)
  )
);
const requestedUnits = Number(
  query.get('units') ?? '1'
);
const burstLayers = Math.max(0, Math.min(32, Math.round(Number(query.get('burst') ?? '0'))));
const visibleUnits = clampUnits(requestedUnits, 1);
const landingComparison = query.has('before') && query.has('after');
const playerVisibleUnits = landingComparison
  ? clampUnits(Number(query.get('before')), visibleUnits)
  : visibleUnits;
const playerTargetUnits = landingComparison
  ? clampUnits(Number(query.get('after')), playerVisibleUnits)
  : playerVisibleUnits;
const mirror = query.get('mirror') === '1';
const requestedEnemyUnits = Number(query.get('enemyUnits') ?? '0');
const enemyVisibleUnits = landingComparison
  ? playerTargetUnits
  : mirror
    ? visibleUnits
    : clampUnits(requestedEnemyUnits, 0);
const requestedDpr = Number(query.get('dpr') ?? window.devicePixelRatio);
const auditDpr = Number.isFinite(requestedDpr) && requestedDpr > 0
  ? requestedDpr
  : window.devicePixelRatio;
const frameRate = query.get('fps') === '60' ? 60 : 30;
const useGpu = query.get('renderer') === 'gpu';
const settledBurst = query.get('settled') === '1';
const auditWidth = Math.max(0,Math.min(1190,Math.round(Number(query.get('width') ?? '0'))));
const auditHeight = Math.max(0,Math.min(600,Math.round(Number(query.get('height') ?? '0'))));

document.documentElement.style.colorScheme = 'dark';
document.body.style.margin = '0';
document.body.style.background = '#070b12';
document.body.style.color = '#f4e7bf';
document.body.style.fontFamily = 'system-ui, sans-serif';
root.innerHTML = `
  <section style="box-sizing:border-box;min-height:100vh;padding:16px;display:grid;place-items:center">
    <div style="width:min(960px,100%)">
      <p style="margin:0 0 4px;color:#e6bd55;font-size:12px;letter-spacing:.12em">DEVELOPMENT-ONLY VISUAL FIXTURE</p>
      <h1 style="margin:0 0 6px;font-size:clamp(18px,4vw,28px)">コイン接地監査：${landingComparison ? `自社${playerVisibleUnits}＋落下${playerTargetUnits - playerVisibleUnits}／競合${enemyVisibleUnits}着地後` : `自社${visibleUnits}／競合${enemyVisibleUnits}`} logical unit</h1>
      <p style="margin:0 0 12px;color:#b8c0cc;font-size:13px">前中央から積み、台の前壁が根元を隠すこと。背景がコイン下へ抜けたら不合格。</p>
      <p style="margin:0 0 12px;color:#8fa0b8;font-size:12px">要求DPR ${auditDpr}／${frameRate}fps。1 logical unitも最低8枚に見える短い束として描画。</p>
      <canvas id="capital-contact-canvas" style="display:block;width:${auditWidth?`${auditWidth}px`:'100%'};height:${auditHeight?`${auditHeight}px`:'clamp(240px,52vw,420px)'};max-width:100%;border:1px solid #5c4b2c"></canvas>
      <nav aria-label="監査状態" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">
        ${[
          ['1', '1束（最低8枚表示）'],
          ['18', '全列1層'],
          ['72', '序盤'],
          ['324', '中盤'],
          [String(MAX_BATTLE_CAPITAL_VISIBLE_UNITS), '最大'],
        ].map(([units, label]) => `<a href="?units=${units}" style="color:#ffe28a">${label}</a>`).join('')}
        <a href="?units=${visibleUnits}&mirror=1&dpr=${auditDpr}&fps=${frameRate}" style="color:#9ee7ff">左右鏡像</a>
        <a href="?before=72&after=270&progress=1&dpr=${auditDpr}&fps=${frameRate}" style="color:#ffd59e">巨額着地一致</a>
        ${[1, 1.25, 1.5, 2].map((dpr) => `<a href="?units=${visibleUnits}&mirror=${mirror ? 1 : 0}&dpr=${dpr}&fps=${dpr > 1.5 ? 60 : 30}" style="color:#b9f6ca">DPR ${dpr}</a>`).join('')}
      </nav>
    </div>
  </section>
`;

const canvas = document.querySelector<HTMLCanvasElement>(
  '#capital-contact-canvas'
);
if (!canvas) throw new Error('Capital contact audit canvas is missing.');

const loadImage = (url: string) => new Promise<HTMLImageElement>(
  (resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', reject, { once: true });
    image.src = url;
  }
);

const sprites: BattleCapitalCanvasSprites = {
  coin: await loadImage(capitalCoinSpriteUrl),
  pedestal: await loadImage(capitalPedestalSpriteUrl),
  backgrounds: {
    wide: await loadImage(casinoWideUrl),
    portrait: await loadImage(casinoPortraitUrl),
  },
};

const columnHeights = getCapitalColumnHeights(playerVisibleUnits);
const settledAfterColumnHeights = getCapitalColumnHeights(playerTargetUnits);
if (burstLayers > 0) settledAfterColumnHeights[15] = columnHeights[15] + burstLayers;
const activeColumnIndices = columnHeights.flatMap((height, index) =>
  settledAfterColumnHeights[index] > height ? [index] : []
);
const scene = createBattleCapitalCanvasScene({
  player: {
    amount: playerTargetUnits,
    marketPrice: 2_000,
    previewFrame: {
      visibleUnits: playerVisibleUnits,
      columnHeights: settledBurst ? settledAfterColumnHeights : columnHeights,
      settledAfterColumnHeights,
      activeColumnIndices: !settledBurst && (landingComparison || burstLayers > 0) ? activeColumnIndices : [],
      ...(burstLayers > 0 ? {
        incomingLaneTimings: [{columnIndex:15,startMs:0,durationMs:330}],
        beatDurationMs:330,
      } : {}),
    },
  },
  enemy: {
    amount: enemyVisibleUnits,
    marketPrice: 2_000,
    previewFrame: {
      visibleUnits: enemyVisibleUnits,
      columnHeights: getCapitalColumnHeights(enemyVisibleUnits),
      activeColumnIndices: [],
    },
  },
  ownershipPercent: 50,
});
if (landingComparison || burstLayers > 0) {
  scene.player.frame.packetProgress = Math.max(
    0,
    Math.min(1, Number(query.get('progress') ?? '1'))
  );
}

const repaint = () => {
  const bounds = canvas.getBoundingClientRect();
  (useGpu ? paintBattleCapitalGpuCanvas : paintBattleCapitalCanvas)(canvas, scene, {
    cssSize: {
      width: Math.max(1, Math.round(bounds.width)),
      height: Math.max(1, Math.round(bounds.height)),
    },
    devicePixelRatio: auditDpr,
    frameRate,
    sprites,
  });
};

const observer = new ResizeObserver(repaint);
observer.observe(canvas);
repaint();

// Development-only entry point: deterministic evidence uses the real renderer,
// never a second approximation of its drawing code.
Object.assign(window, {
  capitalAudit: { canvas, scene, sprites, paintBattleCapitalCanvas, paintBattleCapitalGpuCanvas, disposeBattleCapitalGpuCanvas, createBattleCapitalCanvasScene, getCapitalColumnHeights },
});
