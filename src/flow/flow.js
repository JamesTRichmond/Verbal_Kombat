/*
 * flow.js — screen-flow state machine for Release 1.
 *
 * Tracks the player's progress through Argument → Fighter → Location →
 * Fight → Verdict and keeps every selection (topic, fighter, location,
 * fight result) so the verdict can explain what happened. Transitions are
 * pure functions: they return a new flow object rather than mutating the
 * existing one, which makes the flow trivial to test and replay.
 */
(function (VK) {
  "use strict";

  var SCREENS = {
    ARGUMENT: "argument",
    FIGHTER: "fighter",
    LOCATION: "location",
    FIGHT: "fight",
    VERDICT: "verdict",
  };

  function createFlow(initial) {
    return {
      screen: SCREENS.ARGUMENT,
      history: [],
      topic: null,
      playerFighterId: null,
      locationId: null,
      fightResult: null,
      ...(initial ?? {}),
    };
  }

  function selectTopic(flow, categoryId, questionText) {
    if (flow.screen !== SCREENS.ARGUMENT) return flow;
    return transition(flow, SCREENS.FIGHTER, {
      topic: {
        categoryId: categoryId,
        questionText: (questionText || "").trim(),
      },
      playerFighterId: null,
      locationId: null,
      fightResult: null,
    });
  }

  function selectFighter(flow, fighterId) {
    if (flow.screen !== SCREENS.FIGHTER) return flow;
    return transition(flow, SCREENS.LOCATION, {
      playerFighterId: fighterId,
      locationId: null,
      fightResult: null,
    });
  }

  function selectLocation(flow, locationId) {
    if (flow.screen !== SCREENS.LOCATION) return flow;
    return transition(flow, SCREENS.FIGHT, {
      locationId: locationId,
      fightResult: null,
    });
  }

  function endFight(flow, result) {
    if (flow.screen !== SCREENS.FIGHT) return flow;
    return transition(flow, SCREENS.VERDICT, {
      fightResult: result || null,
    });
  }

  function goBack(flow) {
    if (!canGoBack(flow)) return flow;
    var previous = flow.history[flow.history.length - 1];
    var nextHistory = flow.history.slice(0, flow.history.length - 1);
    return {
      ...flow,
      screen: previous,
      history: nextHistory,
    };
  }

  function canGoBack(flow) {
    return flow.history.length > 0;
  }

  function resetFlow(flow) {
    return createFlow({
      topic: flow.topic,
      playerFighterId: flow.playerFighterId,
      locationId: flow.locationId,
    });
  }

  function transition(flow, nextScreen, updates) {
    return {
      ...flow,
      ...updates,
      screen: nextScreen,
      history: flow.history.concat(flow.screen),
    };
  }

  VK.flow = {
    SCREENS: SCREENS,
    create: createFlow,
    selectTopic: selectTopic,
    selectFighter: selectFighter,
    selectLocation: selectLocation,
    endFight: endFight,
    goBack: goBack,
    canGoBack: canGoBack,
    reset: resetFlow,
  };
})(window.VK);
