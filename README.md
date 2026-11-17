# daisukesudo.github.io

https://daisukesudo.github.io/

Daisuke Sudo の個人サイトです。
Qiita に書いた Web 3D・物理シミュレーション・WebAR の入門記事と、そのサンプルを Works としてまとめています。

## Works

各サンプルは、記事で解説しているソースコードを、そのまま動く形で公開したものです。
記事の Step を順に追えるページに加えて、同じライブラリで作った全画面のデモを用意しています。

| | 記事 | Demo | Steps |
|---|---|---|---|
| Cannon.js | [Cannon.js の世界へようこそ！](https://qiita.com/dsudo/items/66f41ef514344afeec4e) | [Dusk Drive](https://daisukesudo.github.io/samples/cannonjs/demo/) | [samples/cannonjs](./site/samples/cannonjs/) |
| AR.js | [AR.js の世界へようこそ！](https://qiita.com/dsudo/items/58718e9e3c870e6b92e6) | [Holo Foxes](https://daisukesudo.github.io/samples/arjs/demo/) | [samples/arjs](./site/samples/arjs/) |
| Three.js | [Three.js の世界へようこそ！](https://qiita.com/dsudo/items/42da9c7f45ed6147395e) | [Neon Cube](https://daisukesudo.github.io/samples/threejs/demo/) | [samples/threejs](./site/samples/threejs/) |

### Demo

- **Dusk Drive**（Cannon.js）— 夕暮れの砂丘を車で走り回り、積まれた箱を崩して遊ぶデモ。空からボールや箱が降り、衝突すると火花が散ります。キーボードのほか、スマホではタッチボタンで操作できます。
- **Holo Foxes**（AR.js）— マーカーの上にホログラムのステージと 4 匹のキツネが現れる WebAR デモ。ボタンで「立ち止まる → 歩く → 走る」を切り替えられます。カメラを使わない 3D プレビューモードもあり、PC でもそのまま見られます。
- **Neon Cube**（Three.js）— 夕焼けの水面に浮かぶ、ネオンに光るキューブ。水面への映り込みとブルームで仕上げています。ドラッグで視点を回し、クリックで水面に波紋が広がります。

## 構成

- `site/` — 公開するファイル一式。`main` に push すると GitHub Actions で GitHub Pages にデプロイされます。
  - `samples/{cannonjs,arjs,threejs}/` — 記事のサンプル（`step*/`）とデモ（`demo/`）
- ビルドは不要です。ライブラリは CDN から読み込んでいます。

## ローカルで見る

[mise](https://mise.jdx.dev/) で `just` と `miniserve` を入れて、ローカルサーバーを起動します。

```sh
mise install
just dev
```

http://127.0.0.1:8080/ で表示されます。
