import type { Config } from "tailwindcss";
export default { content:["./app/**/*.{ts,tsx}","./components/**/*.{ts,tsx}"], theme:{extend:{fontFamily:{sans:["var(--font-sans)","Arial","sans-serif"],serif:["var(--font-serif)","Georgia","serif"]},colors:{ink:"var(--ink)",paper:"var(--paper)",tomato:"var(--tomato)",moss:"var(--moss)"}}},plugins:[] } satisfies Config;
