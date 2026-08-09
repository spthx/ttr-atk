# コイン描画 WebGL2 フォールバック実装手引き

## 1. 目的

現行のReact／DOM/CSS版をゲーム本体の正本として維持しながら、コイン積載演出が端末上で性能ゲートを満たさない場合に限り、**コイン描画層だけ**をWebGL2へ切り替えられるようにする。

WebGL2化はゲームルール、投入額、所有率、AI、演出時間、音声予約、画面遷移を変更する理由にしてはならない。変更するのは、`CapitalStackTimeline`を画面へ投影するrendererだけである。

この手引きはUnity WebGLへのゲーム全体移植ではない。ゲーム全体の将来移植は[`unity-webgl-migration-spec.md`](./unity-webgl-migration-spec.md)を参照する。

## 2. 採用判断の原則

DOM/CSS、Canvas2D、WebGL2を、次の条件を完全にそろえて測るまで採用方式を断定しない。

- 同一scene
- 同一`CapitalStackEvent`
- 同一seed
- 同一coin count／列高／packet順
- 同一viewport、DPR、fps設定
- 同一ブラウザとハードウェア
- 同一録画・計測手順

探索開始レンジ、推定値、ソースコード上の時間は実測値として報告しない。測定不能な項目は`TBD`のまま残す。

WebGL2を採用する最低条件は次の三つを同時に満たすことである。

1. DOM/CSS版が対象実機のperformance gateを外れる。
2. WebGL2版が同一条件で定量的に改善する。
3. human blind A/Bでコインの物量感、山の成長、人物・金額・ゲージの可読性がCurrent以上になる。

Canvas2Dが同じ条件をより小さい複雑性で満たす場合は、WebGL2を優先しない。

## 3. 変えてはいけない正本

### 3.1 simulationとledger

次の値はReact側のゲーム状態だけが更新する。

- 自社・敵の投入済み資本
- 残資金
- 所有率と勝敗
- 敵AI判断
- コマンドリキャスト
- 継続効果、風、LB、SYNERGY
- 報酬、保存、進行

rendererはこれらを変更せず、コールバックで再計算も要求しない。勝敗が先に成立しても、既存どおり積載queue完走後に決着へ進む。

### 3.2 renderer-neutral timeline

正本は`src/utils/battlePresentation.ts`の次の型と純粋関数である。

- `CapitalStackEvent`
- `CapitalStackTimeline`
- `CapitalStackTimelineFrame`
- `buildCapitalStackTimeline(event)`

rendererは`activeColumnIndices`、`columnHeights`、`rackCompressed`、`packetSeed`、`atMs`、`durationMs`をそのまま消費する。内側→外側→内側のホース状の走査順や段丘状の山をrenderer側で乱数生成し直してはならない。

30fps／60fpsはtimelineを読む回数だけを変え、scene、seed、coin count、packet数、開始・着地時刻、最終山を変えない。

## 4. renderer interface

最初にDOM実装を次の境界の背後へ移す。Canvas2DとWebGL2は同じinterfaceを実装する。

```ts
export type CoinRendererKind = 'dom' | 'canvas2d' | 'webgl2';

export interface CoinSceneViewport {
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
}

export interface CoinSceneFrame {
  side: 'player' | 'enemy';
  timeline: CapitalStackTimeline;
  frame: CapitalStackTimelineFrame;
  elapsedMs: number;
}

export interface CoinSceneStats {
  renderer: CoinRendererKind;
  renderedFrames: number;
  lateFrames: number;
  contextLosses: number;
}

export interface CoinSceneRenderer {
  readonly kind: CoinRendererKind;
  mount(host: HTMLElement, viewport: CoinSceneViewport): void;
  resize(viewport: CoinSceneViewport): void;
  render(scene: CoinSceneFrame): void;
  clear(side?: 'player' | 'enemy'): void;
  getStats(): CoinSceneStats;
  destroy(): void;
}
```

推奨配置:

```text
src/coin-rendering/
  types.ts
  timelineSampler.ts
  domCoinRenderer.ts
  canvas2dCoinRenderer.ts
  webgl2CoinRenderer.ts
  rendererSelector.ts
  CoinSceneHost.tsx
scripts/coin-renderer-benchmark/
```

`BattleModal.tsx`はrenderer種別を意識せず、確定済みtimelineと経過時間だけを`CoinSceneHost`へ渡す。

## 5. 三方式の実装契約

