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
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "heroImageSource", {
    name: `${MODULE_ID}.Settings.HeroImageSource.Name`,
    hint: `${MODULE_ID}.Settings.HeroImageSource.Hint`,
    scope: "world",
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
    scope: "world",
    config: true,
    type: String,
    choices: {
      token: `${MODULE_ID}.Settings.ImageSource.Token`,
      portrait: `${MODULE_ID}.Settings.ImageSource.Portrait`,
    },
    default: "token",
    onChange: () => ui.dsCombatDock?.scheduleRefresh(),
  });

  game.settings.register(MODULE_ID, "deadOverlay", {
    name: `${MODULE_ID}.Settings.DeadOverlay.Name`,
    hint: `${MODULE_ID}.Settings.DeadOverlay.Hint`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "pillColor", {
    name: `${MODULE_ID}.Settings.PillColor.Name`,
    hint: `${MODULE_ID}.Settings.PillColor.Hint`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => ui.dsCombatDock?.scheduleRefresh(),
  });

  game.settings.register(MODULE_ID, "resizableWidth", {
    name: `${MODULE_ID}.Settings.ResizableWidth.Name`,
    hint: `${MODULE_ID}.Settings.ResizableWidth.Hint`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => ui.dsCombatDock?.scheduleRefresh(),
  });

  game.settings.register(MODULE_ID, "alignLeft", {
    name: `${MODULE_ID}.Settings.AlignLeft.Name`,
    hint: `${MODULE_ID}.Settings.AlignLeft.Hint`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
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

  // Replace colorTokensDialog to add a "Dock Background" button.
  // Stores pill color as a module flag on the CombatantGroup document.
  const CombatantGroup = CONFIG.CombatantGroup?.documentClass;
  if (CombatantGroup?.prototype?.colorTokensDialog) {
    CombatantGroup.prototype.colorTokensDialog = async function () {
      const content = document.createElement("div");
      const colorInput = foundry.applications.fields.createFormGroup({
        label: "DRAW_STEEL.CombatantGroup.ColorTokens.Input",
        input: foundry.applications.elements.HTMLColorPickerElement.create({ name: "color" }),
        localize: true,
      });
      const swatches = document.createElement("div");
      swatches.className = "form-group color-swatches";
      for (const c of ["#FFFFFF", "#000000", "#FF0000", "#00FF00", "#0000FF", "#00FFFF", "#FF00FF", "#FFFF00"]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "color-swatch";
        Object.assign(btn.dataset, { action: "swatchColor", color: c });
        btn.style.cssText = `--swatch-color: ${c}`;
        swatches.append(btn);
      }
      content.append(colorInput, swatches);

      const buttons = [
        {
          label: "TOKEN.FIELDS.texture.tint.label",
          action: "texture.tint",
          callback: (ev, button) => ({
            fieldPath: button.dataset.action,
            color: button.form.color.value,
          }),
        },
        {
          label: "TOKEN.FIELDS.ring.colors.ring.label",
          action: "ring.colors.ring",
          callback: (ev, button) => ({
            fieldPath: button.dataset.action,
            color: button.form.color.value,
          }),
        },
      ];

      if (game.settings.get(MODULE_ID, "pillColor")) {
        buttons.push({
          label: `${MODULE_ID}.PillBackground`,
          action: "pillColor",
          callback: (ev, button) => ({
            pillColor: true,
            color: button.form.color.value,
          }),
        });
      }

      const fd = await foundry.applications.api.Dialog.wait({
        content,
        actions: {
          swatchColor(ev, target) { target.form.color.value = target.dataset.color; },
        },
        classes: ["draw-steel", "color-tokens"],
        window: {
          title: "DRAW_STEEL.CombatantGroup.ColorTokens.Title",
          icon: "fa-solid fa-palette",
        },
        position: { width: 400, height: "auto" },
        buttons,
      });

      if (!fd) return;

      // Third button: store color as a module flag
      if (fd.pillColor) {
        await this.setFlag(MODULE_ID, "pillColor", fd.color.toLowerCase());
        ui.dsCombatDock?.scheduleRefresh();
        return;
      }

      // First two buttons: update tokens as usual
      return this.updateTokens(fd.fieldPath, fd.color);
    };
  }
});

/* -------------------------------------------------- */
/*   Combat Lifecycle Hooks                           */
/* -------------------------------------------------- */

Hooks.on("combatStart", (combat, updateData) => {
  // Prevent the auto-assigned initial turn so no token gets the turn indicator ring
  if (updateData) updateData.turn = null;
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
  // Match both linked actors (actorId) and unlinked synthetic token actors (c.actor.id)
  const isInCombat = combat.combatants.some(c => c.actorId === actor.id || c.actor?.id === actor.id);
  if (isInCombat) ui.dsCombatDock.scheduleRefresh();

  // Auto-toggle defeated for monsters when stamina hits 0 or recovers (GM only)
  if (!game.user.isGM) return;
  if (foundry.utils.getProperty(changes, "system.stamina.value") === undefined) return;
  if (actor.hasPlayerOwner) return;

  for (const combatant of combat.combatants) {
    if (combatant.actorId !== actor.id && combatant.actor?.id !== actor.id) continue;
    // Skip grouped minions — their death is handled by squad pool math
    if (combatant.actor?.isMinion && combatant.group) continue;
    const combatantStamina = combatant.actor?.system?.stamina?.value ?? 0;
    const shouldBeDefeated = combatantStamina <= 0;
    if (combatant.isDefeated !== shouldBeDefeated) {
      combatant.update({ defeated: shouldBeDefeated }).catch(() => {});
      const defeatedId = CONFIG.specialStatusEffects.DEFEATED;
      combatant.actor.toggleStatusEffect(defeatedId, { overlay: true, active: shouldBeDefeated }).catch(() => {});
    }
  }
});

/* -------------------------------------------------- */
/*   Active Effect Hooks (status effect changes)      */
/* -------------------------------------------------- */

// Track actors with in-flight dead effect creation/deletion to block race conditions
const _pendingDeadActors = new Set();
const _pendingDeadDeletions = new Set();

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

// Block duplicate dead effect deletions (monks-combat-details races with core)
Hooks.on("preDeleteActiveEffect", (effect) => {
  if (!effect.statuses?.has("dead")) return;

  const actor = effect.parent;
  if (actor?.documentName !== "Actor") return;

  // If a deletion for this actor's dead effect is already in-flight, block this one
  if (_pendingDeadDeletions.has(actor.id)) return false;
  _pendingDeadDeletions.add(actor.id);
});

Hooks.on("deleteActiveEffect", (effect) => {
  // Clear pending deletion tracker for dead effects
  if (effect.statuses?.has("dead")) {
    const actor = effect.parent;
    if (actor?.documentName === "Actor") {
      _pendingDeadActors.delete(actor.id);
      _pendingDeadDeletions.delete(actor.id);
    }
  }

  if (!ui.dsCombatDock) return;
  if (!effect.statuses?.has("dead")) return;
  ui.dsCombatDock.scheduleRefresh();

  // Sync: if "dead" was removed directly (e.g. Token HUD), also clear combatant defeated.
  // Skip if combatant.defeated is already false — means the encounter tab toggle
  // already handled it (core sets defeated=false BEFORE deleting the dead effect).
  if (!game.user.isGM) return;
  const actor = effect.parent;
  if (!actor || actor.documentName !== "Actor") return;
  const combat = ui.dsCombatDock.combat;
  for (const combatant of combat.combatants) {
    if (combatant.actor === actor && combatant.defeated) {
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
