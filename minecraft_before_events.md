# Minecraft Event Signals Overview

This document lists available **AfterEvent** and **BeforeEvent** signals across the Minecraft World. All events are read-only and support early-execution mode.

---

## After Events
These events fire **after** the corresponding action has occurred:

- blockExplode
- buttonPush
- dataDrivenEntityTrigger
- effectAdd
- entityDie
- entityHealthChanged
- entityHitBlock
- entityHitEntity
- entityHurt
- entityLoad
- entityRemove
- entitySpawn
- explosion
- gameRuleChange
- itemCompleteUse
- itemReleaseUse
- itemStartUse
- itemStartUseOn
- itemStopUse
- itemStopUseOn
- itemUse
- leverAction
- pistonActivate
- playerBreakBlock
- playerButtonInput
- playerDimensionChange
- playerEmote
- playerGameModeChange
- playerHotbarSelectedSlotChange
- playerInputModeChange
- playerInputPermissionCategoryChange
- playerInteractWithBlock
- playerInteractWithEntity
- playerInventoryItemChange
- playerJoin
- playerLeave
- playerPlaceBlock
- playerSpawn
- pressurePlatePop
- pressurePlatePush
- projectileHitBlock
- projectileHitEntity
- targetBlockHit
- tripWireTrip
- weatherChange
- worldLoad

---

## Before Events
These events fire **before** the corresponding action takes place:

- effectAdd
- entityRemove
- explosion
- itemUse
- playerBreakBlock
- playerGameModeChange
- playerInteractWithBlock
- playerInteractWithEntity
- playerLeave
- weatherChange

