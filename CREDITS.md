# Credits

Third-party assets used on the site. Compressed copies live in `public/`; sources stay in the git-ignored `media-inbox/`.

## 3D models

| Asset | Author / source | Licence | Used as |
| --- | --- | --- | --- |
| Train | TurboSquid | Web use permitted by the TurboSquid licence | The night train (`public/models/train.glb`) |
| Steel bridge | Supplied by Heet (owner) | Owner-supplied, used with permission | The steel bridges along the route (`public/models/bridge.glb`) |
| [Subway_[interior]](https://sketchfab.com/3d-models/subway-interior-b7f25426ac674a9291ba092fb9fe8406) | Comicaroid (Sketchfab) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | The cabin at every stop (`public/models/cabin.glb`), also credited on the Terminus display |

## Fonts

All under the [SIL Open Font License 1.1](https://openfontlicense.org).

| Font | Author | How it ships | Used for |
| --- | --- | --- | --- |
| UnifrakturMaguntia | j. "mach" wust | Latin subset in `src/app/fonts/`, self-hosted by `next/font/local` | The blackletter nameplate |
| Merriweather | Sorkin Type | Self-hosted by `next/font` at build time | Headlines and decks |
| Newsreader | Production Type | Self-hosted by `next/font` at build time | Body copy, datelines, buttons |
| Geist (Regular) | The Geist Project Authors (Vercel) | `public/fonts/Geist-Regular.ttf`, with its licence in [`public/fonts/OFL.txt`](public/fonts/OFL.txt) | Station sign lettering in the 3D scene |

## Illustrations

The newspaper illustrations (`public/illustrations/`) are made by Heet (owner).

## Sound

All sound is synthesized in the browser; no third-party audio. The lo-fi music, rain, train rumble, rail clacks,
station chime and UI taps are generated live with the Web Audio API (`src/sound/`); there are no audio files.
