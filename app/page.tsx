export const metadata = {
  title: "タタルの大繁盛商店",
  description: "ロマンシング サ・ガ3のトレードゲームをFF14の世界観で再現した非公式ファンゲーム。",
};

const EMBEDDED_GAME_VERSION = "sfc-trade-fidelity-v1";

export default function Home() {
  return (
    <main className="game-shell">
      <iframe
        className="game-frame"
        src={`/game/index.html?v=${EMBEDDED_GAME_VERSION}`}
        title="金融ゲーム画面"
        allow="fullscreen"
      />
      <noscript>
        <a href={`/game/index.html?v=${EMBEDDED_GAME_VERSION}`}>ゲームを開く</a>
      </noscript>
    </main>
  );
}
