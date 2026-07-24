export const metadata = {
  title: "タタルの野望",
  description: "タタルの大繁盛商店を旗揚げし、FF14の主要都市を順番に制覇する金融ゲーム。",
};

export default function Home() {
  return (
    <main className="game-shell">
      <iframe
        className="game-frame"
        src="/game/index.html"
        title="金融ゲーム画面"
        allow="fullscreen"
      />
      <noscript>
        <a href="/game/index.html">ゲームを開く</a>
      </noscript>
    </main>
  );
}
