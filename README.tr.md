# Gesture Cube

[![CI](https://github.com/numanbekir/gesture-cube/actions/workflows/ci.yml/badge.svg)](https://github.com/numanbekir/gesture-cube/actions/workflows/ci.yml)

[English](README.md) · Türkçe

2×2 Rubik küpünü tarayıcıda yalnızca el hareketleriyle çözmek için bir uygulama. Küp,
webcam görüntüsünün üzerine artırılmış gerçeklik olarak çizilir; eller gerçek zamanlı
takip edilir ve optimal bir çözücü bir sonraki hamleyi doğrudan küpün üzerinde gösterir.

Her şey (el takibi, 3D çizim, çözücü) **tarayıcının içinde** çalışır. Görüntü cihazdan
hiç çıkmaz, çıkarım sunucusu yoktur.

## Nasıl oynanır

| Hareket | Etkisi |
|---|---|
| İki el yumruk, sağ el hareket eder | Küpün tamamını döndürür |
| Sağ el: 1–4 parmak | Karşıdaki yüzde bir kare seçer (sol üst / sağ üst / sol alt / sağ alt) |
| Sol el: 1–4 parmak | Seçili katmanı sağa / sola / yukarı / aşağı çevirir |
| İPUCU anahtarı | Bir sonraki optimal hamleyi küpün üzerinde gösterir: bakılacak yüzde bir çerçeve, seçilecek karede bir halka, yön için bir ok (çift başlı ok = yarım tur) |

Oyun bir özetle biter (hamle sayısı, süre, optimal hamle sayısı) ve *Yeniden Başlat*
düğmesi çıkar. Arayüz Türkçe ve İngilizce (`?lang=tr|en`, belirtilmezse tarayıcı dili).

## Mimari

```
camera ──▶ MediaPipe HandLandmarker (WASM + WebGL/CPU delegate)
              │ 21 landmarks × 2 hands, every frame
              ▼
        gesture-detector  ──▶  gesture-mapping  ──▶  MoveExecutor ──▶ cube-engine (state)
        fist / pinch /         screen-space face       queue + layer        8 corner cubies,
        finger count           grid, swipe → move      animations           integer rotation matrices
                                                            │
                                                            ▼
                                                   solver (IDA*) ──▶ hint overlay (three.js)
```

- **`src/cube-engine`**: saf küp modeli. 8 köşe parçası, her biri tam sayılı 3×3 bir
  dönme matrisi. Hamleler matris çarpımıdır; çözüldü kontrolü küpün yönünden bağımsızdır.
- **`src/solver`**: permütasyon uzaklığına dayalı budama tablosuyla (7! = 5 040 girdi)
  IDA*. Tablo yükleme anında BFS ile kurulur. 2×2 için Tanrı sayısı 11 olduğundan rastgele
  karıştırmalar milisaniyeler içinde çözülür. Çözücü normalize edilmiş bir çerçevede
  (referans köşe sabit) çalışır, çıktısı gösterilmeden önce fiziksel küpe geri çevrilir.
- **`src/hand-tracking`**: MediaPipe sarmalayıcısı ve temel hareketler (çimdik, histerezisli
  kavrama, belirsizlik bandı olan bilinçli parmak sayımı).
- **`src/gesture-mapping`**: geometri. Ekranda hangi dünya ekseninin "yatay" olduğu,
  kameranın küpün hangi yüzünü gördüğü, bir hücre üzerindeki kaydırmanın hangi hamleye
  karşılık geldiği ve ipuçları için bunun tersi.
- **`src/render`**: three.js sahnesi, küp parçaları, katman pivotları, hizalama, seçim ve
  ipucu katmanları.
- **`src/ui`**: HUD, hareket rehberi, ipucu yardımı, oyun sonu paneli. Düz DOM, framework
  yok; tüm metinler `src/strings.ts` dosyasından gelir.
- **`src/app.ts`**: her şeyi birbirine bağlar; barındıran sayfa yalnızca bir `<video>` ve
  metinleri sağlar.

### Çıkarım nerede çalışıyor?

Tamamen ziyaretçinin cihazında. MediaPipe önce **GPU delegate**'i (WebGL) dener; WebGL
yoksa daha yavaş ama çalışan **CPU delegate**'e (WASM) geçer. Sunucu yalnızca statik
dosyaları gönderir (≈7,8 MB el takip modeli + WASM çalışma ortamı). Bu yüzden barındırma
maliyeti trafikten bağımsızdır ve kamera verisi hiçbir yere gönderilmez.

## Ölçümler

Kare başına el takibi çıkarım süresi (`detectForVideo`, iki el görünür, yavaş küp
döndürme, 30 sn'lik pencere). fps, gerçekleşen takip hızıdır; kamera ve ekran yenileme
hızıyla sınırlıdır.

| Cihaz | Tarayıcı | Kamera | Delegate | p50 | p95 | fps |
|---|---|---|---|---|---|---|
| NVIDIA RTX 3060 Laptop ¹ | Chrome 136 | 1280×720 | GPU (WebGL) | 16.1 ms | 17.3 ms | 57 |
| Intel UHD Graphics (TGL GT1, iGPU) | Chrome 136 | 1280×720 | GPU (WebGL) | 20.1 ms | 22.8 ms | 51 |
| Intel Core i7-11800H | Chrome 136 | 1280×720 | CPU (WASM) | 59.3 ms | 62.3 ms | 21 |
| iPhone 12 Pro (A14) | Safari | 1080×1920 | GPU (WebGL) | 33 ms | 42 ms | 25 |
| iPhone 12 Pro (A14) | Safari | 1080×1920 | CPU (WASM) | 96 ms | 98 ms | 10 |

¹ Linux, NVIDIA'nın kendi sürücüsü, Chrome ANGLE Vulkan arka ucuyla. Dizüstü satırları aynı
makinede, dahili webcam'le (en fazla 720p) ölçüldü. Uygulama 1080p ister, kamera ne
sunuyorsa ona düşer.

Çıkarımlar: model küçük olduğu için tümleşik GPU, harici GPU'nun %25 yakınında kalıyor.
CPU yolu yaklaşık 3 kat yavaş ama oyunu oynanabilir tutuyor. Telefonlarda GPU çizimle
paylaşıldığı için p50 ile p95 arasındaki fark daha büyük.

Ölçümler yerleşik göstergeyle tekrarlanabilir (aşağıya bakın).

## Yerelde çalıştırma

Gereksinimler: Node 20+, pnpm.

```bash
pnpm install
pnpm dev            # http://localhost:5173
pnpm test           # vitest
pnpm typecheck
pnpm lint
pnpm build          # static output in dist/
```

`pnpm install`, MediaPipe WASM çalışma ortamını `node_modules` içinden `public/mediapipe/`
klasörüne de kopyalar (git'e girmez). Böylece sunulan dosyalar her zaman kurulu
`@mediapipe/tasks-vision` sürümüyle eşleşir.

### Yayına alma

`pnpm build` tamamen statik bir `dist/` üretir; herhangi bir statik barındırıcıdan
(Nginx, Vercel, GitHub Pages, S3) sunulabilir. Sunucu tarafı bileşen olmadığı için
container gerekmez.

### Ölçüm göstergesi ve delegate seçimi

| | URL parametresi | Ortam değişkeni (`.env`, bkz. `.env.example`) |
|---|---|---|
| Delegate'i zorla | `?delegate=cpu` / `?delegate=gpu` | `VITE_HAND_DELEGATE=CPU` |
| Performans göstergesi | `?stats=1` (`?stats=0` dev'de gizler) | `VITE_PERF_STATS=1` |

Gösterge (sol alt) etkin delegate'i, son 30 sn'deki p50/p95 çıkarım süresini, fps'i ve
örnek sayısını gösterir. `pnpm dev` içinde her zaman açıktır.

### Telefonda test

`localhost` dışında kamera erişimi HTTPS gerektirir.

```bash
mkcert -install
mkdir -p certs
mkcert -cert-file certs/dev-cert.pem -key-file certs/dev-key.pem localhost <your-lan-ip>
pnpm dev:https      # https://<your-lan-ip>:5173
```

Adres telefonda (aynı Wi-Fi ağında) açılır ve sertifika uyarısı kabul edilir. `certs/`
git'e girmez.

### Geliştirici kısayolları

Yalnızca `pnpm dev` içinde: `U D L R F B` bir hamle uygular (Shift = ters), `0` küpü
sıfırlar. Üretim derlemesinde kapalıdır; ürün el hareketleriyle kullanılır.

## Başka bir sayfaya gömme

Paket girişi (`src/index.ts`), bağımsız sayfanın kullandığı motorun aynısını dışa açar.
Kamerayı barındıran sayfa yönetir ve hazır bir `<video>` verir:

```ts
import { initGestureCube, STRINGS_BY_LOCALE } from "gesture-cube";

const instance = initGestureCube(container, {
  video,                                   // a playing HTMLVideoElement
  mirrored: facingMode === "user",
  strings: STRINGS_BY_LOCALE.en,
  assetPaths: { wasmBasePath: "/gesture-cube/wasm", modelPath: "/gesture-cube/hand_landmarker.task" },
  watermark: false,                        // the host draws its own
  videoBackground: false,                  // the host already shows the <video> under the canvas
  autoLoad: true,                          // load the model right away; the player clicks once
  onEvent: (type) => track(type),          // "play_start" | "successful_detection" | "completion"
  onStatus: (s) => panel.update(s),        // live session snapshot (phase, hands, delegate, ms, moves)
});
instance.setSpaciousLayout(isFullscreen);  // toggles the gesture guide
instance.drawOverlay(ctx, dx, dy, dw, dh); // 3D layer for photo/video capture
instance.destroy();
```

`gesture-cube/strings` yalnızca arayüz metinlerini ve dil yardımcılarını dışa açar
(MediaPipe ya da three.js içe aktarmaz). Sözlüklerini sunucuda kuran sayfalar için.

Barındıran sayfa, MediaPipe WASM çalışma ortamını (`@mediapipe/tasks-vision/wasm`) ve
`public/models/hand_landmarker.task` dosyasını `assetPaths` içinde verilen yollarda sunar.
Giriş TypeScript kaynağıdır; paketi kullanan bundler'ların onu derlemesi gerekir.

## Bilinen sınırlar

- **Telefonlarda yalnızca dikey.** Yatay telefonda yaklaşık 300 px yükseklik kalıyor, küp
  ve HUD için yeterli değil; "Telefonu dikey çevir" ekranı gösterilir. Tabletler iki yönde de
  yeterince yüksek.
- Hareket tanıma makul bir ışık ve iki elin de kadrajda olmasını gerektirir. Parmak sayımı
  katı bir eşik kullanır ve belirsiz el pozlarını bilinçli olarak yok sayar.
- İpucu, mevcut durumdan optimal bir sonraki hamleyi gösterir; bir çözüm yöntemi "öğretmez".

## Model ve lisanslar

- El takibi: [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
  (`hand_landmarker.task`, Apache 2.0) ve `@mediapipe/tasks-vision`.
- Çizim: [three.js](https://threejs.org) (MIT).
- Bu projenin kendi kodu: bkz. [LICENSE](LICENSE).