### 5.1 DOM/CSS

- 現行22列を維持する。
- 金額比例DOMを作らない。
- 一時packetも固定上限を維持する。
- 現行版の見た目と操作を比較基準にする。

### 5.2 Canvas2D

- 1陣営につき1枚、または両陣営共通1枚のcanvasを使う。
- 毎frameの配列・Path2D・gradient生成を避ける。
- DPRを反映して内部解像度を設定し、CSS寸法はDOM版と一致させる。
- 固定台帳、テロップ、人物、ゲージ、操作UIはDOMのまま残す。

### 5.3 WebGL2

- 2D直交投影だけを使い、3Dカメラ、ライト、物理演算を入れない。
- コインは固定上限のinstance bufferへ事前確保する。投入額に応じてbufferやオブジェクトを増やさない。
- 上限の出発点は、両陣営の固定22列×36層と、既存の固定上限packetを同時表示できる数とする。
- 1枚のtexture atlasと少数のdraw callを基本とする。
- alphaはpremultipliedの有無をtexture、shader、blend設定で統一する。
- `packetSeed`は位置、奥行き、微小な明暗差の決定論的参照にだけ使う。
- canvasは`pointer-events: none`とし、タップ判定を奪わない。
- canvasのstacking contextは人物、固定金額、ゲージ、テロップ、操作UIより下に置く。
- タタルと敵キャラクターはDOM側に残す。コイン投入中も人物が必ず前面になる。

参考動画から抽出した画像・音源・shader素材は使わない。分析対象はtiming、envelope、density、spectral characteristicsだけとし、製品用素材は既存の正式アセットまたはオリジナル制作物を使う。

## 6. WebGL2の描画手順

1. `mount`時にWebGL2 context、program、VAO、固定instance buffer、texture atlasを一度だけ生成する。
2. `ResizeObserver`でCSS寸法を受け、viewportとprojection matrixだけを更新する。
3. timelineの絶対経過時間から現在frameを選ぶ。
4. `columnHeights`を固定instance領域へ反映する。
5. `activeColumnIndices`の4～5列へ縞付きの厚いpacketを配置する。
6. `rackCompressed`を陣営ごとの基準Y座標へ反映する。積載中に足元を元位置へ戻さない。
7. packet着地と同じframeで山の列高を確定する。
8. 最終frameを保持し、Reactから完了通知を受けるまで独自に消去しない。

描画側の補間は位置・不透明度・光だけに使う。`presentedCapital`、列高、packet順、phase境界を補間で飛び越えてはならない。

## 7. 切替ポリシー

### 7.1 初期導入

検証期間はURLパラメータだけで明示的に選択する。

```text
?coin-renderer=dom
?coin-renderer=canvas2d
?coin-renderer=webgl2
```

未指定時はDOM/CSSを使う。この段階では端末判定だけでWebGL2を自動採用しない。

### 7.2 自動切替

実測がそろった後、`auto`を追加する。切替判断は次の順序で行う。

1. WebGL2 context生成可否を確認する。
2. 保存済みの同一browser major／viewport帯／DPR帯の計測結果を読む。
3. 結果がなければ、通常UIを妨げない短い固定sceneで校正する。
4. DOM/CSSがperformance gateを外れ、WebGL2が合格した端末だけWebGL2を選ぶ。
5. renderer種別をその商戦中は固定する。

**積載途中、シネマティック途中、決着待ちでrendererを切り替えてはならない。** 切替予約は次の商戦開始時、またはコインsceneが完全にidleになった時だけ適用する。

初期performance gateの候補値は次の通り。これは探索開始レンジであり、実測値ではない。

|指標|30fps設定の探索開始レンジ|60fps設定の探索開始レンジ|
|---|---:|---:|
|frame interval p95|40ms以下|20ms以下|
|50ms超frame比率|5%未満|2%未満|
|入力から視覚反応まで|100ms以下|100ms以下|
|音とpacket着地のずれ|50ms以下|50ms以下|
|1戦後の未解放renderer資源|0|0|

WebGL2採用には、DOM/CSSに対してp95 frame intervalまたはlate frame率が25%以上改善することを探索開始条件とする。最終閾値は実機データから決める。

### 7.3 context loss

