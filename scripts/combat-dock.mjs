const MODULE_ID = "draw-steel-combat-tracker";

/**
 * Visual combat dock overlay for Draw Steel's zipper initiative system.
 * Displays party and enemy portraits on opposite sides with a center info panel.
 */
export class CombatDock {
  /**
   * @param {Combat} combat - The active combat encounter
   */
  constructor(combat) {
    ui.dsCombatDock?.close();
    ui.dsCombatDock = this;
    this.combat = combat;
    this.element = null;
    this._lastActedSide = null;
    this._refreshTimer = null;
    this._collapsed = false;
  }

  /* -------------------------------------------------- */

  /**
   * Render or refresh the dock UI.
   */
  async render() {
    // Only show for Draw Steel's default (zipper) initiative mode
    if (!game.combats?.isDefaultInitiativeMode) return;

    const context = this._prepareContext();
    if (!context.started) return;

    const html = await foundry.applications.handlebars.renderTemplate(
      `modules/${MODULE_ID}/templates/combat-dock.hbs`,
      context
    );

    if (!this.element) {
      this.element = document.createElement("section");
      this.element.id = "ds-combat-dock";
      this.element.classList.add(MODULE_ID);
      document.getElementById("ui-top")?.prepend(this.element);
    }

    this.element.innerHTML = html;
    if (this._collapsed) this.element.classList.add("collapsed");

    // Align-left mode
    const alignLeft = game.settings.get(MODULE_ID, "alignLeft");
    this.element.classList.toggle("align-left", alignLeft);

    // Resizable width mode
    const resizable = game.settings.get(MODULE_ID, "resizableWidth");
    this.element.classList.toggle("resizable", resizable);
    if (resizable) {
      if (this._dockWidth) this.element.style.setProperty("--dock-width", this._dockWidth + "px");
      const inner = this.element.querySelector(".ds-combat-dock");
      if (inner) {
        for (const side of ["left", "right"]) {
          const handle = document.createElement("div");
          handle.classList.add("ds-resize-handle", `ds-resize-handle-${side}`);
          inner.appendChild(handle);
        }
      }
    } else {
      this.element.style.removeProperty("--dock-width");
      this._dockWidth = null;
    }

    this._activateListeners();

    // Scroll party side to right end so the active (rightmost) portraits are visible
    const partyEl = this.element.querySelector(".ds-dock-party");
    if (partyEl) partyEl.scrollLeft = partyEl.scrollWidth;
  }

  /* -------------------------------------------------- */

