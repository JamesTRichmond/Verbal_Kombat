import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const vk = {};
new Function('window', readFileSync(join(root, 'src/engine/screenFlow.js'), 'utf8'))({VK: vk});

const ARGUMENT = {categoryId: 'food', questionId: 'pineapple_pizza', questionText: 'Does pineapple belong on pizza?'};
const FIGHTERS = {fighterId: 'logician', opponentId: 'demagogue'};
const LOCATION = {locationId: 'forum'};

// ---- full traversal, deep state survives to the verdict ----
{
  const seen = [];
  const flow = vk.screenFlow.create({onChange: (screen) => seen.push(screen)});
  assert.equal(flow.getScreen(), 'argument');

  flow.selectArgument(ARGUMENT);
  flow.selectFighter(FIGHTERS);
  flow.selectLocation(LOCATION);
  flow.finishFight({placeholder: true});

  assert.equal(flow.getScreen(), 'verdict');
  assert.deepEqual(seen, ['fighter', 'location', 'fight', 'verdict']);

  const setup = flow.getSetup();
  assert.equal(setup.topic.questionText, ARGUMENT.questionText);
  assert.equal(setup.topic.categoryId, 'food');
  assert.equal(setup.topic.isCustom, false);
  assert.equal(setup.fighter, 'logician');
  assert.equal(setup.opponent, 'demagogue');
  assert.equal(setup.location, 'forum');
  assert.deepEqual(setup.result, {placeholder: true});
}

// ---- custom questions are category-bound and marked ----
{
  const flow = vk.screenFlow.create();
  flow.selectArgument({categoryId: 'science', questionText: 'Is water wet?', isCustom: true});
  assert.equal(flow.getSetup().topic.questionId, 'custom');
  assert.equal(flow.getSetup().topic.isCustom, true);
}

// ---- transitions only fire from their own screen; bad payloads rejected ----
{
  const flow = vk.screenFlow.create();
  assert.throws(() => flow.selectFighter(FIGHTERS), /only valid on the fighter screen/);
  assert.throws(() => flow.finishFight(), /only valid on the fight screen/);
  assert.throws(() => flow.selectArgument({categoryId: 'food'}), /selectArgument needs/);
  assert.throws(() => flow.selectArgument({categoryId: 'food', questionText: 'x'}), /selectArgument needs/,
    'non-custom questions need a questionId');
  flow.selectArgument(ARGUMENT);
  assert.throws(() => flow.selectFighter({fighterId: 'logician', opponentId: 'logician'}), /must differ/);
  assert.throws(() => flow.selectLocation(LOCATION), /only valid on the location screen/);
  assert.equal(flow.getScreen(), 'fighter', 'failed transitions do not move the machine');
}

// ---- back-navigation clears the re-entered screen's selection, keeps earlier ones ----
{
  const flow = vk.screenFlow.create();
  flow.selectArgument(ARGUMENT);
  flow.selectFighter(FIGHTERS);
  flow.selectLocation(LOCATION);
  assert.equal(flow.getScreen(), 'fight');

  assert.equal(flow.back(), true);
  assert.equal(flow.getScreen(), 'location');
  assert.equal(flow.getSetup().location, null, 'location cleared on back');
  assert.equal(flow.getSetup().fighter, 'logician', 'earlier selections kept');

  assert.equal(flow.back(), true);
  assert.equal(flow.getScreen(), 'fighter');
  assert.equal(flow.getSetup().fighter, null);
  assert.equal(flow.getSetup().topic.categoryId, 'food');

  assert.equal(flow.back(), true);
  assert.equal(flow.getScreen(), 'argument');
  assert.equal(flow.getSetup().topic, null);

  assert.equal(flow.back(), false, 'no back from the first screen');
}

// ---- no back from the verdict; reset starts a clean round ----
{
  const flow = vk.screenFlow.create();
  flow.selectArgument(ARGUMENT);
  flow.selectFighter(FIGHTERS);
  flow.selectLocation(LOCATION);
  flow.finishFight(null);
  assert.equal(flow.back(), false, 'the round is over — no back from verdict');

  flow.reset();
  assert.equal(flow.getScreen(), 'argument');
  assert.deepEqual(flow.getSetup(),
    {topic: null, fighter: null, opponent: null, location: null, result: null});
}

// ---- getSetup returns copies, not live references ----
{
  const flow = vk.screenFlow.create();
  flow.selectArgument(ARGUMENT);
  const leaked = flow.getSetup();
  leaked.topic.questionText = 'tampered';
  assert.equal(flow.getSetup().topic.questionText, ARGUMENT.questionText);
}

console.log('Screen-flow tests passed.');
