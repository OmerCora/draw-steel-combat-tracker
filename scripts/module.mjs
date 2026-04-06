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

  const staminaValue = actor.system?.stamina?.value ?? 0;
  for (const combatant of combat.combatants) {
    if (combatant.actorId !== actor.id) continue;
    const shouldBeDefeated = staminaValue <= 0;
    if (combatant.isDefeated !== shouldBeDefeated) {
      combatant.update({ defeated: shouldBeDefeated });
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

Hooks.on("updateCombatantGroup", (group) => {
  if (ui.dsCombatDock?.combat === group.parent) {
    ui.dsCombatDock.scheduleRefresh();
  }
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
