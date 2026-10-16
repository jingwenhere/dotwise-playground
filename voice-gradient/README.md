# Dotwise Voice Gradient

Standalone React + WebGL audio-reactive gradient playground.

## Run

```sh
npm ci
npm run dev
```

Build with `npm run build`. Deploy this folder as the Vercel project root.

Audio response controls how strongly speech affects flow speed, independently of playback Volume. Silence retains ambient flow. Defaults load on every page open.

The looping English sample is a public-domain LJ Speech recording; see `public/audio/SOURCE.md`. Captions use approximate prerecorded word timings, not live speech recognition.

Orb runtime adapted from [Orbkit](https://github.com/oryanmoshe/orbkit); the gradient shader and Dotwise interface are customized.
