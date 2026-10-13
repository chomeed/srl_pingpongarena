# How scoring works video

`scene.html` draws the explainer on a canvas, frame by frame; `render.cjs` captures it with Playwright.

```bash
cd media/video-source
node render.cjs full frames            # 30 fps JPEG frames
ffmpeg -framerate 30 -i frames/f%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 23 -movflags +faststart ../how-scoring-works.mp4
ffmpeg -ss 2.5 -i ../how-scoring-works.mp4 -frames:v 1 -q:v 3 ../how-scoring-works.jpg
```
Update the numbers in `scene.html` if the rating rules change.
