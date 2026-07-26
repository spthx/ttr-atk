export const metadata = {
  title: "タタルの大繁盛店",
  description: "タタルの大繁盛商店を旗揚げし、FF14の主要都市を順番に制覇する金融ゲーム。",
};

const EMBEDDED_GAME_VERSION = "capital-layer-v2";

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
