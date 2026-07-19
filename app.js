import {gradeArgument} from './scoring.js';
import {resolveCombat} from './combat.js';
import {RELEASE_ONE_BOUT as bout} from './prompts.js';

const $=selector=>document.querySelector(selector);
const form=$('#argument-form');const input=$('#argument');const result=$('#result');
const health=(fighter,value)=>{$(`#${fighter}-health`).style.width=`${value}%`;$ (`#${fighter}-hp-label`).textContent=`${value} HP`};
const card=(label,value,max)=>`<div class="score-card"><strong>${value}/${max}</strong><span>${label}</span></div>`;

$('#round-label').textContent=`Round ${bout.number} of ${bout.totalRounds}`;
$('#round-title').textContent=bout.topic;
$('#opponent-claim').textContent=`“${bout.opponent.claim}”`;

input.addEventListener('input',()=>$('#character-count').textContent=`${input.value.length} / 420`);
form.addEventListener('submit',event=>{
  event.preventDefault();
  const text=input.value.trim();
  if(!text) return input.focus();
  const score=gradeArgument(text);
  health('rival',combat.opponentHealth);health('player',combat.playerHealth);
  $('#verdict').textContent=combat.verdict;
  $('#score-breakdown').innerHTML=card('Claim',score.claim,25)+card('Support',score.support,30)+card('Rebuttal',score.rebuttal,30)+card('Discipline',score.discipline,15);
  $('#commentary').textContent=combat.won?'Your argument connected: you developed a position, supported it, and answered the rival.':'The Heckler slipped your attack. Add a reason or example and directly challenge the “everyone knows” claim.';
  form.hidden=true;result.hidden=false;result.focus();
});
$('#restart-button').addEventListener('click',()=>{
  form.reset();$('#character-count').textContent='0 / 420';form.hidden=false;result.hidden=true;health('rival',100);health('player',100);input.focus();
});
