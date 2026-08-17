import type { Mixtape } from "./types";
import { DEMO_MIXTAPE } from "./demo";
const KEY="mixtape-draft";
export function loadDraft():Mixtape{if(typeof window==="undefined")return DEMO_MIXTAPE;try{return JSON.parse(localStorage.getItem(KEY)||"") as Mixtape}catch{return DEMO_MIXTAPE}}
export function saveDraft(m:Mixtape){localStorage.setItem(KEY,JSON.stringify(m))}