  /**
   * Schedule a debounced refresh to consolidate rapid updates.
   */
  scheduleRefresh() {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => this.render(), 50);
  }

  /* -------------------------------------------------- */

  /**
   * Remove the dock from the DOM and cleanup.
   */
  close() {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this.element?.remove();
    this.element = null;
    this._tooltipEl?.remove();
    this._tooltipEl = null;
    if (ui.dsCombatDock === this) ui.dsCombatDock = null;
  }

  /* -------------------------------------------------- */
  /*   Context Preparation                              */
  /* -------------------------------------------------- */

  /**
   * Prepare the template rendering context.
   * @returns {object}
   */
  _prepareContext() {
    const combat = this.combat;
    if (!combat?.started) return { started: false };

    const entries = this._getEntries();
    const partyEntries = entries.filter(e => e.isParty).reverse();
    const enemyEntries = entries.filter(e => !e.isParty);

    const currentCombatant = combat.combatant;
    const hasTurn = currentCombatant != null && Number.isNumeric(combat.turn);

    // Determine turn label and track acting side
    let turnLabel = "";
    if (hasTurn) {
      const isParty = currentCombatant.hasPlayerOwner || currentCombatant.disposition === 2;
      this._lastActedSide = isParty ? "party" : "enemy";
      turnLabel = game.i18n.localize(isParty
        ? `${MODULE_ID}.HeroTurn`
        : `${MODULE_ID}.VillainTurn`);
    }

    // Determine which side should be highlighted (act next)
    let partyHighlighted = false;
    let enemyHighlighted = false;

    if (!hasTurn) {
      const partyCanAct = partyEntries.some(e => e.canAct);
      const enemyCanAct = enemyEntries.some(e => e.canAct);

      if (this._lastActedSide === "party" && enemyCanAct) {
        enemyHighlighted = true;
      } else if (this._lastActedSide === "enemy" && partyCanAct) {
        partyHighlighted = true;
      } else {
        partyHighlighted = partyCanAct;
        enemyHighlighted = enemyCanAct;
      }
    }

    // Compute CSS classes per entry
    for (const entry of entries) {
      const classes = [];
      if (entry.defeated) classes.push("defeated");
      if (entry.active && hasTurn) classes.push("active");
      else if (!entry.canAct && !entry.defeated) classes.push("done");
      if (entry.canAct && !entry.defeated) classes.push("can-act");
      if (entry.hidden) classes.push("hidden-combatant");
      entry.cssClass = classes.join(" ");
    }

    // End turn permissions
    const canEndTurn = hasTurn && (
      game.user.isGM ||
      currentCombatant.players?.includes(game.user)
    );

    // Check if all non-defeated entries have acted
    const allActed = entries
      .filter(e => !e.defeated)
      .every(e => !e.canAct);

    // Turn label when round is complete
    if (!hasTurn && allActed) {
      turnLabel = game.i18n.localize(`${MODULE_ID}.RoundComplete`);
    }

    // Store tooltip data for floating tooltip
    this._tooltipData = new Map();
    for (const entry of entries) {
      if (entry.tooltipData) {
        this._tooltipData.set(entry.id, { name: entry.name, actionHint: entry.actionHint, tooltipData: entry.tooltipData, isOwner: entry.isOwner });
      }
      if (entry.captainData?.tooltipData) {
        this._tooltipData.set(entry.captainData.id, { name: entry.captainData.name, actionHint: entry.actionHint, tooltipData: entry.captainData.tooltipData, isOwner: entry.isOwner });
      }
      if (entry.nonMinionMembers) {
        for (const m of entry.nonMinionMembers) {
          if (m.tooltipData) {
            this._tooltipData.set(m.id, { name: m.name, actionHint: entry.actionHint, tooltipData: m.tooltipData, isOwner: entry.isOwner });
          }
        }
      }
      if (entry.minionGroups) {
        for (const chunk of entry.minionGroups) {
          for (const m of chunk) {
            if (m.tooltipData) {
              this._tooltipData.set(m.id, { name: m.name, actionHint: entry.actionHint, tooltipData: m.tooltipData, isOwner: entry.isOwner });
            }
          }
        }
      }
    }

    return {
      started: true,
      isGM: game.user.isGM,
      round: combat.round,
      turnLabel,
      hasTurn,
      canEndTurn,
      allActed: allActed && !hasTurn,
      partyEntries,
      enemyEntries,
      partyHighlighted,
      enemyHighlighted,
    };
  }

  /* -------------------------------------------------- */

  /**
   * Get the token image for a combatant, falling back to actor image.
   * @param {Combatant} combatant
   * @returns {string}
   */
  _getTokenImg(combatant) {
    const isPlayerOwned = combatant.hasPlayerOwner || combatant.disposition === 2;
    const settingKey = isPlayerOwned ? "heroImageSource" : "monsterImageSource";
    const usePortrait = game.settings.get(MODULE_ID, settingKey) === "portrait";

    if (usePortrait) {
      return combatant.actor?.img
        ?? combatant.token?.texture?.src
        ?? combatant.img
        ?? "icons/svg/mystery-man.svg";
    }

    return combatant.token?.texture?.src
      ?? combatant.actor?.prototypeToken?.texture?.src
      ?? combatant.actor?.img
      ?? combatant.img
      ?? "icons/svg/mystery-man.svg";
  }

  /* -------------------------------------------------- */

  /**
   * Build tooltip data for a combatant's actor if tooltip setting is enabled.
   * Monster stats are only visible to the GM. Player stats are visible to everyone.
   * @param {Actor|null} actor
   * @returns {string[]|null}
   */
  _getTooltipData(actor) {
    if (!actor) return null;
    if (!game.settings.get(MODULE_ID, "showTooltip")) return null;

    const isPlayerOwned = actor.hasPlayerOwner;

    // Monster tooltips are GM-only
    if (!isPlayerOwned && !game.user.isGM) return null;

    const l = (key) => game.i18n.localize(`${MODULE_ID}.Tooltip.${key}`);
    const lines = [];

    // Stamina
    const staminaVal = foundry.utils.getProperty(actor, "system.stamina.value");
    const staminaMax = foundry.utils.getProperty(actor, "system.stamina.max");
    if (staminaVal != null && staminaMax != null) {
      let staminaLine = `${l("Stamina")}: ${staminaVal}/${staminaMax}`;
      const tempStamina = foundry.utils.getProperty(actor, "system.stamina.temporary");
      if (tempStamina) staminaLine += ` (+${tempStamina} ${l("TempStamina")})`;
      lines.push(staminaLine);
    }

    // Heroic Resource (heroes only) — use the named resource from coreResource
    const heroResource = foundry.utils.getProperty(actor, "system.hero.primary.value");
    if (heroResource != null) {
      const resourceName = actor.system?.coreResource?.name ?? l("HeroicResource");
      lines.push(`${resourceName}: ${heroResource}`);
    }

    // Surges (heroes only)
    const surges = foundry.utils.getProperty(actor, "system.hero.surges");
    if (surges != null) {
      lines.push(`${l("Surges")}: ${surges}`);
    }

    // Characteristics — returned separately for two-column layout
    const charLines = [];
    const chars = foundry.utils.getProperty(actor, "system.characteristics");
    if (chars) {
      const charNames = ["might", "agility", "reason", "intuition", "presence"];
      for (const c of charNames) {
        const val = chars[c]?.value;
        if (val != null) {
          const label = c.charAt(0).toUpperCase() + c.slice(1);
          charLines.push(`${label}: ${val >= 0 ? "+" : ""}${val}`);
        }
      }
    }

    // Size
    const sizeValue = foundry.utils.getProperty(actor, "system.combat.size.value");
    const sizeLetter = foundry.utils.getProperty(actor, "system.combat.size.letter");
    if (sizeValue != null || sizeLetter) {
      const parts = [sizeLetter, sizeValue != null ? `(${sizeValue})` : null].filter(Boolean);
      lines.push(`${l("Size")}: ${parts.join(" ")}`);
    }

    // Stability
    const stability = foundry.utils.getProperty(actor, "system.combat.stability");
    if (stability != null) {
      lines.push(`${l("Stability")}: ${stability}`);
    }

    // Speed
    const speed = foundry.utils.getProperty(actor, "system.movement.value");
    if (speed != null) {
      lines.push(`${l("Speed")}: ${speed}`);
    }

    // Disengage
    const disengage = foundry.utils.getProperty(actor, "system.movement.disengage");
    if (disengage != null) {
      lines.push(`${l("Disengage")}: ${disengage}`);
    }

    // NPC extras
    const monsterLevel = foundry.utils.getProperty(actor, "system.monster.level");
    if (monsterLevel != null) {
      const role = foundry.utils.getProperty(actor, "system.monster.role") ?? "";
      const org = foundry.utils.getProperty(actor, "system.monster.organization") ?? "";
      const ev = foundry.utils.getProperty(actor, "system.ev");
      lines.push(`${l("Level")}: ${monsterLevel} ${role} ${org}`.trim());
      if (ev != null) lines.push(`${l("EV")}: ${ev}`);
    }

    if (!lines.length && !charLines.length) return null;
    return { lines, charLines };
  }

  /* -------------------------------------------------- */

  /**
   * Collect all combat entries (groups and ungrouped combatants).
   * @returns {object[]}
   */
  _getEntries() {
    const combat = this.combat;
    const entries = [];
    const groupedIds = new Set();
    const currentTurn = Number.isNumeric(combat.turn) ? combat.turns?.[combat.turn] : null;

    // Process combat groups
    for (const group of combat.groups) {
      if (!group.visible && !game.user.isGM) continue;

      for (const member of group.members) {
        groupedIds.add(member.id);
      }

      const isParty = group.hasPlayerOwner || group.disposition === 2;
      const canAct = group.initiative > 0;
      const active = Array.from(group.members).some(m => m === currentTurn);

      // Build individual member data for group display
      const captain = group.system?.captain;
      let img = group.img;
      let tooltipActor = null;

      // Separate captain/non-minions and minions, group minions by name into 2x2 clusters
      let captainData = null;
      const nonMinionMembers = [];
      const minionsByName = new Map();

      for (const member of group.members) {
        const isCaptain = member === captain;
        const isMinion = member.actor?.isMinion ?? false;
        const memberData = {
          id: member.id,
          name: member.name,
          img: this._getTokenImg(member),
          isCaptain,
          isMinion,
          canAct: member.initiative > 0,
          active: member === currentTurn,
          defeated: member.isDefeated,
          tooltipData: this._getTooltipData(member.actor),
        };

        if (isCaptain) {
          captainData = memberData;
          img = this._getTokenImg(member);
          tooltipActor = member.actor;
        } else if (!isMinion) {
          // Non-minion group member — rendered at captain size
          nonMinionMembers.push(memberData);
          if (!tooltipActor) {
            img = this._getTokenImg(member);
            tooltipActor = member.actor;
          }
        } else {
          if (!tooltipActor) {
            img = this._getTokenImg(member);
            tooltipActor = member.actor;
          }
          const key = member.name ?? "Unknown";
          if (!minionsByName.has(key)) minionsByName.set(key, []);
          minionsByName.get(key).push(memberData);
        }
      }

      // Build minionGroups: chunks of up to 4 minions sharing the same name
      const minionGroups = [];
      for (const [, minions] of minionsByName) {
        for (let i = 0; i < minions.length; i += 4) {
          minionGroups.push(minions.slice(i, i + 4));
        }
      }

      // Group status text: GM sees raw stamina, players see status
      let staminaText = null;
      let staminaClass = "";
      if (game.user.isGM) {
        // GM: cumulative stamina for all groups
        let sv = 0;
        let sm = 0;
        for (const member of group.members) {
          const actor = member.actor;
          if (!actor) continue;
          const val = foundry.utils.getProperty(actor, "system.stamina.value");
          const max = foundry.utils.getProperty(actor, "system.stamina.max");
          if (val != null) sv += val;
          if (max != null) sm += max;
        }
        if (sm > 0) staminaText = `${sv}/${sm}`;
      } else if (isParty) {
        // Players see party group stamina with temp and color
        let sv = 0;
        let sm = 0;
        let tempTotal = 0;
        for (const member of group.members) {
          const actor = member.actor;
          if (!actor) continue;
          const val = foundry.utils.getProperty(actor, "system.stamina.value");
          const max = foundry.utils.getProperty(actor, "system.stamina.max");
          const temp = foundry.utils.getProperty(actor, "system.stamina.temporary") ?? 0;
          if (val != null) sv += val;
          if (max != null) sm += max;
          tempTotal += temp;
        }
        if (sm > 0) {
          staminaText = `${sv}/${sm}`;
          if (tempTotal > 0) staminaText += ` (+${tempTotal}T)`;
          if (sv < 0) staminaClass = "status-critical";
          else if (sv <= sm / 2) staminaClass = "status-winded";
          else staminaClass = "status-healthy";
        }
      } else {
        // Players see monster group alive count
        const total = group.members.size ?? group.members.length ?? 0;
        const alive = Array.from(group.members).filter(m => !m.isDefeated).length;
        staminaText = `${alive}/${total}`;
        if (alive === 0) staminaClass = "status-critical";
        else if (alive < total) staminaClass = "status-winded";
        else staminaClass = "status-healthy";
      }

      // Detect group pill background color from module flag (requires setting enabled).
      let pillColor = null;
      if (game.settings.get(MODULE_ID, "pillColor")) {
        pillColor = group.getFlag(MODULE_ID, "pillColor") ?? null;
      }

      // Simple tooltip (name + action hint)
      const actionHint = canAct
        ? game.i18n.localize(`${MODULE_ID}.Act`)
        : group.defeated
          ? game.i18n.localize(`${MODULE_ID}.Defeated`)
          : game.i18n.localize(`${MODULE_ID}.Restore`);

      entries.push({
        id: group.id,
        type: "group",
        isGroup: true,
        name: group.name,
        img: img || "icons/svg/mystery-man.svg",
        isParty,
        canAct,
        active,
        done: !canAct && !group.defeated,
        defeated: group.defeated,
        hidden: group.hidden,
        initiative: group.initiative,
        minionLabel: null,
        staminaText,
        staminaClass,
        actionHint,
        tooltipData: this._getTooltipData(tooltipActor),
        cssClass: "",
        isOwner: group.isOwner,
        captainData,
        nonMinionMembers,
        minionGroups,
        pillColor,
      });
    }

    // Process ungrouped combatants
    for (const combatant of combat.combatants) {
      if (groupedIds.has(combatant.id)) continue;
      if (!combatant.visible && !game.user.isGM) continue;

      const isParty = combatant.hasPlayerOwner || combatant.disposition === 2;
      const canAct = combatant.initiative > 0;
      const active = combatant === currentTurn;

      // Status/stamina text: GM sees raw numbers, players see status
      let staminaText = null;
      let staminaClass = "";
      const sv = foundry.utils.getProperty(combatant.actor, "system.stamina.value");
      const sm = foundry.utils.getProperty(combatant.actor, "system.stamina.max");
      if (game.user.isGM) {
        // GM: plain stamina for everything
        if (sv != null && sm != null) staminaText = `${sv}/${sm}`;
      } else if (isParty) {
        // Players: show own stamina with temp and color
        if (sv != null && sm != null) {
          staminaText = `${sv}/${sm}`;
          const temp = foundry.utils.getProperty(combatant.actor, "system.stamina.temporary") ?? 0;
          if (temp > 0) staminaText += ` (+${temp}T)`;
          if (sv < 0) staminaClass = "status-critical";
          else if (sv <= sm / 2) staminaClass = "status-winded";
          else staminaClass = "status-healthy";
        }
      } else {
        // Players: monster status word
        if (combatant.isDefeated || (sv != null && sv <= 0)) {
          staminaText = game.i18n.localize(`${MODULE_ID}.Status.Defeated`);
          staminaClass = "status-critical";
        } else if (sv != null && sm != null && sv <= sm / 2) {
          staminaText = game.i18n.localize(`${MODULE_ID}.Status.Winded`);
          staminaClass = "status-winded";
        } else if (sv != null && sm != null) {
          staminaText = game.i18n.localize(`${MODULE_ID}.Status.Uninjured`);
          staminaClass = "status-healthy";
        }
      }

      // simple tooltip
      const actionHint = canAct
        ? game.i18n.localize(`${MODULE_ID}.Act`)
        : combatant.isDefeated
          ? game.i18n.localize(`${MODULE_ID}.Defeated`)
          : game.i18n.localize(`${MODULE_ID}.Restore`);

      entries.push({
        id: combatant.id,
        type: "combatant",
        name: combatant.name,
        img: this._getTokenImg(combatant),
        isParty,
        canAct,
        active,
        done: !canAct && !combatant.isDefeated,
        defeated: combatant.isDefeated,
        hidden: combatant.hidden,
        initiative: combatant.initiative,
        minionLabel: null,
        staminaText,
        staminaClass,
        actionHint,
        tooltipData: this._getTooltipData(combatant.actor),
        cssClass: "",
        isOwner: combatant.isOwner,
      });
    }

    // Sort: active first, then can-act, then done, then defeated, then by name
    entries.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      if (a.defeated !== b.defeated) return a.defeated ? 1 : -1;
      if (a.canAct !== b.canAct) return a.canAct ? -1 : 1;
      return (a.name ?? "").localeCompare(b.name ?? "", game.i18n.lang);
    });

    return entries;
  }

  /* -------------------------------------------------- */
  /*   Event Listeners                                  */
  /* -------------------------------------------------- */

  /**
   * Bind event listeners to the dock elements.
   */
  _activateListeners() {
    if (!this.element) return;

    // Portrait interactions (individual combatants)
    for (const el of this.element.querySelectorAll(".ds-portrait")) {
      el.addEventListener("click", (event) => this._onPortraitClick(event, el));
      el.addEventListener("contextmenu", (event) => this._onPortraitContext(event, el));
      el.addEventListener("mouseenter", (event) => { this._onPortraitHover(event, el, true); this._showTooltip(el); });
      el.addEventListener("mouseleave", (event) => { this._onPortraitHover(event, el, false); this._hideTooltip(); });
    }

    // Group container interactions (pill click toggles group act/restore)
    for (const el of this.element.querySelectorAll(".ds-group-container")) {
      el.addEventListener("click", (event) => this._onGroupPillClick(event, el));
      el.addEventListener("contextmenu", (event) => this._onPortraitContext(event, el));
      el.addEventListener("mouseenter", (event) => this._onPortraitHover(event, el, true));
      el.addEventListener("mouseleave", (event) => this._onPortraitHover(event, el, false));
    }

    // Group wrapper interactions (labels below the pill act like the pill itself)
    for (const el of this.element.querySelectorAll(".ds-group-wrapper")) {
      const groupEl = el.querySelector(".ds-group-container");
      if (!groupEl) continue;
      el.addEventListener("click", (event) => {
        if (event.target.closest(".ds-group-container")) return;
        this._onGroupPillClick(event, groupEl);
      });
      el.addEventListener("contextmenu", (event) => {
        if (event.target.closest(".ds-group-container")) return;
        this._onPortraitContext(event, groupEl);
      });
      el.addEventListener("mouseenter", (event) => {
        if (event.target.closest(".ds-group-container")) return;
        this._onPortraitHover(event, groupEl, true);
      });
      el.addEventListener("mouseleave", (event) => {
        this._onPortraitHover(event, groupEl, false);
      });
    }

    // Group member click (activate individual), right-click, tooltip, and hover highlight
    for (const el of this.element.querySelectorAll(".ds-mini-portrait")) {
      el.addEventListener("click", (event) => this._onMiniPortraitClick(event, el));
      el.addEventListener("contextmenu", (event) => {
        event.stopPropagation();
        this._onPortraitContext(event, el);
      });
      el.addEventListener("mouseenter", (event) => {
        event.stopPropagation();
        this._onMiniPortraitHover(event, el, true);
        this._showTooltip(el);
      });
      el.addEventListener("mouseleave", (event) => {
        this._onMiniPortraitHover(event, el, false);
        this._hideTooltip();
      });
    }

    // Mouse wheel horizontal scroll for side containers
    for (const el of this.element.querySelectorAll(".ds-dock-side")) {
      el.addEventListener("wheel", (event) => {
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
          event.preventDefault();
          el.scrollLeft += event.deltaY;
        }
      }, { passive: false });
    }

    // Action buttons
    for (const btn of this.element.querySelectorAll("[data-action]")) {
      btn.addEventListener("click", (event) => this._onAction(event, btn.dataset.action));
    }

    // Drawer toggle buttons (hide and show)
    for (const toggleBtn of this.element.querySelectorAll(".ds-dock-toggle")) {
      toggleBtn.addEventListener("click", () => {
        this._collapsed = !this._collapsed;
        this.element.classList.toggle("collapsed", this._collapsed);
      });
    }

    // Resize handles for horizontal width dragging
    for (const handle of this.element.querySelectorAll(".ds-resize-handle")) {
      handle.addEventListener("mousedown", (event) => this._onResizeStart(event, handle));
    }
  }

  /* -------------------------------------------------- */

  /**
   * Begin horizontal resize drag from a resize handle.
   * @param {MouseEvent} event
   * @param {HTMLElement} handle
   */
  _onResizeStart(event, handle) {
    event.preventDefault();
    const isLeft = handle.classList.contains("ds-resize-handle-left");
    const startX = event.clientX;
    const startWidth = this.element.offsetWidth;
    // Minimum accommodates ~3 regular portraits (86px) per side + gaps + center panel
    const minWidth = 800;
    handle.classList.add("active");

    const onMove = (e) => {
      const delta = e.clientX - startX;
      // Since the dock is centered, double the delta so the edge tracks the cursor
      const newWidth = Math.max(
        isLeft ? startWidth - (delta * 2) : startWidth + (delta * 2),
        minWidth
      );
      this._dockWidth = newWidth;
      this.element.style.setProperty("--dock-width", newWidth + "px");
    };

    const onUp = () => {
      handle.classList.remove("active");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  /* -------------------------------------------------- */

  /**
   * Handle clicking a portrait to activate (Act) or restore a combatant/group.
   * Mirrors DrawSteelCombatTracker's #onActivateCombatant and #onActivateGroup logic.
   * @param {PointerEvent} event
   * @param {HTMLElement} el
   */
  async _onPortraitClick(event, el) {
    event.preventDefault();
    const { id } = el.dataset;

    const combatant = this.combat.combatants.get(id);
    if (!combatant) return;
    if (!combatant.isOwner && !game.user.isGM) return;

    // Block activation while another turn is active (non-GM)
    const hasTurn = this.combat.combatant != null && Number.isNumeric(this.combat.turn);
    const oldValue = combatant.initiative;

    if (oldValue) {
      if (hasTurn && !game.user.isGM) return;
      // Activating: decrement initiative and set as current turn
      await combatant.update({ initiative: oldValue - 1 });
      const newTurn = this.combat.turns.findIndex(c => c === combatant);
      await this.combat.update({ turn: newTurn }, { direction: 1 });
    } else {
      // Done: restore initiative (GM only)
      if (!game.user.isGM) return;
      const newValue = combatant.actor?.system?.combat?.turns ?? 1;
      await combatant.update({ initiative: newValue });
    }
  }

  /* -------------------------------------------------- */

  /**
   * Handle clicking a mini-portrait within a group to activate that specific member.
   * Mirrors DrawSteelCombatTracker's #onActivateCombatant logic.
   * @param {PointerEvent} event
   * @param {HTMLElement} el
   */
  async _onMiniPortraitClick(event, el) {
    event.preventDefault();
    event.stopPropagation();
    const memberId = el.dataset.memberId;
    const combatant = this.combat.combatants.get(memberId);
    if (!combatant) return;
    if (!combatant.isOwner && !game.user.isGM) return;

    const hasTurn = this.combat.combatant != null && Number.isNumeric(this.combat.turn);
    const oldValue = combatant.initiative;

    if (oldValue) {
      if (hasTurn && !game.user.isGM) return;
      // Activating: decrement member initiative and parent group initiative, set as turn
      await combatant.update({ initiative: oldValue - 1 });
      const group = combatant.group;
      if (group && group.initiative > 0) {
        await group.update({ initiative: group.initiative - 1 });
      }
      const newTurn = this.combat.turns.findIndex(c => c === combatant);
      await this.combat.update({ turn: newTurn }, { direction: 1 });
    } else {
      // Done: restore initiative (GM only)
      if (!game.user.isGM) return;
      const newValue = combatant.actor?.system?.combat?.turns ?? 1;
      await combatant.update({ initiative: newValue });
    }
  }

  /* -------------------------------------------------- */

  /**
   * Handle clicking the group pill container to toggle the group's act/restore state.
   * @param {PointerEvent} event
   * @param {HTMLElement} el
   */
  async _onGroupPillClick(event, el) {
    event.preventDefault();
    const { id } = el.dataset;
    const group = this.combat.groups.get(id);
    if (!group) return;
    if (!group.isOwner && !game.user.isGM) return;

    const hasTurn = this.combat.combatant != null && Number.isNumeric(this.combat.turn);
    const oldValue = group.initiative;

    if (oldValue) {
      if (hasTurn && !game.user.isGM) return;
      // Activating: decrement group initiative, pick a member, decrement their initiative, set as turn
      await group.update({ initiative: oldValue - 1 });
      const combatant = Array.from(group.members).find(c => c.initiative);
      if (combatant) {
        await combatant.update({ initiative: (combatant.initiative ?? 1) - 1 });
        const newTurn = this.combat.turns.findIndex(c => c === combatant);
        await this.combat.update({ turn: newTurn }, { direction: 1 });
      }
    } else {
      // Done: restore initiative (GM only)
      if (!game.user.isGM) return;
      await group.update({ initiative: 1 });
    }
  }

  /* -------------------------------------------------- */

  /**
   * Handle right-clicking a portrait to open the actor/group sheet.
   * @param {PointerEvent} event
   * @param {HTMLElement} el
   */
  _onPortraitContext(event, el) {
    event.preventDefault();
    const id = el.dataset.memberId ?? el.dataset.id;
    const type = el.dataset.memberId ? "combatant" : el.dataset.type;

    if (type === "combatant") {
      const combatant = this.combat.combatants.get(id);
      if (combatant?.actor?.testUserPermission(game.user, "OBSERVER")) {
        combatant.actor.sheet?.render(true);
      }
    }
    // Groups: do not open group sheet from the combat dock
  }

  /* -------------------------------------------------- */

  /**
   * Handle hovering over a portrait to highlight tokens on the canvas.
   * @param {PointerEvent} event
   * @param {HTMLElement} el
   * @param {boolean} isHover
   */
  _onPortraitHover(event, el, isHover) {
    if (!canvas?.ready) return;
    const { id, type } = el.dataset;

    if (type === "group") {
      // Only highlight all members if not hovering a specific mini-portrait
      if (isHover && event.target.closest(".ds-mini-portrait")) return;
      const group = this.combat.groups.get(id);
      if (!group) return;
      for (const member of group.members) {
        const token = canvas.tokens?.get(member.tokenId);
        if (!token?.visible) continue;
        if (isHover) token._onHoverIn(event, { hoverOutOthers: false });
        else token._onHoverOut(event);
      }
    } else {
      const combatant = this.combat.combatants.get(id);
      const token = combatant?.token?.object;
      if (!token?.visible) return;
      if (isHover) token._onHoverIn(event);
      else token._onHoverOut(event);
    }
  }

  /* -------------------------------------------------- */

  /**
   * Handle hovering over an individual mini-portrait to highlight its token.
   * @param {PointerEvent} event
   * @param {HTMLElement} el
   * @param {boolean} isHover
   */
  _onMiniPortraitHover(event, el, isHover) {
    if (!canvas?.ready) return;
    const memberId = el.dataset.memberId;
    if (!memberId) return;

    // Find the parent group to unhover other members first
    const groupEl = el.closest(".ds-group-container");
    const groupId = groupEl?.dataset?.id;
    const group = groupId ? this.combat.groups.get(groupId) : null;

    if (isHover && group) {
      // Unhover all group members, then hover just this one
      for (const member of group.members) {
        const t = canvas.tokens?.get(member.tokenId);
        if (t?.visible) t._onHoverOut(event);
      }
    }

    const combatant = this.combat.combatants.get(memberId);
    const token = combatant?.token?.object;
    if (!token?.visible) return;
    if (isHover) token._onHoverIn(event);
    else token._onHoverOut(event);
  }

  /* -------------------------------------------------- */

  /**
   * Show a floating tooltip for the hovered portrait element.
   * @param {HTMLElement} el
   */
  _showTooltip(el) {
    const id = el.dataset.memberId ?? el.dataset.id;
    const data = this._tooltipData?.get(id);
    if (!data) return;

    if (!this._tooltipEl) {
      this._tooltipEl = document.createElement("div");
      this._tooltipEl.className = "ds-floating-tooltip";
      document.body.appendChild(this._tooltipEl);
    }

    this._tooltipEl.replaceChildren();

    const { name, actionHint, tooltipData, isOwner } = data;
    const header = document.createElement("div");
    header.className = "ds-tooltip-header";
    header.textContent = name + " ";
    if (game.user.isGM || isOwner) {
      const hint = document.createElement("span");
      hint.className = "ds-tooltip-hint";
      hint.textContent = `\u2014 ${actionHint}`;
      header.appendChild(hint);
    }
    this._tooltipEl.appendChild(header);

    const { lines, charLines } = tooltipData;
    const hasChars = charLines.length > 0;
    const hasLines = lines.length > 0;

    if (hasChars && hasLines) {
      // Two-column layout: stats | divider | characteristics
      const body = document.createElement("div");
      body.className = "ds-tooltip-body";

      const leftCol = document.createElement("div");
      leftCol.className = "ds-tooltip-col";
      for (const line of lines) {
        const el = document.createElement("div");
        el.className = "ds-tooltip-line";
        el.textContent = line;
        leftCol.appendChild(el);
      }
      body.appendChild(leftCol);

      const divider = document.createElement("div");
      divider.className = "ds-tooltip-divider";
      body.appendChild(divider);

      const rightCol = document.createElement("div");
      rightCol.className = "ds-tooltip-col";
      for (const line of charLines) {
        const el = document.createElement("div");
        el.className = "ds-tooltip-line";
        el.textContent = line;
        rightCol.appendChild(el);
      }
      body.appendChild(rightCol);

      this._tooltipEl.appendChild(body);
    } else {
      // Single column: just lines or just characteristics
      const all = hasLines ? lines : charLines;
      for (const line of all) {
        const el = document.createElement("div");
        el.className = "ds-tooltip-line";
        el.textContent = line;
        this._tooltipEl.appendChild(el);
      }
    }

    this._tooltipEl.style.display = "block";
    const rect = el.getBoundingClientRect();
    this._tooltipEl.style.left = `${rect.left + rect.width / 2}px`;
    this._tooltipEl.style.top = `${rect.bottom + 6}px`;
  }

  /**
   * Hide the floating tooltip.
   */
  _hideTooltip() {
    if (this._tooltipEl) {
      this._tooltipEl.style.display = "none";
    }
  }

  /* -------------------------------------------------- */

  /**
   * Handle action button clicks (End Turn, Next/Prev Round, Close Combat).
   * @param {PointerEvent} event
   * @param {string} action
   */
  async _onAction(event, action) {
    event.preventDefault();
    switch (action) {
      case "endTurn":
        if (typeof this.combat.endTurn === "function") {
          await this.combat.endTurn();
        } else {
          await this.combat.nextTurn();
        }
        break;
      case "nextRound":
        await this.combat.nextRound();
        break;
      case "prevRound":
        await this.combat.previousRound();
        break;
      case "closeCombat":
        await this.combat.endCombat();
        break;
    }
  }
}
