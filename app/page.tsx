export const metadata = {
  title: "タタル商会 世界交易帳",
  description: "タタル商会の交易実務担当として、FF14の主要都市と企業連合を制覇する金融ゲーム。",
};

export default function Home() {
  return (
    <main className="game-shell">
      <iframe
        className="game-frame"
        src="/game/index.html"
        title="タタル商会 世界交易帳"
        allow="fullscreen"
      />
      <noscript>
        <a href="/game/index.html">ゲームを開く</a>
      </noscript>
    </main>
  );
}
