import { CombatDock } from "./combat-dock.mjs";

const MODULE_ID = "draw-steel-combat-tracker";

/* -------------------------------------------------- */
/*   Initialization                                   */
/* -------------------------------------------------- */

Hooks.once("init", () => {
  foundry.applications.handlebars.loadTemplates([
    `modules/${MODULE_ID}/templates/combat-dock.hbs`,
  ]);

  game.settings.register(MODULE_ID, "showTooltip", {
    name: `${MODULE_ID}.Settings.ShowTooltip.Name`,
    hint: `${MODULE_ID}.Settings.ShowTooltip.Hint`,
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "heroImageSource", {
    name: `${MODULE_ID}.Settings.HeroImageSource.Name`,
    hint: `${MODULE_ID}.Settings.HeroImageSource.Hint`,
    scope: "client",
    config: true,
    type: String,
    choices: {
      token: `${MODULE_ID}.Settings.ImageSource.Token`,
      portrait: `${MODULE_ID}.Settings.ImageSource.Portrait`,
    },
    default: "token",
    onChange: () => ui.dsCombatDock?.scheduleRefresh(),
  });

  game.settings.register(MODULE_ID, "monsterImageSource", {
    name: `${MODULE_ID}.Settings.MonsterImageSource.Name`,
    hint: `${MODULE_ID}.Settings.MonsterImageSource.Hint`,
    scope: "client",
    config: true,
    type: String,
    choices: {
      token: `${MODULE_ID}.Settings.ImageSource.Token`,
      portrait: `${MODULE_ID}.Settings.ImageSource.Portrait`,
    },
    default: "token",
    onChange: () => ui.dsCombatDock?.scheduleRefresh(),
  });

  game.settings.register(MODULE_ID, "capSquadStamina", {
    name: `${MODULE_ID}.Settings.CapSquadStamina.Name`,
    hint: `${MODULE_ID}.Settings.CapSquadStamina.Hint`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "deadOverlay", {
    name: `${MODULE_ID}.Settings.DeadOverlay.Name`,
    hint: `${MODULE_ID}.Settings.DeadOverlay.Hint`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "autoMinionDeath", {
    name: `${MODULE_ID}.Settings.AutoMinionDeath.Name`,
    hint: `${MODULE_ID}.Settings.AutoMinionDeath.Hint`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
});

/* -------------------------------------------------- */
/*   Ready — Restore dock if combat is already active */
/* -------------------------------------------------- */

Hooks.on("ready", () => {
  const combat = game.combat;
  if (combat?.started) {
    new CombatDock(combat).render();
  }
});

/* -------------------------------------------------- */
/*   Combat Lifecycle Hooks                           */
/* -------------------------------------------------- */

Hooks.on("combatStart", (combat) => {
  if (!ui.dsCombatDock || ui.dsCombatDock.combat !== combat) {
    new CombatDock(combat).render();
  }
});

Hooks.on("deleteCombat", (combat) => {
  if (ui.dsCombatDock?.combat === combat) {
    ui.dsCombatDock.close();
  }
});

/* -------------------------------------------------- */
/*   Combat Update Hooks                              */
/* -------------------------------------------------- */

Hooks.on("updateCombat", (combat, changes) => {
  if (!combat.started) {
    if (ui.dsCombatDock?.combat === combat) ui.dsCombatDock.close();
    return;
  }

  // Create dock if combat just became active and we don't have one
  if (!ui.dsCombatDock && combat === game.combat) {
    new CombatDock(combat).render();
    return;
  }

  if (ui.dsCombatDock?.combat !== combat) return;
  ui.dsCombatDock.scheduleRefresh();
});

/* -------------------------------------------------- */
/*   Combatant Change Hooks                           */
/* -------------------------------------------------- */

Hooks.on("updateCombatant", (combatant) => {
  if (ui.dsCombatDock?.combat === combatant.combat) {
    ui.dsCombatDock.scheduleRefresh();
  }
});

Hooks.on("createCombatant", (combatant) => {
  if (ui.dsCombatDock?.combat === combatant.combat) {
    ui.dsCombatDock.scheduleRefresh();
  }
});

Hooks.on("deleteCombatant", (combatant) => {
  if (ui.dsCombatDock?.combat === combatant.combat) {
    ui.dsCombatDock.scheduleRefresh();
  }
});

/* -------------------------------------------------- */
/*   Pre-Update CombatantGroup Hook (squad stamina)   */
/* -------------------------------------------------- */

Hooks.on("preUpdateCombatantGroup", (group, changes) => {
  if (!game.user.isGM) return;
  if (!game.settings.get(MODULE_ID, "capSquadStamina")) return;

  const newStamina = foundry.utils.getProperty(changes, "system.staminaValue");
  if (newStamina === undefined) return;

  const max = group.system?.staminaMax;
  if (max != null && newStamina > max) {
    foundry.utils.setProperty(changes, "system.staminaValue", max);
  }
});

// AoE damage cap: when targets exist in the group, limit pool damage to targetCount × individualMax
Hooks.on("preUpdateCombatantGroup", (group, changes) => {
  if (!game.user.isGM) return;
  if (!game.settings.get(MODULE_ID, "autoMinionDeath")) return;

  const newStamina = foundry.utils.getProperty(changes, "system.staminaValue");
  if (newStamina === undefined) return;

  const minionMembers = Array.from(group.members).filter(m => m.actor?.isMinion);
  if (!minionMembers.length) return;

  const individualMax = minionMembers[0].actor?.system?.stamina?.max;
  if (!individualMax || individualMax <= 0) return;

  // Count targeted tokens in this group (alive OR dead — dead targeted ones died from this AoE)
  const targetIds = new Set([...game.user.targets].map(t => t.document.id));
  const targetedInGroup = minionMembers.filter(m => targetIds.has(m.tokenId));
  if (!targetedInGroup.length) return; // no targets in group — don't cap (manual edit)

  // Pre-existing dead = dead members NOT in the target set (died before this AoE)
  const preExistingDead = minionMembers.filter(m => m.isDefeated && !targetIds.has(m.tokenId)).length;
  const poolMax = group.system?.staminaMax;
  const maxTotalDead = preExistingDead + targetedInGroup.length;
  const minAllowedStamina = poolMax - (maxTotalDead * individualMax);

  if (newStamina < minAllowedStamina) {
    foundry.utils.setProperty(changes, "system.staminaValue", minAllowedStamina);
  }
});

/* -------------------------------------------------- */
/*   Automated Minion Death                           */
/* -------------------------------------------------- */

/** @type {Function|null} */
let _currentPickCleanup = null;

/**
 * Check if minions should die based on squad stamina pool math.
 * Squad stamina lives on the CombatantGroup: system.staminaValue (current) / system.staminaMax (pool max).
 * expectedDead = floor((staminaMax - staminaValue) / individualMax)
 *
 * The first death is always automatic:
 * - If targeted minions exist (e.g. /damage X or AoE), those targets are auto-killed first.
 * - If no targets (e.g. HUD stamina edit), one alive minion is auto-killed.
 * Only additional deaths beyond auto-kills enter pick mode.
 */
async function _checkMinionDeaths(group) {
  const minionMembers = Array.from(group.members).filter(m => m.actor?.isMinion);
  if (!minionMembers.length) return;

  const individualMax = minionMembers[0].actor?.system?.stamina?.max;
  if (!individualMax || individualMax <= 0) return;

  const poolMax = group.system.staminaMax;
  const currentPool = group.system.staminaValue;
  const damageTaken = Math.max(0, poolMax - currentPool);
  const currentlyDead = minionMembers.filter(m => m.isDefeated).length;
  let expectedDead = Math.min(minionMembers.length, Math.floor(damageTaken / individualMax));

  // AoE rule: only alive targeted minions can die from this AoE, plus any already dead stay dead
  const targetedInGroup = minionMembers.filter(m =>
    [...game.user.targets].some(t => t.document.id === m.tokenId)
  );
  if (targetedInGroup.length > 0) {
    const aliveTargeted = targetedInGroup.filter(m => !m.isDefeated).length;
    expectedDead = Math.min(expectedDead, currentlyDead + aliveTargeted);
  }

  let additionalDeaths = expectedDead - currentlyDead;
  if (additionalDeaths <= 0) return;

  const aliveMinions = minionMembers.filter(m => !m.isDefeated);

  // If all alive minions should die, just kill them all
  if (aliveMinions.length <= additionalDeaths) {
    for (const m of aliveMinions) {
      try { await m.update({ defeated: true }); } catch (e) { /* Effect already toggled */ }
    }
    return;
  }

  // Build a priority list of token IDs to auto-kill:
  // 1. Targeted tokens (AoE / /damage X)
  // 2. Controlled token (HUD stamina edit — the selected token on canvas)
  const killed = new Set();
  const priorityTokenIds = [];
  for (const t of game.user.targets) {
    priorityTokenIds.push(t.document.id);
  }
  if (canvas.tokens?.controlled?.length) {
    for (const t of canvas.tokens.controlled) {
      if (!priorityTokenIds.includes(t.document.id)) {
        priorityTokenIds.push(t.document.id);
      }
    }
  }

  // Auto-kill priority minions (targeted/controlled) in this group first
  for (const m of aliveMinions) {
    if (killed.size >= additionalDeaths) break;
    if (priorityTokenIds.includes(m.tokenId)) {
      try { await m.update({ defeated: true }); } catch (e) { /* Effect already toggled */ }
      killed.add(m.id);
    }
  }

  // If no priority tokens matched, auto-kill the first alive minion
  if (killed.size === 0) {
    const firstAlive = aliveMinions[0];
    if (firstAlive) {
      try { await firstAlive.update({ defeated: true }); } catch (e) { /* Effect already toggled */ }
      killed.add(firstAlive.id);
    }
  }

  // Remaining deaths beyond auto-kills enter pick mode
  const remaining = additionalDeaths - killed.size;
  if (remaining > 0) {
    const combat = group.parent;
    _startMinionPickMode(combat, group, remaining);
  }
}

/**
 * Enter a pick mode where the GM clicks minion tokens on the canvas to mark them dead.
 * Any alive minion in the group is a valid target.
 * Press Escape to cancel.
 */
function _startMinionPickMode(combat, group, count) {
  // Cancel any existing pick mode
  if (_currentPickCleanup) _currentPickCleanup();

  const validTokenIds = new Set();
  for (const member of group.members) {
    if (member.isDefeated || !member.actor?.isMinion) continue;
    if (member.tokenId) validTokenIds.add(member.tokenId);
  }

  if (!validTokenIds.size || count <= 0) return;

  let remaining = Math.min(count, validTokenIds.size);
  const l = (key, data) => game.i18n.format(`${MODULE_ID}.${key}`, data);
  ui.notifications.info(l("MinionPickPrompt", { count: remaining, name: group.name }));

  const hookId = Hooks.on("controlToken", async (token, controlled) => {
    if (!controlled) return;
    if (!validTokenIds.has(token.document.id)) return;

    const combatant = combat.combatants.find(c => c.tokenId === token.document.id);
    if (!combatant || combatant.isDefeated) return;

    try { await combatant.update({ defeated: true }); } catch (e) { /* Effect already toggled */ }
    validTokenIds.delete(token.document.id);
    remaining--;
    token.release();

    if (remaining > 0 && validTokenIds.size > 0) {
      ui.notifications.info(l("MinionPickPrompt", { count: remaining, name: group.name }));
    } else {
      cleanup();
    }
  });

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      cleanup();
      ui.notifications.info(game.i18n.localize(`${MODULE_ID}.MinionPickCancelled`));
    }
  };

  document.addEventListener("keydown", onKeyDown);

  function cleanup() {
    Hooks.off("controlToken", hookId);
    document.removeEventListener("keydown", onKeyDown);
    _currentPickCleanup = null;
  }

  _currentPickCleanup = cleanup;
}

/* -------------------------------------------------- */
/*   Actor Update Hook                                */
/* -------------------------------------------------- */

Hooks.on("updateActor", (actor, changes) => {
  if (!ui.dsCombatDock) return;
  const combat = ui.dsCombatDock.combat;
  const isInCombat = combat.combatants.some(c => c.actorId === actor.id);
  if (isInCombat) ui.dsCombatDock.scheduleRefresh();

  // Auto-toggle defeated for monsters when stamina hits 0 or recovers (GM only)
  if (!game.user.isGM) return;
  if (foundry.utils.getProperty(changes, "system.stamina.value") === undefined) return;
  if (actor.hasPlayerOwner) return;

  for (const combatant of combat.combatants) {
    if (combatant.actorId !== actor.id) continue;
    // Skip grouped minions — their death is handled by squad pool math
    if (combatant.actor?.isMinion && combatant.group) continue;
    const combatantStamina = combatant.actor?.system?.stamina?.value ?? 0;
    const shouldBeDefeated = combatantStamina <= 0;
    if (combatant.isDefeated !== shouldBeDefeated) {
      combatant.update({ defeated: shouldBeDefeated }).catch(() => { /* Effect already toggled */ });
    }
  }
});

/* -------------------------------------------------- */
/*   Active Effect Hooks (status effect changes)      */
/* -------------------------------------------------- */

// Track actors with in-flight dead effect creation to block batch duplicates
const _pendingDeadActors = new Set();

// Prevent duplicate "dead" effects and optionally force overlay
Hooks.on("preCreateActiveEffect", (effect) => {
  if (!effect.statuses?.has("dead")) return;

  const actor = effect.parent;
  if (actor?.documentName !== "Actor") return;

  // Block if actor already has a dead effect OR one is pending creation
  const existing = actor.effects.find(e => e.statuses.has("dead"));
  if (existing || _pendingDeadActors.has(actor.id)) return false;

  _pendingDeadActors.add(actor.id);

  // Force overlay when setting is enabled
  if (game.settings.get(MODULE_ID, "deadOverlay")) {
    if (!effect.getFlag("core", "overlay")) {
      effect.updateSource({ "flags.core.overlay": true });
    }
  }
});

Hooks.on("createActiveEffect", (effect) => {
  // Clear pending tracker for dead effects
  if (effect.statuses?.has("dead")) {
    const actor = effect.parent;
    if (actor?.documentName === "Actor") _pendingDeadActors.delete(actor.id);
  }

  if (!ui.dsCombatDock) return;
  if (!effect.statuses?.has("dead")) return;
  ui.dsCombatDock.scheduleRefresh();

  // Sync: if "dead" was added directly (e.g. Token HUD), also mark combatant defeated
  if (!game.user.isGM) return;
  const actor = effect.parent;
  if (!actor || actor.documentName !== "Actor") return;
  const combat = ui.dsCombatDock.combat;
  for (const combatant of combat.combatants) {
    if (combatant.actor === actor && !combatant.isDefeated) {
      combatant.update({ defeated: true }).catch(() => {});
    }
  }
});

Hooks.on("deleteActiveEffect", (effect) => {
  if (!ui.dsCombatDock) return;
  if (!effect.statuses?.has("dead")) return;
  ui.dsCombatDock.scheduleRefresh();

  // Sync: if "dead" was removed directly (e.g. Token HUD), also clear combatant defeated
  if (!game.user.isGM) return;
  const actor = effect.parent;
  if (!actor || actor.documentName !== "Actor") return;
  const combat = ui.dsCombatDock.combat;
  for (const combatant of combat.combatants) {
    if (combatant.actor === actor && combatant.isDefeated) {
      combatant.update({ defeated: false }).catch(() => {});
    }
  }
});

/* -------------------------------------------------- */
/*   Combatant Group Change Hooks                     */
/* -------------------------------------------------- */

Hooks.on("createCombatantGroup", (group) => {
  if (ui.dsCombatDock?.combat === group.parent) {
    ui.dsCombatDock.scheduleRefresh();
  }
});

Hooks.on("updateCombatantGroup", (group, changes) => {
  if (ui.dsCombatDock?.combat === group.parent) {
    ui.dsCombatDock.scheduleRefresh();
  }

  // Auto minion death: check if squad stamina crossed a death threshold
  if (!game.user.isGM) return;
  if (!game.settings.get(MODULE_ID, "autoMinionDeath")) return;
  if (foundry.utils.getProperty(changes, "system.staminaValue") === undefined) return;
  _checkMinionDeaths(group);
});

Hooks.on("deleteCombatantGroup", (group) => {
  if (ui.dsCombatDock?.combat === group.parent) {
    ui.dsCombatDock.scheduleRefresh();
  }
});

/* -------------------------------------------------- */
/*   Scene Change Hook                                */
/* -------------------------------------------------- */

Hooks.on("canvasReady", () => {
  const combat = game.combat;
  if (combat?.started && !ui.dsCombatDock) {
    new CombatDock(combat).render();
  } else if (!combat?.started) {
    ui.dsCombatDock?.close();
  }
});