- `webglcontextlost`では`preventDefault()`し、同じ戦闘中のsimulationを止めない。
- その時点の確定済み列高と`presentedCapital`を保持する。
- 可能ならcontext restore後に同じtimelineの現在時刻へ復帰する。
- 復元できない場合は、次のpacket境界またはscene idleでDOMへ戻す。
- ledgerの再投入、音の再発火、勝敗の再判定を行わない。
- 同一セッションでcontext lossが再発した場合はWebGL2を無効化し、次回起動までDOMを使う。

## 8. benchmark計画

### 8.1 固定preset

最低限、次を両陣営で測る。

|preset|目的|
|---|---|
|`opening-small`|開幕0→初期資本と先出し防止|
|`direct-35`|0→相場35%の通常全力投入|
|`support-75`|外部アライアンス相場75%固定|
|`saturated-16`|表示上限後の小さな追加投入|
|`cruel-opening`|酷の大量開幕と長い積載queue|
|`dual-overlap`|敵味方の連続sceneと資源解放|

同時に複数要因を変えない。1実験で主要因を1～2個までに限定する。

### 8.2 保存項目

全実験でCSVまたはJSONへ次を保存する。

```text
commitHash
preset
seed
renderer
browser
browserVersion
viewport
DPR
hardware
fpsSetting
frameCount
frameIntervalP50
frameIntervalP95
frameIntervalP99
lateFrameCount
longTaskCount
inputLatencyMs
audioVisualDriftMs
contextLossCount
domNodeCount
gpuOrCanvasResourceCount
metricFile
videoFile
measuredAt
```

hardwareを取得できないブラウザでは推測せず`TBD`とする。`performance.memory`など非標準APIが使えない場合も`TBD`とする。

### 8.3 比較方法

- Reference、Current、候補を同じviewportと同じ切り出し領域で録画する。
- 色マスクを変更する場合はReferenceとCurrentの両方を同じ方法で再測定する。
- 敵の銅色コインだけを既存の金色HSV maskで測り、低いoccupancyを演出不良と断定しない。
- source timeline上の時間を動画の実測値として扱わない。
- blind A/Bではrenderer名、commit、対応表、音量差を隠す。

## 9. 段階実装

1. 現行DOM/CSSを`CoinSceneRenderer`へ包み、見た目を変えずに回帰検査を通す。
2. `timelineSampler`を純粋関数化し、30/60fpsで同じ最終sceneになるgolden testを作る。
3. benchmark harnessと固定preset、CSV/JSON出力を先に作る。
4. Canvas2D rendererを最小実装し、同一sceneの画像差分を取る。
5. WebGL2 rendererを固定buffer・固定atlasで実装する。
6. 三方式を同じ実機群で測る。
7. blind A/Bとperformance gateを同時に通った方式だけ候補にする。
8. URL指定で限定公開し、402×874・30fpsの通しテストを行う。
9. context loss、タブ復帰、画面回転、戦闘中断、再挑戦を検査する。
10. 実測で必要と確認できた場合だけ`auto`切替を有効にする。

## 10. 必須回帰検査

- 同一event／seedから三rendererが同じ列高、packet順、最終額を描く。
- renderer変更でsimulation関数が一度も追加実行されない。
- 0→35%、0→75%、酷開幕が必ず可視packetを持つ。
- 飽和後の正の追加投入も最低1回の可視packetと音を持つ。
- 開幕ブリーフィングで完成済み敵山を先出ししない。
- コインscene中の正の金額floaterを表示しない。
- タタルはコイン積載時間に引きずられず早く元位置へ戻る。
- 人物、固定金額、所有率、ゲージ、操作をコインが隠さない。
- 柱の足元は大量積載後に勝手に元位置へ戻らない。
- DOM node数、Canvas object数、WebGL buffer容量が投入額で増えない。
- cancel、勝敗、撤退、再挑戦、component unmountで資源を一度だけ解放する。
- 30/60fpsで絵を減らさず、sample回数だけが変わる。
- reduced motionでも最終sceneとledgerが一致する。
- console error/warn 0、WebGL error 0、context loss後の二重投入0。

## 11. 完了条件

次の三条件が同時に成立するまで、DOM/CSSを製品既定のまま維持する。

1. Referenceとの差が定量的に縮小する。
2. human blind A/BでCurrentより改善する。
3. 対象実機でperformance gateを満たす。

WebGL2は目的ではなく、**同じコイン積み勝負を、重い端末でも欠落なく見せるための交換可能な描画手段**である。演出を軽くするためにコイン、音、山の高さ、積載queueを減らすのではなく、rendererの責務と固定資源の使い方を改善する。
