const EVIDENCE=/\b(because|for example|for instance|evidence|research|data|shows|demonstrates|such as|therefore)\b/gi;
const REBUTTAL=/\b(but|however|although|instead|your claim|that argument|not necessarily|even if|everyone)\b/gi;
const ATTACKS=/\b(idiot|stupid|moron|dumb|shut up|loser)\b/gi;

const matches=(text,pattern)=>(text.match(pattern)||[]).length;

export function gradeArgument(text){
  const words=text.trim().split(/\s+/).filter(Boolean);
  const sentences=text.split(/[.!?]+/).filter(part=>part.trim()).length;
  const claim=Math.min(25,8+(words.length>=12?9:0)+(sentences>=2?8:0));
  const support=Math.min(30,matches(text,EVIDENCE)*10+(words.length>=35?10:0));
  const rebuttal=Math.min(30,matches(text,REBUTTAL)*10);
  const discipline=Math.max(0,15-matches(text,ATTACKS)*15);
  return {claim,support,rebuttal,discipline,total:claim+support+rebuttal+discipline};
}
