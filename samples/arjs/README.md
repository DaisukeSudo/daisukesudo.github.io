# AR.js の世界へようこそ！ サンプル

Qiita 記事「[AR.js の世界へようこそ！ ３歩でわかる お手軽 拡張現実](https://qiita.com/dsudo/items/58718e9e3c870e6b92e6)」のサンプルです。

- [Step0: A-Frame](./step0/)
- [Step1: マーカーベース AR](./step1/)（[マーカー](./step1/marker/)）
- [Step2: ロケーションベース AR](./step2/)
- [Step3: インタラクション](./step3/)（[テキスト表示版](./step3/with-text/)）

## 3D モデルについて

記事の公開当初に使っていた 3D モデルは、権利上の理由で以下のモデルに差し替えました。
あわせて、モデルのファイル名・アセット ID・画面に表示するラベルも変更したため、記事中のコードとは一部異なります。

| 記事のコード | 現在 |
|---|---|
| `eevee.gltf` / `#asset-eevee` / `Eevee` | `fox.gltf` / `#asset-fox` / `Fox` |
| `jolteon.gltf` / `#asset-jolteon` / `Jolteon` | `fox-yellow.gltf` / `#asset-fox-yellow` / `Yellow Fox` |
| `vaporeon.gltf` / `#asset-vaporeon` / `Vaporeon` | `fox-blue.gltf` / `#asset-fox-blue` / `Blue Fox` |
| `flareon.gltf` / `#asset-flareon` / `Flareon` | `fox-red.gltf` / `#asset-fox-red` / `Red Fox` |

- **Fox**（[KhronosGroup/glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox)）
  - Model: PixelMannen — [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
  - Rigging & Animation: tomkranis — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
  - glTF conversion: @AsoboStudio and @scurest — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
  - 変更点：サイズの調整、テクスチャの色相変更（step3 の 3 体）、バイナリとテクスチャの glTF への埋め込み
