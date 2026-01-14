# SimpleTune - Guitar Tuner Roadmap

## Project Overview
A minimalistic, browser-based guitar tuner using the Web Audio API.

## Completed Steps

### Phase 1: Initial Setup ✅
- [x] Created project structure (HTML, CSS, JS)
- [x] Implemented dark mode UI with warm amber accent colors
- [x] Built responsive layout for mobile/desktop

### Phase 2: Core Functionality ✅
- [x] Microphone access via getUserMedia
- [x] Real-time pitch detection using autocorrelation algorithm
- [x] Note detection from frequency (chromatic)
- [x] Cents deviation calculation
- [x] Segmented bar meter for sharp/flat indication (Korg-style)
- [x] Standard guitar tuning string indicators (E A D G B E)

### Phase 3: UI Improvements ✅
- [x] Replaced slider with segmented bar meter visualization
- [x] Added green center segment for in-tune indication
- [x] Red segments with gradient opacity for flat/sharp indication
- [x] Yellow triangular indicators at extreme positions

## Decisions Made

1. **Tech Stack**: Plain HTML/CSS/JavaScript (no frameworks)
2. **Tuning Mode**: Standard guitar tuning only (E2 A2 D3 G3 B3 E4)
3. **Visual Feedback**: Segmented bar meter (Korg-style) with 25 segments showing sharp/flat deviation
4. **Features**: Listen-only pitch detection (no reference tone playback)
5. **Theme**: Dark mode with warm amber (#d4a853) accent color
6. **Pitch Detection**: Autocorrelation algorithm (good for guitar frequencies)
7. **FFT Size**: 4096 samples for better low-frequency resolution

## Future Enhancements (Not Yet Implemented)

- [ ] Alternative tuning modes (Drop D, Open G, etc.)
- [ ] Reference tone playback
- [ ] Light mode toggle
- [ ] PWA support for offline use
- [ ] Noise gate adjustments
- [ ] Sensitivity settings
