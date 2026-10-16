// Public-domain LJ025-0076 text, verified against the dataset's sample caption.
// Approximate word cues for this fixed recording, not speech recognition results.
export const sampleWords = [
 [0.18,'Many'],[.55,'animals'],[1.12,'of'],[1.27,'even'],[1.68,'complex'],[2.24,'structure'],
 [2.91,'which'],[3.18,'live'],[3.51,'parasitically'],[4.58,'within'],[4.98,'others'],
 [5.58,'are'],[5.84,'wholly'],[6.21,'devoid'],[6.69,'of'],[6.84,'an'],[7.02,'alimentary'],[7.78,'cavity.'],
] as const;
export function recordingTranscript(elapsed:number,duration:number){
 if(duration<=0)return {past:'',current:'',count:0};
 const loop=Math.floor(elapsed/duration),local=elapsed%duration;
 const words=sampleWords.filter(([time])=>time<=local).map(([,word])=>word);
 // Retain a bounded history so repeated playback exercises scrolling, not memory growth.
 const complete=sampleWords.map(([,word])=>word).join(' ');
 const past=Array(Math.min(loop,5)).fill(complete).join(' ');
 return {past,current:words.join(' '),count:Math.min(loop,5)*sampleWords.length+words.length};
}
