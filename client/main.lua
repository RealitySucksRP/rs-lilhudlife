-- ============================================================
-- RS HUDLIFE V4 - CLIENT
-- Reality Sucks RP
-- ============================================================

local currentVehicle = nil
local currentVehicleClass = nil
local currentVehicleModel = nil
local currentVehicleInfo = nil
local inVehicle = false
local bootPlayed = false
local bootInProgress = false
local bootPtfxHandle = nil
local bootGeneration = 0

-- The NUI reveal displays the localized GTA vehicle name itself. Hide the
-- native vehicle-name/class cards during that short reveal so the two labels
-- never draw on top of one another.
Citizen.CreateThread(function()
    while true do
        if bootInProgress then
            HideHudComponentThisFrame(6) -- VEHICLE_NAME
            HideHudComponentThisFrame(8) -- VEHICLE_CLASS
            Citizen.Wait(0)
        else
            Citizen.Wait(200)
        end
    end
end)
local hudActive = false
local hudMasterEnabled = Config.Enabled ~= false
local menuOpen = false
local externalHudHidden = false
local pauseMenuHiddenHud = false
local radarWasHiddenBeforeMenu = false
local menuRadarForced = false
local menuSession = 0 -- stale browser close callbacks must not close a newly opened menu

-- Closing the menu is an immediate client-side operation. Do not depend on
-- an asynchronous browser callback to release focus or restore the radar:
-- pauses, inventories, logouts and restarts can interrupt that callback.
local function setMenuRadarVisible(visible)
    if visible then
        if not menuRadarForced then
            radarWasHiddenBeforeMenu = IsRadarHidden()
            menuRadarForced = true
        end
        DisplayRadar(true)
    elseif menuRadarForced then
        menuRadarForced = false
        DisplayRadar(not radarWasHiddenBeforeMenu)
    end
end

local function closeHudMenu(notifyUI)
    local wasOpen = menuOpen
    menuOpen = false
    SetNuiFocusKeepInput(false)
    SetNuiFocus(false, false)
    setMenuRadarVisible(false)
    if notifyUI and wasOpen then
        SendNUIMessage({ action = 'closeMenu' })
    end
    return wasOpen
end

-- Status ring data (fed by native values + universal health bridge)
local statusData = {
    health = 100,
    armor = 0,
    hunger = 100,
    thirst = 100,
    stamina = 100,
    oxygen = 100,
    nos = 0,
    showOxygen = false,
}

-- Money/ID data
local moneyData = {
    cash = 0,
    bank = 0,
    id = 0,
    playerName = '',
    job = '',
    jobGrade = '',
}

local voiceData = {
    connected = false,
    talking = false,
    radio = false,
    level = 'normal',
    mode = 'Normal',
    distance = 0,
}
local voiceRadioActive = false

AddEventHandler('pma-voice:radioActive', function(active)
    voiceRadioActive = active == true
end)



local QBCore = nil
local detectedFramework = 'standalone'
local qbMechanicNosPollPending = false
local qbMechanicNosLastPoll = 0
local qbMechanicNosRequestId = 0
local rsCustomsNosLastPoll = 0
local rsCustomsNosHandled = false
local KVP_KEY = (GetCurrentResourceName() or 'rs-lilhudlife') .. '_settings'
local detectedCashAsItem = nil
local detectedCashItemName = nil
local detectedMoneyProvider = nil

-- ============================================================
-- INVENTORY COMPAT: CASH ITEM COUNTER
-- Supports AP/qb-inventory cash-as-item and ox_inventory. Counts cash stacks
-- from PlayerData.items when available, otherwise safely falls back.
-- ============================================================
local function configuredCashItemName()
    local configured = Config.Money and Config.Money.CashItem
    if type(configured) == 'string' then
        configured = configured:lower()
        if configured ~= '' and configured ~= 'auto' then return configured end
    end
    return nil
end

-- True when the server has positively identified cash as a physical inventory
-- account/item, or the owner explicitly opted into that mode. Auto mode never
-- guesses from an inventory resource merely being started.
local function usesCashAsItem()
    local configured = Config.Money and Config.Money.CashAsItem
    if configured == true then return true end
    if configured == false then return false end
    return detectedCashAsItem == true
end

local function cashItemName()
    local configured = configuredCashItemName()
    if configured then return configured end

    if type(detectedCashItemName) == 'string' and detectedCashItemName ~= '' then
        return detectedCashItemName
    end
    if detectedMoneyProvider == 'ox_inventory' then return 'money' end
    if detectedMoneyProvider == 'qb-inventory' then return 'cash' end
    return 'cash'
end

-- Read ox_inventory only after the server confirms the framework cash account is
-- actually mirrored as an inventory item. This prevents servers that use
-- ox_inventory for items but framework-native cash from being incorrectly shown
-- as $0.
---@return number|nil count, boolean answered
local function oxInventoryCash()
    if not usesCashAsItem() or GetResourceState('ox_inventory') ~= 'started' then
        return nil, false
    end

    local ok, count = pcall(function()
        return exports.ox_inventory:Search('count', cashItemName())
    end)
    if not ok then return nil, false end
    if type(count) == 'number' then return math.max(0, count), true end
    -- Search returns false rather than zero when the item is absent entirely.
    if count == false then return 0, true end
    return nil, false
end

local function countCashItems(items)
    local fromOx, answered = oxInventoryCash()
    if answered then return fromOx end

    local total = 0

    if type(items) ~= 'table' and QBCore and QBCore.Functions then
        local ok, PlayerData = pcall(function()
            return QBCore.Functions.GetPlayerData()
        end)
        if ok and PlayerData then
            items = PlayerData.items
        end
    end

    local wanted = cashItemName()
    if type(items) == 'table' then
        for _, item in pairs(items) do
            if item and type(item.name) == 'string' and item.name:lower() == wanted then
                total = total + (tonumber(item.amount) or tonumber(item.count) or 0)
            end
        end
    end

    return total
end

local playerLoaded = false

-- ============================================================
-- UTILITY FUNCTIONS
-- ============================================================
local function debug(...)
    if Config.Debug then
        print('[RS-HUDLIFE]', ...)
    end
end

RegisterNetEvent('rs-lilhudlife:client:setMoneyMode', function(cashAsItem, itemName, provider)
    detectedCashAsItem = cashAsItem == true
    detectedCashItemName = nil
    if type(itemName) == 'string' and itemName ~= '' then
        detectedCashItemName = itemName:lower()
    end
    detectedMoneyProvider = type(provider) == 'string' and provider or 'framework'
    debug(('money mode: provider=%s cashAsItem=%s item=%s'):format(
        tostring(detectedMoneyProvider), tostring(detectedCashAsItem), tostring(detectedCashItemName or cashItemName())))

    if not playerLoaded then return end

    local oxCash, oxAnswered = oxInventoryCash()
    if oxAnswered then
        moneyData.cash = oxCash
        pushMoney()
        return
    end

    if QBCore and QBCore.Functions then
        local ok, PlayerData = pcall(function() return QBCore.Functions.GetPlayerData() end)
        if ok and type(PlayerData) == 'table' then
            if usesCashAsItem() and type(PlayerData.items) == 'table' then
                moneyData.cash = math.max(0, countCashItems(PlayerData.items))
            elseif PlayerData.money and PlayerData.money.cash ~= nil then
                moneyData.cash = math.max(0, tonumber(PlayerData.money.cash) or 0)
            end
            if PlayerData.money and PlayerData.money.bank ~= nil then
                moneyData.bank = math.max(0, tonumber(PlayerData.money.bank) or 0)
            end
            pushMoney()
        end
    end
end)

AddEventHandler('onClientResourceStart', function(resource)
    if resource ~= 'qb-inventory' and resource ~= 'ox_inventory' then return end
    TriggerServerEvent('rs-lilhudlife:server:requestMoneyMode')
    if resource == 'qb-inventory' then
        SetTimeout(250, function() TriggerServerEvent('qb-inventory:server:requestCashState') end)
    end
end)

AddEventHandler('onClientResourceStop', function(resource)
    if resource ~= 'qb-inventory' and resource ~= 'ox_inventory' then return end
    detectedCashAsItem = nil
    detectedCashItemName = nil
    detectedMoneyProvider = nil
    SetTimeout(0, function() TriggerServerEvent('rs-lilhudlife:server:requestMoneyMode') end)
end)


local function sendNUI(data)
    SendNUIMessage(data)
end

local function playSound(soundKey)
    if not Config.Sound.Enabled then return end

    if Config.Sound.UseCustomSounds then
        -- Send to NUI to play from html/sounds/
        sendNUI({
            action = 'playSound',
            sound = Config.Sound.Files[soundKey],
            volume = Config.Sound.Volume
        })
    else
        -- Use native GTA sound
        local native = Config.Sound.Native[soundKey]
        if native then
            PlaySoundFrontend(-1, native.soundName, native.soundSet, true)
        end
    end
end


-- ============================================================
-- VEHICLE DETECTION
-- ============================================================
local function getVehicleData(vehicle)
    if not vehicle or vehicle == 0 then return nil end
    if not DoesEntityExist(vehicle) then return nil end

    local class = GetVehicleClass(vehicle)
    local model = GetEntityModel(vehicle)
    local displayName = GetDisplayNameFromVehicleModel(model)
    local localizedName = GetLabelText(displayName)
    if localizedName == 'NULL' then localizedName = displayName end

    -- GetEntityArchetypeName returns the actual spawn code (e.g. "baller8", "driftfr36")
    -- GetDisplayNameFromVehicleModel returns GXT label which does NOT match spawn code for DLC vehicles.
    --
    -- On GTA V Enhanced the archetype native is unreliable and can answer empty,
    -- which used to drop straight through to the GXT label -- so 'polcoquette4'
    -- was looked up as 'coquet4', found no art, and the panel fell back to a
    -- silhouette. Validate the archetype against the model hash, and when it
    -- fails ask the framework's own registry through rs_bridge before settling
    -- for the label.
    local spawnName
    local okArch, archName = pcall(GetEntityArchetypeName, vehicle)
    if okArch and type(archName) == 'string' and archName ~= '' and joaat(archName) == model then
        spawnName = archName:lower()
    end

    if not spawnName and RSHUDBridge and RSHUDBridge.GetVehicleModelName then
        spawnName = RSHUDBridge.GetVehicleModelName(model)
    end

    if not spawnName then
        spawnName = string.lower(
            (okArch and archName ~= '' and archName) or displayName or 'unknown')
    end

    -- Vehicle stats (normalized 0-100)
    local topSpeed = GetVehicleEstimatedMaxSpeed(vehicle)
    local acceleration = GetVehicleModelAcceleration(model)
    local traction = GetVehicleModelMaxTraction(model)
    local braking = GetVehicleModelMaxBraking(model)

    return {
        entity = vehicle,
        class = class,
        className = Config.ClassNames[class] or 'UNKNOWN',
        hologramType = Config.ClassHolograms[class] or 'car',
        classKey = Config.ClassHolograms[class] or 'car',
        model = model,
        spawnName = spawnName,
        name = localizedName,
        displayName = displayName,
        stats = {
            topSpeed = math.floor(topSpeed * 2.23694),
            acceleration = math.floor(acceleration * 100),
            traction = math.floor(traction * 100),
            braking = math.floor(braking * 100),
        }
    }
end

local function shouldPlayBoot(newData, oldData)
    if not Config.Boot.Enabled then return false end

    -- First vehicle of session
    if not bootPlayed and Config.Boot.PlayOnFirstEntry then
        return true
    end

    -- Different vehicle entity
    if oldData == nil or newData.entity ~= oldData.entity then
        if Config.Boot.PlayOnVehicleChange then
            return true
        end
    end

    -- Different vehicle class
    if oldData and newData.class ~= oldData.class and Config.Boot.PlayOnClassChange then
        return true
    end

    return false
end

-- ============================================================
-- BOOT SEQUENCE
-- ============================================================
-- ============================================================
-- WORLD PTFX (v1.1.3) - real GTA particle on the player's vehicle
-- during the boot reveal (default: exp_grd_grenade_smoke).
-- ============================================================
local function stopBootPtfx()
    if bootPtfxHandle then
        StopParticleFxLooped(bootPtfxHandle, false)
        bootPtfxHandle = nil
    end
end

local function cancelBootSequence()
    bootGeneration = bootGeneration + 1
    bootInProgress = false
    stopBootPtfx()
    sendNUI({ action = 'cancelBoot' })
end

local function startBootPtfx()
    local cfg = Config.Boot and Config.Boot.WorldPtfx
    if not cfg or cfg.Enabled ~= true then return end

    local veh = GetVehiclePedIsIn(PlayerPedId(), false)
    if not veh or veh == 0 then return end

    local dict = cfg.Dict or 'core'
    if not HasNamedPtfxAssetLoaded(dict) then
        RequestNamedPtfxAsset(dict)
        local waited = 0
        while not HasNamedPtfxAssetLoaded(dict) and waited < 1000 do
            Citizen.Wait(10)
            waited = waited + 10
        end
    end
    if not HasNamedPtfxAssetLoaded(dict) then
        debug('PTFX dict not loaded: ' .. dict)
        return
    end

    stopBootPtfx()
    UseParticleFxAssetNextCall(dict)

    local name  = cfg.Name or 'exp_grd_grenade_smoke'
    local scale = cfg.Scale or 1.0
    local oz    = cfg.OffsetZ or -0.6

    if cfg.Networked == true then
        bootPtfxHandle = StartNetworkedParticleFxLoopedOnEntity(name, veh, 0.0, 0.0, oz, 0.0, 0.0, 0.0, scale, false, false, false)
    else
        bootPtfxHandle = StartParticleFxLoopedOnEntity(name, veh, 0.0, 0.0, oz, 0.0, 0.0, 0.0, scale, false, false, false)
    end
end

local function playBootSequence(vehicleData)
    if hudMasterEnabled == false or not vehicleData or not vehicleData.entity then return false end

    if bootInProgress then cancelBootSequence() end

    bootGeneration = bootGeneration + 1
    local generation = bootGeneration
    local vehicle = vehicleData.entity
    bootInProgress = true
    hudActive = false

    debug('Playing boot sequence for ' .. vehicleData.name)

    sendNUI({
        action = 'playBoot',
        vehicle = vehicleData,
        timing = Config.Boot,
        particles = Config.Boot.Particles,
        scrim = Config.Boot.ScrimStrength,
        showName = Config.Boot.ShowVehicleName,
        showClass = Config.Boot.ShowVehicleClass,
        showStats = Config.Boot.ShowVehicleStats
    })

    startBootPtfx()
    playSound('boot_start')

    Citizen.SetTimeout(Config.Boot.PlatformFadeIn + Config.Boot.RingsPulse, function()
        if generation ~= bootGeneration or not bootInProgress then return end
        playSound('hologram_appear')
    end)

    local collapseTime = Config.Boot.PlatformFadeIn + Config.Boot.RingsPulse + Config.Boot.HologramRise + Config.Boot.HologramHold
    Citizen.SetTimeout(collapseTime, function()
        if generation ~= bootGeneration or not bootInProgress then return end
        playSound('hologram_collapse')
    end)

    local readyTime = collapseTime + Config.Boot.HologramCollapse + (Config.Boot.SpeedoFadeIn or 400)
    Citizen.SetTimeout(readyTime, function()
        if generation ~= bootGeneration or not bootInProgress then return end

        local ped = PlayerPedId()
        local activeVehicle = GetVehiclePedIsIn(ped, false)
        if hudMasterEnabled == false or activeVehicle ~= vehicle or currentVehicle ~= vehicle or not DoesEntityExist(vehicle) then
            cancelBootSequence()
            return
        end

        playSound('hud_ready')
        stopBootPtfx()
        bootInProgress = false
        bootPlayed = true
        hudActive = true
    end)

    return true
end

-- ============================================================
-- SPEED DATA LOOP
-- ============================================================
-- Premium vehicle diagnostics are intentionally read-only. qbx_seatbelt remains
-- the restraint authority and qbx_mechanicjob remains the mechanical-status
-- authority; HUDLife only mirrors their current state when those resources run.
local mechanicTelemetryCache = { plate = nil, at = 0, status = nil }

local function clampPercent(value, fallback)
    value = tonumber(value)
    if not value then return fallback or 100 end
    return math.max(0, math.min(100, value))
end

local function trimPlate(plate)
    return (tostring(plate or ''):gsub('^%s*(.-)%s*$', '%1'))
end

local function getMechanicTelemetry(vehicle)
    if GetResourceState('qbx_mechanicjob') ~= 'started' then return nil end

    local plate = trimPlate(GetVehicleNumberPlateText(vehicle))
    local now = GetGameTimer()
    if mechanicTelemetryCache.plate == plate and now - mechanicTelemetryCache.at < 500 then
        return mechanicTelemetryCache.status
    end

    local ok, status = pcall(function()
        return exports.qbx_mechanicjob:GetVehicleStatusList(plate)
    end)

    mechanicTelemetryCache.plate = plate
    mechanicTelemetryCache.at = now
    mechanicTelemetryCache.status = ok and type(status) == 'table' and status or nil
    return mechanicTelemetryCache.status
end

local vehicleConditionCache = { vehicle = 0, at = 0, data = nil }
local VEHICLE_CONDITION_REFRESH_MS = 250

local function getVehicleConditionTelemetry(vehicle)
    local now = GetGameTimer()
    if vehicleConditionCache.vehicle == vehicle
        and vehicleConditionCache.data
        and now - vehicleConditionCache.at < VEHICLE_CONDITION_REFRESH_MS then
        return vehicleConditionCache.data
    end

    local fuel = 100
    local fuelState = Entity(vehicle).state.fuel
    if fuelState ~= nil then
        fuel = clampPercent(fuelState, 100)
    elseif GetVehicleFuelLevel then
        fuel = clampPercent(GetVehicleFuelLevel(vehicle), 100)
    end

    local engineHealth = clampPercent(GetVehicleEngineHealth(vehicle) / 10)
    local bodyHealth = clampPercent(GetVehicleBodyHealth(vehicle) / 10)
    local mechanic = getMechanicTelemetry(vehicle)
    if mechanic then
        if mechanic.engine ~= nil then
            engineHealth = math.min(engineHealth, clampPercent(tonumber(mechanic.engine) / 10))
        end
        if mechanic.body ~= nil then
            bodyHealth = math.min(bodyHealth, clampPercent(tonumber(mechanic.body) / 10))
        end
    end

    local burstTires = 0
    for _, tireIndex in ipairs({ 0, 1, 2, 3, 4, 5, 45, 47 }) do
        if IsVehicleTyreBurst(vehicle, tireIndex, false) then
            burstTires = burstTires + 1
        end
    end

    local brokenWindows = 0
    local vehicleClass = GetVehicleClass(vehicle)
    if vehicleClass ~= 8 and vehicleClass ~= 13 and vehicleClass ~= 14
        and vehicleClass ~= 15 and vehicleClass ~= 16 then
        for windowIndex = 0, 7 do
            if not IsVehicleWindowIntact(vehicle, windowIndex) then
                brokenWindows = brokenWindows + 1
            end
        end
    end

    local damagedDoors = 0
    for doorIndex = 0, 5 do
        if IsVehicleDoorDamaged(vehicle, doorIndex) then
            damagedDoors = damagedDoors + 1
        end
    end

    local transmission = 100
    local brakes = 100
    local cooling = 100
    local fuelSystem = 100
    if mechanic then
        local clutch = clampPercent(mechanic.clutch, 100)
        local axle = clampPercent(mechanic.axle, 100)
        transmission = math.floor(((clutch + axle) / 2) + 0.5)
        brakes = clampPercent(mechanic.brakes, 100)
        cooling = clampPercent(mechanic.radiator, 100)
        fuelSystem = clampPercent(mechanic.fuel, 100)
    end

    local data = {
        fuel = math.floor(fuel + 0.5),
        engine = math.floor(engineHealth),
        body = math.floor(bodyHealth),
        burstTires = burstTires,
        brokenWindows = brokenWindows,
        damagedDoors = damagedDoors,
        tires = math.max(0, 100 - (burstTires * 25)),
        transmission = transmission,
        brakes = brakes,
        cooling = cooling,
        fuelSystem = fuelSystem,
        mechanicLinked = mechanic ~= nil,
    }

    vehicleConditionCache.vehicle = vehicle
    vehicleConditionCache.at = now
    vehicleConditionCache.data = data
    return data
end

local function getSpeedData(vehicle)
    local speedMs = GetEntitySpeed(vehicle)
    local speed = Config.Speed.Unit == 'MPH'
        and math.floor(speedMs * 2.23694)
        or math.floor(speedMs * 3.6)

    local maxSpeed = Config.Speed.Unit == 'MPH' and Config.Speed.MaxSpeed or Config.Speed.MaxSpeedKMH
    local condition = getVehicleConditionTelemetry(vehicle)

    local gear = GetVehicleCurrentGear(vehicle)
    local rpm = GetVehicleCurrentRpm(vehicle)
    -- GTA/FiveM reports gear 0 for both neutral and reverse on a number of
    -- vehicles. Track local longitudinal motion/input as a display hint only;
    -- HUDLife never writes transmission state or driving controls.
    local localVelocity = GetEntitySpeedVector(vehicle, true)
    local reverse = localVelocity.y < -0.15
        or (gear == 0 and speed <= 3 and IsControlPressed(0, 72) and not IsControlPressed(0, 71))

    local _, lightsOn, highBeams = GetVehicleLightsState(vehicle)
    local engineRunning = GetIsVehicleEngineRunning(vehicle)

    -- qbx_seatbelt publishes these statebags. Reading them keeps the HUD passive
    -- and prevents a second seatbelt controller from fighting Qbox.
    local playerState = LocalPlayer and LocalPlayer.state
    local seatbelt = playerState and playerState.seatbelt == true or false
    local harness = playerState and playerState.harness == true or false

    return {
        speed = speed,
        maxSpeed = maxSpeed,
        unit = Config.Speed.Unit,
        warnThreshold = Config.Speedo.WarningThreshold or 0.75,
        critThreshold = Config.Speedo.CriticalThreshold or 0.90,
        fuel = condition.fuel,
        engine = condition.engine,
        body = condition.body,
        gear = gear,
        reverse = reverse,
        rpm = math.floor(rpm * 100),
        vehicleName = currentVehicleInfo and currentVehicleInfo.name or '',
        spawnName = currentVehicleInfo and currentVehicleInfo.spawnName or '',
        -- The GXT model code, sent so the speedometer can widen its art search
        -- when the archetype name did not resolve. On GTA V Enhanced that
        -- native can answer empty, and the label it falls back to is not the
        -- filename the art library uses -- which is how a shipped image such as
        -- driftkeitora.png still rendered as a silhouette.
        displayName = currentVehicleInfo and currentVehicleInfo.displayName or '',
        classKey = currentVehicleInfo and currentVehicleInfo.classKey or 'car',
        burstTires = condition.burstTires,
        brokenWindows = condition.brokenWindows,
        damagedDoors = condition.damagedDoors,
        lightsOn = lightsOn == 1,
        highBeams = highBeams == 1,
        engineRunning = engineRunning == true,
        seatbelt = seatbelt,
        harness = harness,
        tires = condition.tires,
        transmission = condition.transmission,
        brakes = condition.brakes,
        cooling = condition.cooling,
        fuelSystem = condition.fuelSystem,
        mechanicLinked = condition.mechanicLinked,
    }
end

-- ============================================================
-- FRAMEWORK + UNIVERSAL HEALTH / STATUS BRIDGE
-- ============================================================
local STATUS_ALIASES = {
    hp = 'health',
    health = 'health',
    armour = 'armor',
    armor = 'armor',
    food = 'hunger',
    hunger = 'hunger',
    water = 'thirst',
    drink = 'thirst',
    thirst = 'thirst',
    stamina = 'stamina',
    stress = 'stamina',
    oxygen = 'oxygen',
    breath = 'oxygen',
    nos = 'nos',
    nitro = 'nos',
    nitrous = 'nos',
    boost = 'nos',
}

local function bridgeEnabled()
    return Config.HealthBridge == nil or Config.HealthBridge.Enabled ~= false
end

local function normalizeStatusName(key)
    if key == nil then return nil, false end
    local raw = string.lower(tostring(key))
    local normalized = STATUS_ALIASES[raw] or raw
    local invert = raw == 'stress'
    return normalized, invert
end

local function normalizeStatusValue(value, default)
    local raw = value

    if type(raw) == 'table' then
        if type(raw.getPercent) == 'function' then
            local ok, result = pcall(raw.getPercent, raw)
            if ok and result ~= nil then raw = result end
        elseif raw.percent ~= nil then
            raw = raw.percent
        elseif raw.pct ~= nil then
            raw = raw.pct
        elseif raw.value ~= nil then
            raw = raw.value
        elseif raw.val ~= nil then
            raw = raw.val
        elseif raw.amount ~= nil then
            raw = raw.amount
        elseif raw.level ~= nil then
            raw = raw.level
        end
    end

    local n = tonumber(raw)
    if n == nil then return default or 100 end

    -- Accept 0.0-1.0 payloads.
    if n > 0 and n <= 1 then
        n = n * 100
    end

    -- Accept ESX-style high values. Many status scripts store 1,000,000 as full.
    if n > 100 then
        if n <= 1000 then
            n = n / 10.0
        else
            n = n / 10000.0
        end
    end

    return math.floor(math.max(0, math.min(100, n)) + 0.5)
end

local function setStatusPercent(key, value, forceInvert)
    local normalized, aliasInvert = normalizeStatusName(key)
    if not normalized or statusData[normalized] == nil then return false end

    local pct = normalizeStatusValue(value, statusData[normalized])
    if forceInvert or aliasInvert then
        pct = 100 - pct
    end

    pct = math.floor(math.max(0, math.min(100, pct)) + 0.5)
    if statusData[normalized] ~= pct then
        statusData[normalized] = pct
        return true
    end

    return false
end

-- Native GTA values are already a true 0-100 percentage, so they must skip
-- normalizeStatusValue's fractional/ESX rescaling. Without this, a real value
-- of 1 (nearly empty) would be read as a 0.0-1.0 fraction and shown as 100.
local function setStatusExact(key, value)
    local normalized = normalizeStatusName(key)
    if not normalized or statusData[normalized] == nil then return false end

    local n = tonumber(value)
    if n == nil then return false end

    local pct = math.floor(math.max(0, math.min(100, n)) + 0.5)
    if statusData[normalized] ~= pct then
        statusData[normalized] = pct
        return true
    end

    return false
end

local function applyStatusPayload(payload, source, push)
    if push == nil then push = true end
    local changed = false

    if type(payload) == 'table' then
        for key, value in pairs(payload) do
            changed = setStatusPercent(key, value, false) or changed
        end
    elseif Config.Debug then
        debug('Ignored non-table status payload from ' .. tostring(source or 'unknown'))
    end

    if changed and push then pushStatus() end
    return changed
end

-- Resolves the framework facade used for player data, money and job.
-- rs_bridge is preferred, then QB compatibility, native Qbox, direct ESX,
-- and finally standalone. Detection is capability-based rather than tied to
-- one framework resource name.
local function normalizeESXPlayerData(data)
    data = type(data) == 'table' and data or {}
    local cash = tonumber(data.money) or 0
    local bank = 0

    if type(data.accounts) == 'table' then
        for _, account in pairs(data.accounts) do
            if type(account) == 'table' then
                local name = tostring(account.name or ''):lower()
                local amount = tonumber(account.money or account.amount) or 0
                if name == 'money' or name == 'cash' then cash = amount end
                if name == 'bank' then bank = amount end
            end
        end
    end

    return {
        money = { cash = cash, bank = bank },
        job = data.job or {},
        metadata = data.metadata or {},
        items = data.inventory or {},
    }
end

local function jobGradeLabel(job)
    if type(job) ~= 'table' then return '' end

    local grade = job.grade
    if type(grade) == 'table' then
        return tostring(grade.label or grade.name or grade.level or '')
    end

    return tostring(job.grade_label or job.grade_name or grade or '')
end

local function initQBCoreOnce()
    if QBCore then return true end

    local requested = string.lower(tostring(Config.Framework or 'auto'))
    if requested == 'standalone' then
        detectedFramework = 'standalone'
        return false
    end

    -- Preferred path: rs_bridge already normalizes Qbox, QBCore and ESX.
    if requested == 'auto' or requested == 'qbox' or requested == 'qbcore' or requested == 'esx' then
        local framework = RSHUDBridge and RSHUDBridge.Framework()
        if framework and (requested == 'auto' or requested == framework) then
            QBCore = RSHUDBridge.Core
            detectedFramework = framework
            debug(('framework resolved via rs_bridge: %s'):format(framework))
            return true
        end
    end

    -- Qbox deliberately has no resource folder named `qb-core`, but its QB bridge
    -- still provides exports['qb-core']:GetCoreObject(). Therefore do not gate this
    -- call on GetResourceState('qb-core') -- pcall is the correct feature test.
    if requested == 'auto' or requested == 'qbox' or requested == 'qbcore' then
        local ok, core = pcall(function()
            return exports['qb-core']:GetCoreObject()
        end)

        if ok and core then
            QBCore = core
            detectedFramework = GetResourceState('qbx_core') == 'started' and 'qbox' or 'qbcore'
            if requested == 'auto' or requested == detectedFramework then
                debug(('%s initialized through QB compatibility export'):format(detectedFramework))
                return true
            end
            QBCore = nil
        end
    end

    -- Native Qbox fallback for servers that intentionally disable the QB
    -- compatibility bridge. qbx_core exposes GetPlayerData/Notify directly and
    -- continues to emit the documented QBCore money/job events.
    if requested == 'auto' or requested == 'qbox' then
        if GetResourceState('qbx_core') == 'started' then
            local okData, playerData = pcall(function() return exports.qbx_core:GetPlayerData() end)
            if okData and type(playerData) == 'table' then
                QBCore = {
                    Functions = {
                        GetPlayerData = function()
                            local ok, data = pcall(function() return exports.qbx_core:GetPlayerData() end)
                            return ok and data or {}
                        end,
                        Notify = function(message, notifyType, duration)
                            local ok = pcall(function()
                                exports.qbx_core:Notify(message, notifyType, duration)
                            end)
                            return ok
                        end,
                    }
                }
                detectedFramework = 'qbox'
                debug('Qbox initialized through native qbx_core exports')
                return true
            end
        end
    end

    -- Direct ESX fallback so rs_bridge is optional rather than secretly required.
    if requested == 'auto' or requested == 'esx' then
        if GetResourceState('es_extended') == 'started' then
            local ok, ESX = pcall(function() return exports['es_extended']:getSharedObject() end)
            if ok and ESX then
                QBCore = {
                    Functions = {
                        GetPlayerData = function()
                            local okData, data = pcall(function() return ESX.GetPlayerData() end)
                            return normalizeESXPlayerData(okData and data or {})
                        end,
                        TriggerCallback = function(name, cb, ...)
                            return ESX.TriggerServerCallback(name, cb, ...)
                        end,
                        Notify = function(message, notifyType, duration)
                            if ESX.ShowNotification then
                                ESX.ShowNotification(message, notifyType, duration)
                                return true
                            end
                            return false
                        end,
                    }
                }
                detectedFramework = 'esx'
                debug('ESX initialized directly')
                return true
            end
        end
    end

    return false
end

local FRAMEWORK_RESOURCES = {
    rs_bridge = true,
    ['qb-core'] = true,
    qbx_core = true,
    es_extended = true,
}
local frameworkRefreshQueued = false

local function queueFrameworkRefresh()
    if frameworkRefreshQueued then return end
    frameworkRefreshQueued = true

    SetTimeout(250, function()
        frameworkRefreshQueued = false
        QBCore = nil
        detectedFramework = 'standalone'

        if initQBCoreOnce() and onPlayerLoaded then
            local ok, data = pcall(function() return QBCore.Functions.GetPlayerData() end)
            onPlayerLoaded(ok and data or {})
        end
    end)
end

-- Framework/bridge resources are optional, so no hard dependency belongs in
-- fxmanifest.lua. Re-resolve the provider when one starts/stops instead of
-- requiring a HUD restart after framework maintenance.
AddEventHandler('onClientResourceStart', function(resource)
    if FRAMEWORK_RESOURCES[resource] then queueFrameworkRefresh() end
end)

AddEventHandler('onClientResourceStop', function(resource)
    if FRAMEWORK_RESOURCES[resource] then queueFrameworkRefresh() end
end)

local function pullNativeStatus(push)
    if not bridgeEnabled() then return false end
    local hb = Config.HealthBridge or {}
    local native = hb.Native or {}
    if native.Enabled == false then return false end

    local ped = PlayerPedId()
    if not ped or ped == 0 then return false end

    local changed = false

    if native.Health ~= false then
        local rawHealth = GetEntityHealth(ped) or 0
        local maxHealth = GetEntityMaxHealth(ped) or 200
        local health = 0

        -- GTA peds commonly use 100-200 as alive health. This also handles
        -- custom max-health scripts cleanly instead of hard-locking to 200.
        if maxHealth > 100 then
            health = ((rawHealth - 100) / (maxHealth - 100)) * 100
        elseif maxHealth > 0 then
            health = (rawHealth / maxHealth) * 100
        end

        -- Down or dead outranks whatever the entity says. qbx_medical parks
        -- the ped at full health during death so GTA will not respawn it, so
        -- without this the ring reads 100% while the player bleeds out.
        if RSHUDBridge and RSHUDBridge.IsPlayerDownOrDead and RSHUDBridge.IsPlayerDownOrDead() then
            health = 0
        end

        changed = setStatusExact('health', health) or changed
    end

    if native.Armor ~= false then
        changed = setStatusExact('armor', GetPedArmour(ped) or 0) or changed
    end

    if native.Stamina ~= false then
        -- GetPlayerSprintStaminaRemaining returns depleted amount (0 = full,
        -- 100 = exhausted), so invert it to show remaining stamina.
        local depleted = GetPlayerSprintStaminaRemaining(PlayerId()) or 0.0
        changed = setStatusExact('stamina', 100.0 - depleted) or changed
    end

    if native.Oxygen ~= false then
        local underwater = IsPedSwimmingUnderWater(ped)
        local oxygen = 100

        if underwater and type(GetPlayerUnderwaterTimeRemaining) == 'function' then
            local remaining = GetPlayerUnderwaterTimeRemaining(PlayerId()) or 0.0
            oxygen = (remaining / 10.0) * 100
        end

        changed = setStatusExact('oxygen', oxygen) or changed
        if statusData.showOxygen ~= underwater then
            statusData.showOxygen = underwater
            changed = true
        end
    end

    if push and changed then pushStatus() end
    return changed
end

local function pullQBCoreStatus(push)
    if not bridgeEnabled() then return false end
    local hb = Config.HealthBridge or {}
    local qbc = hb.QBCore or {}
    if qbc.Enabled == false then return false end
    if not QBCore then return false end

    local ok, PlayerData = pcall(function()
        return QBCore.Functions.GetPlayerData()
    end)
    if not ok or not PlayerData or not PlayerData.metadata then return false end

    local meta = PlayerData.metadata
    local keys = qbc.Metadata or {}
    local changed = false

    if keys.hunger and meta[keys.hunger] ~= nil then
        changed = setStatusPercent('hunger', meta[keys.hunger], false) or changed
    end
    if keys.thirst and meta[keys.thirst] ~= nil then
        changed = setStatusPercent('thirst', meta[keys.thirst], false) or changed
    end
    if qbc.StaminaFromStress and keys.stress and meta[keys.stress] ~= nil then
        changed = setStatusPercent('stress', meta[keys.stress], true) or changed
    end
    if keys.nos and meta[keys.nos] ~= nil then
        changed = setStatusPercent('nos', meta[keys.nos], false) or changed
    end

    if push and changed then pushStatus() end
    return changed
end

local function pullStateBagStatus(push)
    if not bridgeEnabled() then return false end
    local hb = Config.HealthBridge or {}
    local cfg = hb.StateBags or {}
    if cfg.Enabled == false then return false end
    if not LocalPlayer or not LocalPlayer.state then return false end

    local keys = cfg.Keys or {}
    local invert = cfg.Invert or {}
    local changed = false

    for status, stateKey in pairs(keys) do
        if stateKey and stateKey ~= '' then
            local value = LocalPlayer.state[stateKey]
            if value ~= nil then
                changed = setStatusPercent(status, value, invert[status] == true) or changed
            end
        end
    end

    if push and changed then pushStatus() end
    return changed
end

local function callStatusExport(resource, fnName)
    if not resource or resource == '' or not fnName or fnName == '' then return false, nil end
    if GetResourceState(resource) ~= 'started' then return false, nil end

    local ok, result = pcall(function()
        return exports[resource][fnName]()
    end)

    return ok, result
end

local function pullExportStatus(push)
    if not bridgeEnabled() then return false end
    local hb = Config.HealthBridge or {}
    local cfg = hb.Exports or {}
    if cfg.Enabled ~= true then return false end

    local resource = cfg.Resource or ''
    local changed = false

    if cfg.PayloadFunction and cfg.PayloadFunction ~= '' then
        local ok, payload = callStatusExport(resource, cfg.PayloadFunction)
        if ok and type(payload) == 'table' then
            -- Defer the NUI push; refreshAllStatusSources/pushExportStatus pushes once at the end.
            changed = applyStatusPayload(payload, 'export:' .. resource, false) or changed
        end
    end

    local fns = cfg.Functions or {}
    for status, fnName in pairs(fns) do
        if fnName and fnName ~= '' then
            local ok, value = callStatusExport(resource, fnName)
            if ok and value ~= nil then
                changed = setStatusPercent(status, value, false) or changed
            end
        end
    end

    if push and changed then pushStatus() end
    return changed
end

local function normalizeNosValue(value)
    local raw = value

    if type(raw) == 'boolean' then
        return raw and 100 or 0
    end

    if type(raw) == 'table' then
        local current = raw.current or raw.amount or raw.level or raw.charge or raw.fuel or
            raw.remaining or raw.value or raw.percent or raw.pct or raw.val
        local maximum = raw.max or raw.maximum or raw.capacity or raw.maxAmount or
            raw.max_amount or raw.maxLevel or raw.max_level

        if tonumber(current) and tonumber(maximum) and tonumber(maximum) > 0 then
            return math.max(0, math.min(100, (tonumber(current) / tonumber(maximum)) * 100))
        end

        raw = current
    end

    return normalizeStatusValue(raw, nil)
end

local function pullVehicleNosStatus(vehicle, push)
    local cfg = Config.NOSBridge or {}
    if cfg.Enabled == false or not vehicle or vehicle == 0 or not DoesEntityExist(vehicle) then
        return false
    end

    local found = nil

    if type(Entity) == 'function' then
        local ok, entityRef = pcall(Entity, vehicle)
        if ok and entityRef and entityRef.state then
            for _, key in ipairs(cfg.VehicleStateKeys or {}) do
                local stateOk, value = pcall(function() return entityRef.state[key] end)
                if stateOk and value ~= nil then
                    found = value
                    break
                end
            end
        end
    end

    if found == nil and LocalPlayer and LocalPlayer.state then
        for _, key in ipairs(cfg.PlayerStateKeys or {}) do
            local stateOk, value = pcall(function() return LocalPlayer.state[key] end)
            if stateOk and value ~= nil then
                found = value
                break
            end
        end
    end

    if found == nil then
        for _, key in ipairs(cfg.Decorators or {}) do
            local existsOk, exists = pcall(DecorExistOn, vehicle, key)
            if existsOk and exists then
                local okFloat, floatValue = pcall(DecorGetFloat, vehicle, key)
                if okFloat and floatValue ~= nil then
                    found = floatValue
                    break
                end
                local okInt, intValue = pcall(DecorGetInt, vehicle, key)
                if okInt and intValue ~= nil then
                    found = intValue
                    break
                end
            end
        end
    end

    if found == nil then return false end
    local percent = normalizeNosValue(found)
    if percent == nil then return false end
    local changed = setStatusExact('nos', percent)
    if push and changed then pushStatus() end
    return changed
end


local function trimVehiclePlate(value)
    return (tostring(value or ''):gsub('^%s*(.-)%s*$', '%1'))
end

local function findNosPlateEntry(vehicles, wantedPlate)
    if type(vehicles) ~= 'table' then return nil end

    local direct = vehicles[wantedPlate]
    if direct ~= nil then return direct end

    local wanted = string.upper(trimVehiclePlate(wantedPlate))
    for plateKey, entry in pairs(vehicles) do
        if string.upper(trimVehiclePlate(plateKey)) == wanted then
            return entry
        end
    end

    return nil
end

-- Official qb-mechanicjob keeps NOS in its own server-side nitrousVehicles table.
-- It does not publish that level through a vehicle state bag or decorator, so the
-- generic bridge cannot discover it. Query its public QBCore callback on entry and
-- at a slow interval, while the live hud:client:UpdateNitrous event handles usage.
local function pullQbMechanicNosStatus(vehicle, push, force)
    local bridge = Config.NOSBridge or {}
    local cfg = bridge.QbMechanicjob or {}
    if bridge.Enabled == false or cfg.Enabled == false then return false end
    if not vehicle or vehicle == 0 or not DoesEntityExist(vehicle) then return false end

    local resourceName = cfg.Resource or 'qb-mechanicjob'
    if GetResourceState(resourceName) ~= 'started' then return false end
    if not QBCore and not initQBCoreOnce() then return false end
    if not QBCore or not QBCore.Functions or type(QBCore.Functions.TriggerCallback) ~= 'function' then
        return false
    end

    local now = GetGameTimer()
    local pollInterval = tonumber(cfg.PollInterval) or 1500
    if qbMechanicNosPollPending then return false end
    if not force and (now - qbMechanicNosLastPoll) < pollInterval then return false end

    local plate = trimVehiclePlate(GetVehicleNumberPlateText(vehicle))
    if plate == '' then return false end

    qbMechanicNosLastPoll = now
    qbMechanicNosPollPending = true
    qbMechanicNosRequestId = qbMechanicNosRequestId + 1
    local requestId = qbMechanicNosRequestId

    local callbackTimeout = math.max(1000, tonumber(cfg.CallbackTimeout) or 4000)
    SetTimeout(callbackTimeout, function()
        if qbMechanicNosPollPending and qbMechanicNosRequestId == requestId then
            qbMechanicNosPollPending = false
            debug(('qb-mechanicjob NOS callback timed out after %dms; polling released'):format(callbackTimeout))
        end
    end)

    local callbackName = cfg.Callback or 'qb-mechanicjob:server:getnitrousVehicles'
    local ok = pcall(function()
        QBCore.Functions.TriggerCallback(callbackName, function(vehicles)
            if requestId ~= qbMechanicNosRequestId then return end
            qbMechanicNosPollPending = false

            local activeVehicle = GetVehiclePedIsIn(PlayerPedId(), false)
            if activeVehicle ~= vehicle or not DoesEntityExist(vehicle) then return end

            local entry = findNosPlateEntry(vehicles, plate)
            if entry == nil then return end
            local value = 0

            if type(entry) == 'table' then
                local hasNitro = entry.hasnitro
                if hasNitro == nil then hasNitro = entry.hasNitro end
                if hasNitro == nil then hasNitro = entry.installed end

                if hasNitro == false or tonumber(hasNitro) == 0 then
                    value = 0
                else
                    value = entry.level or entry.amount or entry.current or entry.charge or
                        entry.remaining or entry.value or entry.percent or entry.pct or 0
                end
            elseif entry ~= nil then
                value = entry
            end

            local percent = normalizeNosValue(value)
            if percent ~= nil and setStatusExact('nos', percent) and push then
                pushStatus()
            end
        end)
    end)

    if not ok then
        if qbMechanicNosRequestId == requestId then qbMechanicNosPollPending = false end
        return false
    end

    return true
end


-- RS LS Customs / RS Zombie LS Customs have their own built-in NOS entitlement.
-- Their NOS is not qb-mechanicjob's server table, so the HUD must read the
-- exports/special-parts payload that already exists on the installed vehicle.
local function decodeNosTable(value)
    if type(value) == 'table' then return value end
    if type(value) ~= 'string' or value == '' or not json or type(json.decode) ~= 'function' then
        return nil
    end

    local ok, decoded = pcall(json.decode, value)
    if ok and type(decoded) == 'table' then return decoded end
    return nil
end

local function extractRSCustomsNosValue(value, depth)
    depth = tonumber(depth) or 0
    if depth > 4 or value == nil then return nil end

    if type(value) == 'boolean' then
        return value and 100 or 0
    end

    if type(value) == 'number' then
        return normalizeNosValue(value)
    end

    local data = decodeNosTable(value)
    if not data then return nil end

    -- Prefer an actual live amount/percentage when a newer build provides one.
    local levelKeys = {
        'nosLevel', 'nos_level', 'nitroLevel', 'nitro_level',
        'nitrousLevel', 'nitrous_level', 'nosAmount', 'nos_amount',
        'nitroAmount', 'nitro_amount', 'nitrousAmount', 'nitrous_amount',
        'charge', 'remaining', 'percent', 'pct'
    }
    for _, key in ipairs(levelKeys) do
        if data[key] ~= nil then
            local percent = normalizeNosValue(data[key])
            if percent ~= nil then return percent end
        end
    end

    -- Current RS Customs stores NOS as an installed/refillable special-part
    -- entitlement. There is no separate consumable tank amount, so installed
    -- means the HUD should show a full NOS bottle instead of a false 0%.
    local installedKeys = {
        'nitrous', 'nos', 'nitro', 'hasNitrous', 'has_nitrous',
        'hasNitro', 'has_nitro', 'nitrousInstalled', 'nitrous_installed',
        'nosInstalled', 'nos_installed'
    }
    for _, key in ipairs(installedKeys) do
        local candidate = data[key]
        if candidate ~= nil then
            if type(candidate) == 'table' or type(candidate) == 'string' then
                local nested = extractRSCustomsNosValue(candidate, depth + 1)
                if nested ~= nil then return nested end
            end
            if type(candidate) == 'boolean' then return candidate and 100 or 0 end
            if tonumber(candidate) ~= nil then return tonumber(candidate) ~= 0 and 100 or 0 end
        end
    end

    local nestedKeys = {
        'rsSpecialParts', 'specialParts', 'special_parts',
        'parts', 'vehicleParts', 'vehicle_parts', 'properties', 'props'
    }
    for _, key in ipairs(nestedKeys) do
        if data[key] ~= nil then
            local nested = extractRSCustomsNosValue(data[key], depth + 1)
            if nested ~= nil then return nested end
        end
    end

    return nil
end

local function callVehicleExport(resourceName, exportName, vehicle)
    if not resourceName or resourceName == '' or not exportName or exportName == '' then
        return false, nil
    end
    if GetResourceState(resourceName) ~= 'started' then return false, nil end

    local ok, result = pcall(function()
        -- exports[a][b](x) drops x: FiveM hands back function(self, ...) and
        -- discards self, so the first real argument is eaten. Pass the export
        -- table explicitly, exactly as the colon form does.
        local ex = exports[resourceName]
        return ex[exportName](ex, vehicle)
    end)
    return ok, result
end

-- ============================================================
-- SELF-CONTAINED NOS BURN SIMULATION
--
-- Most NOS scripts - including the RS Customs baseline - treat the
-- bottle as an ENTITLEMENT ("this car has NOS") rather than a metered
-- tank. They only ever answer true/false, so a HUD bound to them sits
-- at 100% forever and never drains.
--
-- When that is all we can read, the HUD derives the charge itself by
-- watching the same boost input the NOS script watches. No exports to
-- add, no other resource to edit, nothing for a server owner to wire
-- up: it just works. If a NOS script DOES publish a real level, that
-- always wins and this is never used.
-- ============================================================
local nosSim = { activeSince = 0, cooldownUntil = 0, vehicle = 0, level = 100 }
local nosSimActive = false   -- true while the HUD is deriving the level itself

-- ============================================================
-- AUTO-DISCOVERY + AUTO-CALIBRATION
--
-- Rather than hard-coding which customs resource a server runs, or
-- asking the owner to copy timing numbers into two places, the HUD
-- finds the NOS provider itself and reads that provider's OWN config
-- at runtime. Whatever burst/cooldown/key the server actually uses is
-- what the ring drains at.
--
-- Works for rs-lscustoms, rs-zombielscustoms, or anyone else's script
-- with no configuration. If nothing is found it quietly falls back to
-- the values in Config.NOSBridge.Simulate.
-- ============================================================
local nosCalib = { done = false, maxBurst = nil, cooldown = nil, control = nil, requireAccel = nil, source = nil }

-- Config file names commonly used by customs / nitrous resources.
local NOS_CONFIG_FILES = {
    'Customize.lua', 'config.lua', 'Config.lua', 'configuration.lua',
    'shared/config.lua', 'config/config.lua', 'configs/config.lua', 'shared/Config.lua'
}

-- Name fragments that suggest a resource might provide NOS.
local NOS_NAME_HINTS = { 'custom', 'nos', 'nitro', 'tuner', 'mechanic', 'garage', 'performance' }

local function looksLikeNosResource(name)
    local lower = string.lower(name or '')
    for _, hint in ipairs(NOS_NAME_HINTS) do
        if string.find(lower, hint, 1, true) then return true end
    end
    return false
end

-- Every started resource that might own the NOS implementation, with the
-- explicitly configured ones checked first.
local function candidateNosResources()
    local cfg = (Config.NOSBridge and Config.NOSBridge.RSCustoms) or {}
    local seen, list = {}, {}

    for _, name in ipairs(cfg.Resources or {}) do
        if name and not seen[name] then seen[name] = true; list[#list + 1] = name end
    end

    local total = GetNumResources and GetNumResources() or 0
    for i = 0, total - 1 do
        local name = GetResourceByFindIndex(i)
        if name and not seen[name] and GetResourceState(name) == 'started' and looksLikeNosResource(name) then
            seen[name] = true
            list[#list + 1] = name
        end
    end

    return list
end

-- Pull real timings out of a provider's config file.
local function calibrateNosFrom(resourceName)
    if not resourceName or GetResourceState(resourceName) ~= 'started' then return false end

    for _, file in ipairs(NOS_CONFIG_FILES) do
        local ok, contents = pcall(LoadResourceFile, resourceName, file)
        if ok and type(contents) == 'string' and #contents > 0 then
            -- Scope to a Nitrous/NOS block so unrelated numbers elsewhere in the
            -- file can never be mistaken for boost timings.
            local block = contents:match('[Nn]itrous%s*=%s*%b{}')
                       or contents:match('NOS%s*=%s*%b{}')
                       or contents:match('[Nn]itro%s*=%s*%b{}')

            if block then
                local burst = tonumber(block:match('MaxBurstMs%s*=%s*(%d+)'))
                            or tonumber(block:match('BurstMs%s*=%s*(%d+)'))
                            or tonumber(block:match('Duration%s*=%s*(%d+)'))
                local cool  = tonumber(block:match('CooldownMs%s*=%s*(%d+)'))
                            or tonumber(block:match('RefillMs%s*=%s*(%d+)'))
                            or tonumber(block:match('Cooldown%s*=%s*(%d+)'))
                local ctrl  = tonumber(block:match('Control%s*=%s*(%d+)'))
                            or tonumber(block:match('Key%s*=%s*(%d+)'))
                local accel = block:match('RequireAccelerate%s*=%s*(%a+)')

                if burst or cool or ctrl then
                    nosCalib.maxBurst = burst
                    nosCalib.cooldown = cool
                    nosCalib.control  = ctrl
                    if accel then nosCalib.requireAccel = (accel == 'true') end
                    nosCalib.source = resourceName .. '/' .. file
                    debug(('NOS timings calibrated from %s (burst=%s cooldown=%s control=%s)')
                        :format(nosCalib.source, tostring(burst), tostring(cool), tostring(ctrl)))
                    return true
                end
            end
        end
    end

    return false
end

local function ensureNosCalibrated()
    if nosCalib.done then return end
    nosCalib.done = true

    if Config.NOSBridge and Config.NOSBridge.Simulate
        and Config.NOSBridge.Simulate.AutoCalibrate == false then
        return
    end

    for _, name in ipairs(candidateNosResources()) do
        if calibrateNosFrom(name) then return end
    end

    debug('No NOS config found to calibrate from; using Config.NOSBridge.Simulate values')
end

local function simulateNosLevel(vehicle)
    local bridge = Config.NOSBridge or {}
    local cfg = bridge.Simulate or {}
    if bridge.Enabled == false or cfg.Enabled == false then return nil end
    if not vehicle or vehicle == 0 then return nil end

    local now = GetGameTimer()

    -- Changing vehicle refills the bottle.
    if nosSim.vehicle ~= vehicle then
        nosSim.vehicle = vehicle
        nosSim.activeSince, nosSim.cooldownUntil = 0, 0
        nosSim.level = 100
    end

    -- Timings read from the server's own NOS script win over the config
    -- defaults, so the drain always matches the real boost.
    ensureNosCalibrated()

    local maxBurst   = nosCalib.maxBurst or tonumber(cfg.MaxBurstMs) or 4500
    local cooldownMs = nosCalib.cooldown or tonumber(cfg.CooldownMs) or 2500
    local control    = nosCalib.control  or tonumber(cfg.Control)    or 21

    local requireAccel = cfg.RequireAccelerate ~= false
    if nosCalib.requireAccel ~= nil then requireAccel = nosCalib.requireAccel end

    local ped = PlayerPedId()
    local isDriver = GetPedInVehicleSeat(vehicle, -1) == ped
    local pressed = isDriver and IsControlPressed(0, control)
    if requireAccel then
        pressed = pressed and IsControlPressed(0, 71)
    end

    if now < (nosSim.cooldownUntil or 0) then
        -- Refilling after a spent bottle.
        local remaining = nosSim.cooldownUntil - now
        nosSim.level = 100.0 - ((remaining / cooldownMs) * 100.0)
    elseif pressed then
        if nosSim.activeSince == 0 then nosSim.activeSince = now end
        local elapsed = now - nosSim.activeSince
        if elapsed <= maxBurst then
            nosSim.level = 100.0 - ((elapsed / maxBurst) * 100.0)
        else
            nosSim.cooldownUntil = now + cooldownMs
            nosSim.activeSince = 0
            nosSim.level = 0
        end
    else
        -- Released before burning out: bottle is ready again.
        nosSim.activeSince = 0
        nosSim.level = 100
    end

    return math.max(0, math.min(100, math.floor(nosSim.level + 0.5)))
end

local function pullRSCustomsNosStatus(vehicle, push, force)
    local bridge = Config.NOSBridge or {}
    local cfg = bridge.RSCustoms or {}
    if bridge.Enabled == false or cfg.Enabled == false then return false end
    if not vehicle or vehicle == 0 or not DoesEntityExist(vehicle) then return false end

    local now = GetGameTimer()
    local pollInterval = tonumber(cfg.PollInterval) or 750
    if not force and rsCustomsNosHandled and (now - rsCustomsNosLastPoll) < pollInterval then
        return true
    end

    local resources = cfg.Resources or { 'rs-lscustoms', 'rs-zombielscustoms' }
    local installedPercent = tonumber(cfg.InstalledPercent) or 100

    for _, resourceName in ipairs(resources) do
        if GetResourceState(resourceName) == 'started' then
            rsCustomsNosLastPoll = now
            local percent = nil

            -- Newer/custom builds may expose a real charge value.
            for _, exportName in ipairs(cfg.LevelExports or {
                'GetNitrousLevel', 'GetNOSLevel', 'GetNosLevel', 'GetNitroLevel'
            }) do
                local ok, value = callVehicleExport(resourceName, exportName, vehicle)
                if ok and value ~= nil then
                    percent = normalizeNosValue(value)
                    if percent ~= nil then nosSimActive = false break end
                end
            end

            -- Accepted RS Customs baseline export. This only reports whether a
            -- bottle is INSTALLED, so on its own the ring would sit at 100%.
            -- Derive the live charge locally instead.
            if percent == nil then
                local ok, installed = callVehicleExport(resourceName, cfg.HasExport or 'HasNitrous', vehicle)
                if ok and installed ~= nil then
                    if type(installed) == 'boolean' then
                        if installed then
                            percent = simulateNosLevel(vehicle) or installedPercent
                            nosSimActive = percent ~= nil
                        else
                            percent = 0
                            nosSimActive = false
                        end
                    else
                        local parsed = extractRSCustomsNosValue(installed, 0)
                        if parsed ~= nil then percent = parsed end
                    end
                end
            end

            -- Fallback to the exact persisted special-part payload.
            if percent == nil then
                local ok, parts = callVehicleExport(resourceName, cfg.SpecialPartsExport or 'GetSpecialParts', vehicle)
                if ok and parts ~= nil then
                    local parsed = extractRSCustomsNosValue(parts, 0)
                    if parsed ~= nil then percent = parsed end
                end
            end

            if percent == nil then
                local ok, props = callVehicleExport(resourceName, cfg.PropertiesExport or 'GetVehicleProperties', vehicle)
                if ok and props ~= nil then
                    local parsed = extractRSCustomsNosValue(props, 0)
                    if parsed ~= nil then percent = parsed end
                end
            end

            -- Some builds replicate the special parts directly on the entity.
            if percent == nil and type(Entity) == 'function' then
                local ok, entityRef = pcall(Entity, vehicle)
                if ok and entityRef and entityRef.state then
                    for _, key in ipairs(cfg.StateKeys or {
                        'rsSpecialParts', 'rs_special_parts',
                        'rs_lscustoms_special_parts', 'rs_zombielscustoms_special_parts',
                        'rs_lscustoms_nitrous', 'rs_zombielscustoms_nitrous'
                    }) do
                        local stateOk, stateValue = pcall(function() return entityRef.state[key] end)
                        if stateOk and stateValue ~= nil then
                            local parsed = extractRSCustomsNosValue(stateValue, 0)
                            if parsed ~= nil then percent = parsed break end
                        end
                    end
                end
            end

            if percent ~= nil then
                percent = math.max(0, math.min(100, percent))
                local changed = setStatusExact('nos', percent)
                rsCustomsNosHandled = true
                if push and changed then pushStatus() end
                return true
            end

            -- This resource name is active but did not expose readable NOS data.
            -- Continue in case the renamed RS Zombie LS Customs resource is also
            -- present, then fall back to another configured NOS provider.
        end
    end

    rsCustomsNosHandled = false
    return false
end

-- ============================================================
-- FAST NOS TICK
-- The status bridge polls slowly (hundreds of ms) because framework
-- reads are expensive. A NOS burn lasts only a few seconds, so at that
-- cadence the ring looks frozen. While we are deriving the level
-- ourselves the maths is local and cheap, so run it fast and push only
-- when the value actually changes.
-- ============================================================
CreateThread(function()
    while true do
        local wait = 250

        if playerLoaded and nosSimActive and (Config.NOSBridge or {}).Enabled ~= false then
            local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
            if vehicle and vehicle ~= 0 then
                wait = 60
                local level = simulateNosLevel(vehicle)
                if level ~= nil and setStatusExact('nos', level) then
                    pushStatus()
                end
            else
                nosSimActive = false
            end
        elseif (Config.NOSBridge or {}).Enabled == false then
            nosSimActive = false
            nosSim.activeSince, nosSim.cooldownUntil = 0, 0
        end

        Wait(wait)
    end
end)

-- ============================================================
-- /nosdebug - tells a server owner exactly what the NOS ring is
-- reading and where the timings came from, so nobody has to guess.
-- ============================================================
RegisterCommand('nosdebug', function()
    ensureNosCalibrated()

    local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
    local cfg = (Config.NOSBridge and Config.NOSBridge.Simulate) or {}

    print('^5[RS-HUDLIFE] ===== NOS DIAGNOSTIC =====^7')
    print(('  In vehicle          : %s'):format(vehicle ~= 0 and 'yes' or 'no'))
    print(('  Current NOS reading : %s%%'):format(tostring(statusData.nos)))

    if nosSimActive then
        print('  Source              : HUD is deriving the level (your NOS script reports installed-only)')
    else
        print('  Source              : your NOS script is reporting a real level directly')
    end

    if nosCalib.source then
        print(('  Timings from        : %s'):format(nosCalib.source))
    else
        print('  Timings from        : config.lua fallback (no NOS config file found)')
    end

    print(('  Burst / Cooldown    : %sms / %sms'):format(
        tostring(nosCalib.maxBurst or cfg.MaxBurstMs or 4500),
        tostring(nosCalib.cooldown or cfg.CooldownMs or 2500)))
    print(('  Boost key (control) : %s'):format(tostring(nosCalib.control or cfg.Control or 21)))

    local names = candidateNosResources()
    print(('  Candidate resources : %s'):format(#names > 0 and table.concat(names, ', ') or 'none found'))

    if vehicle ~= 0 then
        for _, name in ipairs(names) do
            if GetResourceState(name) == 'started' then
                local ok, has = callVehicleExport(name, 'HasNitrous', vehicle)
                if ok and has ~= nil then
                    print(('    %s:HasNitrous -> %s'):format(name, tostring(has)))
                end
            end
        end
    end
    print('^5[RS-HUDLIFE] =========================^7')
end, false)

local function refreshAllStatusSources(push)
    local changed = false

    changed = pullNativeStatus(false) or changed
    changed = pullQBCoreStatus(false) or changed
    changed = pullStateBagStatus(false) or changed
    changed = pullExportStatus(false) or changed

    local activeVehicle = GetVehiclePedIsIn(PlayerPedId(), false)
    if activeVehicle and activeVehicle ~= 0 then
        local handledByRSCustoms = pullRSCustomsNosStatus(activeVehicle, push, false)
        if not handledByRSCustoms then
            changed = pullVehicleNosStatus(activeVehicle, false) or changed
        end
    end

    if push and changed then pushStatus() end
    return changed
end

local function handleESXStatusTick(statusList)
    if not bridgeEnabled() then return end
    local hb = Config.HealthBridge or {}
    local cfg = hb.ESXStatus or {}
    if cfg.Enabled == false then return end
    if type(statusList) ~= 'table' then return end

    local names = cfg.StatusNames or {}
    local changed = false

    for _, entry in pairs(statusList) do
        local statusName = nil
        local statusValue = entry

        if type(entry) == 'table' then
            statusName = entry.name or entry.label
            if not statusName and type(entry.getName) == 'function' then
                local ok, result = pcall(entry.getName, entry)
                if ok then statusName = result end
            end

            if entry.percent ~= nil then statusValue = entry.percent
            elseif entry.val ~= nil then statusValue = entry.val
            elseif entry.value ~= nil then statusValue = entry.value
            end
        end

        if statusName then
            local lowerName = string.lower(tostring(statusName))
            for hudKey, esxName in pairs(names) do
                if esxName and lowerName == string.lower(tostring(esxName)) then
                    changed = setStatusPercent(hudKey, statusValue, hudKey == 'stress') or changed
                end
            end
        end
    end

    if changed then pushStatus() end
end

local function delayedStatusRefresh(delay)
    SetTimeout(delay or 250, function()
        refreshAllStatusSources(true)
    end)
end

local function registerStatusBridgeEvents()
    local hb = Config.HealthBridge or {}
    local events = hb.Events or {}

    RegisterNetEvent(events.SetStatus or 'rs-lilhudlife:client:SetStatus', function(payloadOrKey, value)
        if type(payloadOrKey) == 'table' then
            applyStatusPayload(payloadOrKey, 'event')
        elseif payloadOrKey ~= nil then
            applyStatusPayload({ [payloadOrKey] = value }, 'event')
        end
    end)

    RegisterNetEvent(events.SetNeeds or 'rs-lilhudlife:client:SetNeeds', function(hunger, thirst)
        applyStatusPayload({ hunger = hunger, thirst = thirst }, 'event:needs')
    end)

    RegisterNetEvent(events.SetHealth or 'rs-lilhudlife:client:SetHealth', function(health, armor)
        local payload = { health = health }
        if armor ~= nil then payload.armor = armor end
        applyStatusPayload(payload, 'event:health')
    end)

    RegisterNetEvent(events.SetNOS or 'rs-lilhudlife:client:SetNOS', function(value)
        if (Config.NOSBridge or {}).Enabled == false then return end
        local percent = normalizeNosValue(value)
        if percent ~= nil and setStatusExact('nos', percent) then pushStatus() end
    end)

    local function handleNosAlias(...)
        if (Config.NOSBridge or {}).Enabled == false then return end
        local args = { ... }
        local candidate = nil

        -- Many resources emit (active, level), (vehicle, level), or one table.
        for i = #args, 1, -1 do
            local valueType = type(args[i])
            if valueType == 'number' or valueType == 'table' then
                candidate = args[i]
                break
            end
        end

        if candidate == nil and #args == 1 then candidate = args[1] end
        local percent = normalizeNosValue(candidate)
        if percent ~= nil and setStatusExact('nos', percent) then pushStatus() end
    end

    -- qb-mechanicjob emits hud:client:UpdateNitrous(level, hasNitro).
    -- The previous bridge listened for UpdateNitro (missing the trailing 'us'),
    -- which left the all-in-one cluster stuck at 0% even though the bottle loaded.
    local builtInNosEvents = {
        'hud:client:UpdateNitrous',
        'hud:client:UpdateNitro',
        'qb-hud:client:UpdateNitrous',
        'qb-hud:client:UpdateNitro',
        'qb-mechanicjob:client:UpdateNitrous',
    }

    local registeredNosEvents = {}
    local function registerNosAlias(eventName)
        if not eventName or eventName == '' then return end
        if eventName == (events.SetNOS or 'rs-lilhudlife:client:SetNOS') then return end
        if registeredNosEvents[eventName] then return end
        registeredNosEvents[eventName] = true
        RegisterNetEvent(eventName, handleNosAlias)
    end

    for _, eventName in ipairs(builtInNosEvents) do registerNosAlias(eventName) end
    for _, eventName in ipairs((Config.NOSBridge and Config.NOSBridge.EventAliases) or {}) do
        registerNosAlias(eventName)
    end

    RegisterNetEvent(events.Refresh or 'rs-lilhudlife:client:RefreshStatus', function()
        delayedStatusRefresh(50)
    end)

    local esxEvent = (hb.ESXStatus and hb.ESXStatus.Event) or 'esx_status:onTick'
    RegisterNetEvent(esxEvent, handleESXStatusTick)

    for _, eventName in ipairs(events.RefreshAfter or {}) do
        if eventName and eventName ~= '' then
            RegisterNetEvent(eventName, function()
                delayedStatusRefresh(250)
                delayedStatusRefresh(1500)
            end)
        end
    end
end

exports('SetStatus', function(payloadOrKey, value)
    if type(payloadOrKey) == 'table' then
        return applyStatusPayload(payloadOrKey, 'export:SetStatus')
    elseif payloadOrKey ~= nil then
        return applyStatusPayload({ [payloadOrKey] = value }, 'export:SetStatus')
    end
    return false
end)

exports('SetNOS', function(value)
    if (Config.NOSBridge or {}).Enabled == false then return false end
    local percent = normalizeNosValue(value)
    if percent == nil then return false end
    local changed = setStatusExact('nos', percent)
    if changed then pushStatus() end
    return changed
end)

exports('RefreshStatus', function()
    return refreshAllStatusSources(true)
end)

exports('GetStatus', function()
    return {
        health = statusData.health,
        armor = statusData.armor,
        hunger = statusData.hunger,
        thirst = statusData.thirst,
        stamina = statusData.stamina,
        oxygen = statusData.oxygen,
        nos = statusData.nos,
        showOxygen = statusData.showOxygen,
        framework = detectedFramework,
    }
end)

registerStatusBridgeEvents()

-- ============================================================
-- FRAMEWORK INITIALIZATION
-- Does not hang forever if qb-core is not installed. Standalone
-- servers still get native health/armor/stamina/oxygen immediately.
-- ============================================================
Citizen.CreateThread(function()
    TriggerServerEvent('rs-lilhudlife:server:requestMoneyMode')

    local waited = 0
    local timeout = (Config.HealthBridge and Config.HealthBridge.FrameworkDetectTimeout) or 2500

    while waited < timeout do
        if initQBCoreOnce() then break end
        Citizen.Wait(500)
        waited = waited + 500
    end

    if QBCore then
        local ok, PlayerData = pcall(function()
            return QBCore.Functions.GetPlayerData()
        end)
        onPlayerLoaded(ok and PlayerData or {})
    else
        debug('No framework detected; running standalone health bridge mode')
        onPlayerLoaded({})
    end

    -- Late-start safety for servers that start qb-core after this HUD.
    while not QBCore do
        Citizen.Wait(2500)
        if initQBCoreOnce() then
            local ok, PlayerData = pcall(function()
                return QBCore.Functions.GetPlayerData()
            end)
            onPlayerLoaded(ok and PlayerData or {})
            break
        end
    end
end)

function onPlayerLoaded(PlayerData)
    playerLoaded = true
    -- Never expose the previous character's money/job while the new provider
    -- is still loading or returns incomplete player data.
    moneyData.cash, moneyData.bank = 0, 0
    moneyData.job, moneyData.jobGrade = '', ''

    -- Status bridge first, then framework metadata fallback.
    refreshAllStatusSources(false)

    -- Pull money
    -- When the inventory runs with cash-as-item the real total lives in items.
    -- Fall back to PlayerData.money.cash otherwise.
    -- ox_inventory first: under it PlayerData.items is an empty table, and the
    -- old order took the item branch anyway and pinned cash to 0 forever.
    local oxCash, oxAnswered = oxInventoryCash()
    if oxAnswered then
        moneyData.cash = oxCash
    elseif usesCashAsItem() and PlayerData and type(PlayerData.items) == 'table' and next(PlayerData.items) ~= nil then
        moneyData.cash = math.max(0, countCashItems(PlayerData.items))
    elseif PlayerData and PlayerData.money then
        moneyData.cash = PlayerData.money.cash or 0
    end
    if PlayerData and PlayerData.money then
        moneyData.bank = PlayerData.money.bank or 0
    end

    if GetResourceState('qb-inventory') == 'started' then
        TriggerServerEvent('qb-inventory:server:requestCashState')
    end

    -- Pull job
    if PlayerData and PlayerData.job then
        moneyData.job = PlayerData.job.label or PlayerData.job.name or ''
        moneyData.jobGrade = jobGradeLabel(PlayerData.job)
    end

    -- Player server ID
    moneyData.id = GetPlayerServerId(PlayerId())
    moneyData.playerName = GetPlayerName(PlayerId()) or 'PLAYER'

    -- Seed the UI defaults from config.lua so a brand-new player (no saved
    -- layout) inherits the server owner's chosen positions/style/scale. A
    -- player's own saved layout (loadSettings below) always overrides this.
    sendNUI({
        action = 'configDefaults',
        data = {
            hudEnabled   = hudMasterEnabled,
            speedoStyle  = Config.Speedo.Style,
            hideStandaloneStatusInCluster = Config.Speedo.HideStandaloneStatusInCluster ~= false,
            scale        = math.floor((Config.Speedo.Scale or 0.88) * 100 + 0.5),
            unit         = Config.Speed.Unit,
            speedoX      = Config.Speedo.PosX,
            speedoY      = Config.Speedo.PosY,
            statusEnabled = Config.Status.Enabled,
            statusX      = Config.Status.PosX,
            statusY      = Config.Status.PosY,
            statusScale  = math.floor((Config.Status.Scale or 1.0) * 100 + 0.5),
            statusShape  = Config.Status.Shape,
            statusIconStyle = Config.Status.IconStyle,
            iconLayout = Config.Status.Layout or 'horizontal',
            moneyEnabled = Config.Money.Enabled,
            moneyX       = Config.Money.PosX,
            moneyY       = Config.Money.PosY,
            moneyScale   = math.floor((Config.Money.Scale or 1.0) * 100 + 0.5),
            moneyStyle   = Config.Money.Style,
            pillVoice    = not (Config.Money.Show and Config.Money.Show.voice == false),
            nosEnabled   = (Config.NOSBridge or {}).Enabled ~= false,
            nosStyle     = (Config.NOSBridge or {}).Style or 'bottle',
            nosWarning   = (Config.NOSBridge or {}).LowThreshold or 20,
        }
    })

    -- Load saved KVP settings and push to NUI so the player's
    -- layout is restored immediately when they spawn in.
    local saved = nil
    if KVP_KEY and KVP_KEY ~= '' then
        saved = GetResourceKvpString(KVP_KEY)
    end
    if saved and saved ~= '' then
        sendNUI({ action = 'loadSettings', json = saved })
        debug('KVP settings loaded and pushed to NUI')
    end

    pushStatus()
    pushMoney()
end

local function onPlayerUnloaded()
    closeHudMenu(true)
    playerLoaded = false
    bootPlayed = false
    cancelBootSequence()
    inVehicle = false
    hudActive = false
    currentVehicle = nil
    currentVehicleClass = nil
    currentVehicleModel = nil
    currentVehicleInfo = nil
    qbMechanicNosRequestId = qbMechanicNosRequestId + 1
    qbMechanicNosPollPending = false
    qbMechanicNosLastPoll = 0
    rsCustomsNosLastPoll = 0
    rsCustomsNosHandled = false
    nosSimActive = false
    nosSim = { activeSince = 0, cooldownUntil = 0, vehicle = 0, level = 100 }
    statusData.nos = (Config.NOSBridge and Config.NOSBridge.Default) or 0
    moneyData.cash, moneyData.bank = 0, 0
    moneyData.job, moneyData.jobGrade = '', ''
    statusData.health, statusData.armor = 100, 0
    statusData.hunger, statusData.thirst = 100, 100
    statusData.stamina, statusData.oxygen = 100, 100
    statusData.showOxygen = false
    sendNUI({ action = 'hideAll' })
end

-- ============================================================
-- QBCORE EVENT HOOKS
-- ============================================================
AddEventHandler('QBCore:Client:OnPlayerLoaded', function()
    if not QBCore then initQBCoreOnce() end
    local PlayerData = {}
    if QBCore then
        local ok, data = pcall(function()
            return QBCore.Functions.GetPlayerData()
        end)
        PlayerData = ok and data or {}
    end
    onPlayerLoaded(PlayerData)
end)

RegisterNetEvent('QBCore:Client:OnPlayerUnload', function()
    onPlayerUnloaded()
end)

RegisterNetEvent('qbx_core:client:playerLoggedOut', function()
    if detectedFramework == 'qbox' then onPlayerUnloaded() end
end)

-- QBCore/qb-hud needs update. This keeps hunger/thirst matched to
-- the same values the server's existing HUD/needs script is using.
RegisterNetEvent('hud:client:UpdateNeeds', function(hunger, thirst)
    local hb = Config.HealthBridge or {}
    local qbc = hb.QBCore or {}
    if qbc.Enabled == false then return end
    statusData.hunger = normalizeStatusValue(hunger, statusData.hunger)
    statusData.thirst = normalizeStatusValue(thirst, statusData.thirst)
    pushStatus()
end)

-- Optional stress-as-stamina compatibility. Off by default in config
-- because native GTA stamina is usually the more honest stamina value.
RegisterNetEvent('hud:client:UpdateStress', function(stress)
    local hb = Config.HealthBridge or {}
    local qbc = hb.QBCore or {}
    if qbc.Enabled == false or not qbc.StaminaFromStress then return end
    setStatusPercent('stress', stress or 0, true)
    pushStatus()
end)

-- QBCore money updates
RegisterNetEvent('QBCore:Client:OnMoneyChange', function(moneyType, amount, operationOrIsMinus, reason)
    amount = tonumber(amount) or 0

    local function applyMoney(current)
        current = tonumber(current) or 0

        if operationOrIsMinus == 'set' then
            return amount
        elseif operationOrIsMinus == 'add' then
            return current + amount
        elseif operationOrIsMinus == 'remove' then
            return math.max(0, current - amount)
        elseif type(operationOrIsMinus) == 'boolean' then
            return operationOrIsMinus and math.max(0, current - amount) or (current + amount)
        end

        return amount
    end

    if moneyType == 'cash' then
        if usesCashAsItem() then
            -- Physical-cash inventories are the authority. Framework money events
            -- may arrive before or after the inventory sync, so recount the final
            -- item/account value instead of applying a potentially stale delta.
            SetTimeout(150, function()
                local counted = countCashItems()
                moneyData.cash = math.max(0, tonumber(counted) or 0)
                pushMoney()
            end)
        else
            moneyData.cash = math.max(0, applyMoney(moneyData.cash))
            pushMoney()
        end
        return
    elseif moneyType == 'bank' then
        moneyData.bank = applyMoney(moneyData.bank)
    end

    pushMoney()
end)


-- Cash-as-item bridge fired by the new dungeon qb-inventory client.
-- Carries the absolute current cash item count.
RegisterNetEvent('qb-inventory:client:updateCash', function(amount)
    if not usesCashAsItem() or GetResourceState('qb-inventory') ~= 'started' then return end
    moneyData.cash = math.max(0, tonumber(amount) or 0)
    pushMoney()
end)

-- ox_inventory fires none of the qb money events, so without this the cash pill
-- only ever updated on login. This is the live feed under ox_inventory.
AddEventHandler('ox_inventory:updateInventory', function()
    local counted, answered = oxInventoryCash()
    if not answered then return end
    if counted ~= moneyData.cash then
        moneyData.cash = counted
        pushMoney()
    end
end)

-- Full PlayerData replacement (login, character swap, etc).
-- Recount cash from items when present.
RegisterNetEvent('QBCore:Player:SetPlayerData', function(PlayerData)
    if not PlayerData then return end
    if usesCashAsItem() and PlayerData.items and type(PlayerData.items) == 'table' then
        moneyData.cash = math.max(0, countCashItems(PlayerData.items))
    elseif PlayerData.money and PlayerData.money.cash ~= nil then
        moneyData.cash = math.max(0, tonumber(PlayerData.money.cash) or 0)
    end
    if PlayerData.money and PlayerData.money.bank ~= nil then
        moneyData.bank = math.max(0, tonumber(PlayerData.money.bank) or 0)
    end
    pushMoney()
end)

-- Per-field player data updates (zombie qb-inventory uses this for items sync).
RegisterNetEvent('QBCore:Player:UpdatePlayerDataField', function(key, val)
    if key == 'items' then
        if usesCashAsItem() then
            moneyData.cash = math.max(0, countCashItems(val))
            pushMoney()
        end
    elseif key == 'money' and type(val) == 'table' then
        if val.bank ~= nil then moneyData.bank = math.max(0, tonumber(val.bank) or 0) end
        if not usesCashAsItem() and val.cash ~= nil then
            moneyData.cash = math.max(0, tonumber(val.cash) or 0)
        end
        pushMoney()
    end
end)

-- Legacy QBCore money set events (some forks use SetMoney)
RegisterNetEvent('QBCore:Client:SetMoney', function(moneyType, amount)
    if moneyType == 'cash' and not usesCashAsItem() then
        moneyData.cash = math.max(0, tonumber(amount) or 0)
    end
    if moneyType == 'bank' then moneyData.bank = math.max(0, tonumber(amount) or 0) end
    pushMoney()
end)

-- Job update
RegisterNetEvent('QBCore:Client:OnJobUpdate', function(JobInfo)
    if JobInfo then
        moneyData.job = JobInfo.label or JobInfo.name or ''
        moneyData.jobGrade = jobGradeLabel(JobInfo)
    end
    pushMoney()
end)

-- ============================================================
-- ESX EVENT HOOKS (via rs_bridge)
-- ============================================================
-- None of the QBCore:* events above exist on ESX, so without this block the
-- HUD's money and job pills never update there. rs_bridge normalizes both
-- ecosystems onto rs_bridge:client:* events.
--
-- Those normalized events also fire on Qbox/QBCore, where the handlers above
-- have already run, so each one bails unless ESX is the resolved framework.
-- That keeps this purely additive: the working Qbox path is untouched.
local function esxResolved()
    return detectedFramework == 'esx'
end

AddEventHandler('rs_bridge:client:playerLoaded', function()
    if not esxResolved() then return end
    if not QBCore then initQBCoreOnce() end

    local PlayerData = {}
    if QBCore then
        local ok, data = pcall(function()
            return QBCore.Functions.GetPlayerData()
        end)
        PlayerData = ok and data or {}
    end
    onPlayerLoaded(PlayerData)
end)

AddEventHandler('rs_bridge:client:playerUnloaded', function()
    if not esxResolved() then return end
    onPlayerUnloaded()
end)

AddEventHandler('rs_bridge:client:jobUpdate', function(job)
    if not esxResolved() or not job then return end
    moneyData.job = job.label or job.name or ''
    moneyData.jobGrade = jobGradeLabel(job)
    pushMoney()
end)

-- ESX always reports an absolute balance, so this is always a 'set'.
AddEventHandler('rs_bridge:client:moneyChange', function(account, amount)
    if not esxResolved() then return end
    amount = math.max(0, tonumber(amount) or 0)

    if account == 'cash' then
        moneyData.cash = amount
    elseif account == 'bank' then
        moneyData.bank = amount
    else
        return
    end

    pushMoney()
end)


-- Direct ESX events for servers that do not use rs_bridge.
RegisterNetEvent('esx:playerLoaded', function()
    if detectedFramework ~= 'esx' then return end
    SetTimeout(0, function()
        local PlayerData = QBCore and QBCore.Functions and QBCore.Functions.GetPlayerData() or {}
        onPlayerLoaded(PlayerData)
    end)
end)

RegisterNetEvent('esx:onPlayerLogout', function()
    if detectedFramework == 'esx' then onPlayerUnloaded() end
end)

RegisterNetEvent('esx:setJob', function(job)
    if detectedFramework ~= 'esx' or not job then return end
    moneyData.job = job.label or job.name or ''
    moneyData.jobGrade = jobGradeLabel(job)
    pushMoney()
end)

RegisterNetEvent('esx:setAccountMoney', function(account)
    if detectedFramework ~= 'esx' or type(account) ~= 'table' then return end
    local name = tostring(account.name or ''):lower()
    local amount = math.max(0, tonumber(account.money or account.amount) or 0)
    if name == 'money' or name == 'cash' then
        moneyData.cash = amount
    elseif name == 'bank' then
        moneyData.bank = amount
    else
        return
    end
    pushMoney()
end)

-- ============================================================
-- STATUS PUSH FUNCTIONS
-- ============================================================
function pushStatus()
    if externalHudHidden or pauseMenuHiddenHud then return end
    sendNUI({
        action = 'updateStatus',
        data = statusData,
        config = {
            enabled = Config.Status.Enabled,
            position = Config.Status.Position,
            x = Config.Status.PosX,
            y = Config.Status.PosY,
            layout = Config.Status.Layout or 'horizontal',
            shape = Config.Status.Shape,
            iconStyle = Config.Status.IconStyle,
            scale = Config.Status.Scale,
            glow = Config.Status.Glow,
            lowPulse = Config.Status.LowPulse,
            fadeWhenFull = Config.Status.FadeWhenFull,
            dynamicColor = Config.Status.DynamicColor,
            opacity = Config.Status.Opacity,
            lowThreshold = Config.Status.LowThreshold,
            nosLowThreshold = (Config.NOSBridge and Config.NOSBridge.LowThreshold) or 20,
            nosStyle = (Config.NOSBridge and Config.NOSBridge.Style) or 'bottle',
            show = Config.Status.Show,
            colors = Config.Status.Colors,
            offset = Config.Status.Offset,
        }
    })
end

function pushMoney()
    if externalHudHidden or pauseMenuHiddenHud then return end
    moneyData.playerName = GetPlayerName(PlayerId()) or moneyData.playerName
    sendNUI({
        action = 'updateMoney',
        data = moneyData,
        voice = voiceData,
        config = {
            enabled = Config.Money.Enabled,
            position = Config.Money.Position,
            x = Config.Money.PosX,
            y = Config.Money.PosY,
            scale = Config.Money.Scale,
            show = Config.Money.Show,
            serverName = Config.Money.ServerName,
            style = Config.Money.Style,
            offset = Config.Money.Offset,
        }
    })
end

local function voiceNativeBool(value)
    return value == true or value == 1
end

local function classifyVoiceLevel(modeName, modeIndex, distance)
    local mode = string.lower(tostring(modeName or ''))
    if string.find(mode, 'whisper', 1, true) or string.find(mode, 'soft', 1, true) then return 'soft' end
    if string.find(mode, 'shout', 1, true) or string.find(mode, 'loud', 1, true) or string.find(mode, 'yell', 1, true) then return 'loud' end

    local index = tonumber(modeIndex)
    if index and index <= 1 then return 'soft' end
    if index and index >= 3 then return 'loud' end

    local range = tonumber(distance) or 0
    if range > 0 and range <= 3 then return 'soft' end
    if range >= 10 then return 'loud' end
    return 'normal'
end

local function refreshVoiceHud(force)
    local voiceCfg = Config.Money and Config.Money.Voice or nil
    if voiceCfg and voiceCfg.Enabled == false then return end

    -- NetworkIsPlayerTalking is the engine-level path and works without taking
    -- a dependency on the deprecated client-controlled Mumble channel API.
    -- Keep Mumble only as a Legacy compatibility fallback for older pma builds.
    local talking = false
    local okNet, rawNet = pcall(NetworkIsPlayerTalking, PlayerId())
    if okNet then talking = voiceNativeBool(rawNet) end

    local connected = talking
    if not talking then
        local okTalking, rawTalking = pcall(MumbleIsPlayerTalking, PlayerId())
        if okTalking then talking = voiceNativeBool(rawTalking) end
    end
    if talking then connected = true end

    if not connected then
        local okConnected, rawConnected = pcall(MumbleIsConnected)
        if okConnected then connected = voiceNativeBool(rawConnected) end
    end

    local proximity = LocalPlayer and LocalPlayer.state and LocalPlayer.state.proximity or nil
    local modeIndex = type(proximity) == 'table' and proximity.index or 2
    local modeName = type(proximity) == 'table' and proximity.mode or 'Normal'
    local distance = type(proximity) == 'table' and tonumber(proximity.distance) or 0
    if not distance or distance <= 0 then
        local okRange, rawRange = pcall(MumbleGetTalkerProximity)
        distance = okRange and tonumber(rawRange) or 0
    end

    local nextVoice = {
        connected = connected,
        talking = talking or voiceRadioActive,
        radio = voiceRadioActive,
        level = classifyVoiceLevel(modeName, modeIndex, distance),
        mode = tostring(modeName or 'Normal'),
        distance = math.floor((tonumber(distance) or 0) * 10 + 0.5) / 10,
    }

    local changed = force == true
        or nextVoice.connected ~= voiceData.connected
        or nextVoice.talking ~= voiceData.talking
        or nextVoice.radio ~= voiceData.radio
        or nextVoice.level ~= voiceData.level
        or nextVoice.mode ~= voiceData.mode
        or nextVoice.distance ~= voiceData.distance

    voiceData = nextVoice
    if changed and not externalHudHidden and not pauseMenuHiddenHud then
        sendNUI({ action = 'updateVoice', data = voiceData })
    end
end

Citizen.CreateThread(function()
    while true do
        local voiceCfg = Config.Money and Config.Money.Voice or nil
        local interval = voiceCfg and tonumber(voiceCfg.UpdateInterval) or 120
        Citizen.Wait(math.max(80, interval))
        if playerLoaded then refreshVoiceHud(false) end
    end
end)

-- ============================================================
-- UNIVERSAL STATUS POLLING LOOPS
-- Fast loop: native GTA values that should feel live.
-- Slow loop: framework/statebag/export values that should match the
-- server owner's health, needs, medical, job, or standalone scripts.
-- ============================================================
Citizen.CreateThread(function()
    while true do
        local interval = 500
        if Config.HealthBridge and Config.HealthBridge.Native and Config.HealthBridge.Native.PollInterval then
            interval = Config.HealthBridge.Native.PollInterval
        end

        Citizen.Wait(math.max(100, tonumber(interval) or 500))

        if playerLoaded then
            local changed = false
            changed = pullNativeStatus(false) or changed

            -- If a server owner intentionally uses an export source for health,
            -- let that source overwrite the native baseline on the fast loop too.
            local exportsCfg = Config.HealthBridge and Config.HealthBridge.Exports or nil
            if exportsCfg and exportsCfg.Enabled == true then
                changed = pullExportStatus(false) or changed
            end

            if changed then pushStatus() end
        end
    end
end)

Citizen.CreateThread(function()
    while true do
        Citizen.Wait(math.max(250, tonumber((Config.HealthBridge and Config.HealthBridge.NeedsPollInterval) or 2000) or 2000))

        if playerLoaded then
            refreshAllStatusSources(true)
        end
    end
end)

-- Periodic full money refresh
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(math.max(250, tonumber(Config.Money.UpdateInterval) or 1000))
        if playerLoaded then
            if QBCore and QBCore.Functions then
                local ok, PlayerData = pcall(function() return QBCore.Functions.GetPlayerData() end)
                if ok and type(PlayerData) == 'table' then
                    local oxCash, oxAnswered = oxInventoryCash()
                    if oxAnswered then
                        moneyData.cash = oxCash
                    elseif usesCashAsItem() and type(PlayerData.items) == 'table' and next(PlayerData.items) ~= nil then
                        moneyData.cash = math.max(0, countCashItems(PlayerData.items))
                    elseif PlayerData.money and PlayerData.money.cash ~= nil then
                        moneyData.cash = math.max(0, tonumber(PlayerData.money.cash) or 0)
                    end
                    if PlayerData.money and PlayerData.money.bank ~= nil then
                        moneyData.bank = math.max(0, tonumber(PlayerData.money.bank) or 0)
                    end
                end
            end

            pushMoney()
        end
    end
end)

-- ============================================================
-- MAIN LOOP
-- ============================================================
local function enterOrSwitchVehicle(vehicle)
    local newData = getVehicleData(vehicle)
    if not newData then return false end

    local oldData = currentVehicleInfo
    if bootInProgress then cancelBootSequence() end

    inVehicle = true
    currentVehicle = vehicle
    currentVehicleClass = newData.class
    currentVehicleModel = newData.model
    currentVehicleInfo = newData

    qbMechanicNosRequestId = qbMechanicNosRequestId + 1
    qbMechanicNosPollPending = false
    qbMechanicNosLastPoll = 0
    rsCustomsNosLastPoll = 0
    rsCustomsNosHandled = false
    nosSimActive = false
    nosSim.vehicle = 0
    setStatusExact('nos', (Config.NOSBridge and Config.NOSBridge.Default) or 0)

    if hudMasterEnabled and shouldPlayBoot(newData, oldData) then
        playBootSequence(newData)
    elseif hudMasterEnabled then
        sendNUI({ action = 'showSpeedo' })
        hudActive = true
    else
        sendNUI({ action = 'hideSpeedo' })
        hudActive = false
    end

    if (Config.NOSBridge or {}).Enabled ~= false then
        local handledByRSCustoms = pullRSCustomsNosStatus(vehicle, false, true)
        if not handledByRSCustoms then
            pullVehicleNosStatus(vehicle, false)
            pullQbMechanicNosStatus(vehicle, false, true)
        end
    end
    pushStatus()
    return true
end

Citizen.CreateThread(function()
    while true do
        local sleep = 500
        local ped = PlayerPedId()
        local vehicle = GetVehiclePedIsIn(ped, false)

        if not playerLoaded then
            sleep = 500
        elseif vehicle ~= 0 and vehicle ~= nil then
            -- This also catches direct A -> B switches where there is no on-foot
            -- frame between vehicles. The old `not inVehicle` check missed those.
            if not inVehicle or currentVehicle ~= vehicle then
                enterOrSwitchVehicle(vehicle)
            end

            if hudMasterEnabled and hudActive and not bootInProgress and not externalHudHidden and not pauseMenuHiddenHud then
                if (Config.NOSBridge or {}).Enabled ~= false then
                    local handledByRSCustoms = pullRSCustomsNosStatus(vehicle, true, false)
                    if not handledByRSCustoms then
                        if pullVehicleNosStatus(vehicle, false) then pushStatus() end
                        pullQbMechanicNosStatus(vehicle, true, false)
                    end
                end
                sendNUI({ action = 'updateSpeedo', data = getSpeedData(vehicle) })
            end

            sleep = math.max(40, tonumber(Config.Speedo.UpdateInterval) or 50)
        else
            if inVehicle or bootInProgress then
                cancelBootSequence()
                inVehicle = false
                hudActive = false
                currentVehicle = nil
                currentVehicleClass = nil
                currentVehicleModel = nil
                currentVehicleInfo = nil
                qbMechanicNosRequestId = qbMechanicNosRequestId + 1
                qbMechanicNosPollPending = false
                qbMechanicNosLastPoll = 0
                rsCustomsNosLastPoll = 0
                rsCustomsNosHandled = false
                nosSimActive = false
                nosSim.vehicle = 0
                if setStatusExact('nos', (Config.NOSBridge and Config.NOSBridge.Default) or 0) then pushStatus() end
                sendNUI({ action = 'hideSpeedo' })
            end
            sleep = 500
        end

        Citizen.Wait(sleep)
    end
end)

-- Vehicle-art diagnostic.
--
-- The HUD picks its car picture by filename in html/assets/vehicles/, keyed on
-- the vehicle's spawn code. GetEntityArchetypeName can answer empty on GTA V
-- Enhanced, and the GXT label it then falls back to is not the spawn code for
-- DLC vehicles -- which is how a car with shipped art still drew a silhouette.
-- This prints every name the lookup will try, so a miss can be reported with
-- the actual value rather than a guess.
RegisterCommand('rshudveh', function()
    local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
    if not vehicle or vehicle == 0 then
        print('^5[RS-HUDLIFE VEH]^7 Get in a vehicle first.')
        return
    end

    local model = GetEntityModel(vehicle)
    local okArch, archName = pcall(GetEntityArchetypeName, vehicle)
    local displayName = GetDisplayNameFromVehicleModel(model)

    print(('^5[RS-HUDLIFE VEH]^7 model=%s archetype=%s archetypeMatchesHash=%s displayName=%s'):format(
        tostring(model),
        okArch and ('"' .. tostring(archName) .. '"') or 'CALL FAILED',
        tostring(okArch and type(archName) == 'string' and archName ~= '' and joaat(archName) == model),
        tostring(displayName)
    ))

    if currentVehicleInfo then
        print(('^5[RS-HUDLIFE VEH]^7 resolved spawnName=%s -> art tried as assets/vehicles/%s.png'):format(
            tostring(currentVehicleInfo.spawnName), tostring(currentVehicleInfo.spawnName)))
    else
        print('^5[RS-HUDLIFE VEH]^7 no cached vehicle info yet; wait a moment and run this again.')
    end
end, false)

-- Optional F8 diagnostic. It reports the provider/export results and refreshes
-- the current NOS value once so the final line shows the exact detected result.
RegisterCommand('rshudnoscheck', function()
    local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
    print(('^5[RS-HUDLIFE NOS]^7 vehicle=%s hud=%s%%'):format(tostring(vehicle), tostring(statusData.nos)))
    if not vehicle or vehicle == 0 then
        print('^5[RS-HUDLIFE NOS]^7 Enter the vehicle first.')
        return
    end

    local cfg = (Config.NOSBridge and Config.NOSBridge.RSCustoms) or {}
    for _, resourceName in ipairs(cfg.Resources or { 'rs-lscustoms', 'rs-zombielscustoms' }) do
        print(('^5[RS-HUDLIFE NOS]^7 %s state=%s'):format(resourceName, GetResourceState(resourceName)))
        if GetResourceState(resourceName) == 'started' then
            for _, exportName in ipairs({ 'HasNitrous', 'GetSpecialParts', 'GetVehicleProperties' }) do
                local ok, result = callVehicleExport(resourceName, exportName, vehicle)
                local encoded = tostring(result)
                if ok and type(result) == 'table' and json and json.encode then
                    local jsonOk, jsonValue = pcall(json.encode, result)
                    if jsonOk then encoded = jsonValue end
                end
                if #encoded > 500 then encoded = encoded:sub(1, 500) .. '...' end
                print(('^5[RS-HUDLIFE NOS]^7 export %s ok=%s result=%s'):format(
                    exportName, tostring(ok), encoded
                ))
            end
        end
    end

    local handled = pullRSCustomsNosStatus(vehicle, true, true)
    print(('^5[RS-HUDLIFE NOS]^7 RS Customs handled=%s final=%s%%'):format(
        tostring(handled), tostring(statusData.nos)
    ))
end, false)

-- ============================================================
-- MENU / KEYBIND
-- ============================================================
CreateThread(function()
    while true do
        if menuOpen then
            -- Other HUD resources commonly hide the radar every frame. Layout mode
            -- needs the real minimap as its size and placement reference.
            DisplayRadar(true)
            Wait(0)
        else
            Wait(250)
        end
    end
end)

RegisterCommand('rshudlife', function()
    if menuOpen then
        closeHudMenu(true)
        playSound('menu_close')
        return
    end

    -- Never take keyboard/mouse focus for an invisible or blocked menu.
    if not playerLoaded or externalHudHidden or pauseMenuHiddenHud or IsPauseMenuActive() then return end
    menuSession = menuSession + 1
    menuOpen = true
    if menuOpen then
        local ped = PlayerPedId()
        local vehicle = GetVehiclePedIsIn(ped, false)
        setMenuRadarVisible(true)
        sendNUI({
            action = 'openMenu',
            config = {
                position = Config.Speedo.Position,
                scale = Config.Speedo.Scale,
                unit = Config.Speed.Unit,
                inVehicle = vehicle and vehicle ~= 0,
                sessionId = menuSession,
            }
        })
        SetNuiFocus(true, true)
        SetNuiFocusKeepInput(false)
        playSound('menu_open')
    end
end, false)

RegisterKeyMapping('rshudlife', Config.Menu.Description, 'keyboard', Config.Menu.Key)

-- ============================================================
-- NUI CALLBACKS
-- ============================================================
local SPEEDO_STYLES = { halo=true, vehicle=true, apex=true, classic=true, neon=true, minimal=true, turbo=true, volt=true, survival=true, cluster=true }
local STATUS_LAYOUTS = { horizontal=true, stacked=true, compact=true }
local STATUS_SHAPES = { circle=true, diamond=true, hexagon=true, square=true }
local STATUS_ICON_STYLES = { crystal=true, neon=true, mono=true, vivid=true }
local MONEY_STYLES = { glass=true, clean=true, neon=true, executive=true, compact=true }
local NOS_STYLES = { bottle=true, neon=true, mono=true }
local SPEED_UNITS = { mph='MPH', kmh='KMH' }
local STATUS_KEYS = { health=true, armor=true, hunger=true, thirst=true, stamina=true, oxygen=true, nos=true }
local MONEY_KEYS = { server=true, cash=true, bank=true, id=true, job=true, voice=true }

local function allowedValue(value, allowed, fallback)
    if type(value) ~= 'string' then return fallback end
    value = value:lower()
    local accepted = allowed[value]
    if accepted == true then return value end
    if type(accepted) == 'string' then return accepted end
    return fallback
end

local function boundedNumber(value, minimum, maximum, fallback)
    value = tonumber(value)
    if not value or value ~= value or value == math.huge or value == -math.huge then return fallback end
    return math.max(minimum, math.min(maximum, value))
end

local function strictBool(value, fallback)
    if type(value) == 'boolean' then return value end
    return fallback
end

local function copyBooleanMap(source, destination, allowed)
    if type(source) ~= 'table' or type(destination) ~= 'table' then return end
    for key, value in pairs(source) do
        if allowed[key] and type(value) == 'boolean' then destination[key] = value end
    end
end

RegisterNUICallback('closeMenu', function(data, cb)
    -- NUI requests are asynchronous. An older close can arrive after F9
    -- opened another session; never let it steal the new menu's focus.
    local received = type(data) == 'table' and tonumber(data.sessionId) or nil
    if received == menuSession then
        if closeHudMenu(false) then playSound('menu_close') end
    end
    cb('ok')
end)

RegisterNUICallback('saveSettings', function(data, cb)
    data = type(data) == 'table' and data or {}
    if type(data.position) == 'string' and #data.position <= 32 then Config.Speedo.Position = data.position end
    if data.x ~= nil then Config.Speedo.PosX = boundedNumber(data.x, 0, 95, Config.Speedo.PosX) end
    if data.y ~= nil then Config.Speedo.PosY = boundedNumber(data.y, 0, 95, Config.Speedo.PosY) end
    if data.style ~= nil then Config.Speedo.Style = allowedValue(data.style, SPEEDO_STYLES, Config.Speedo.Style) end
    if data.scale ~= nil then Config.Speedo.Scale = boundedNumber(data.scale, 0.75, 1.10, Config.Speedo.Scale) end
    if data.unit ~= nil then Config.Speed.Unit = allowedValue(data.unit, SPEED_UNITS, Config.Speed.Unit) end
    playSound('menu_select')
    cb('ok')
end)

RegisterNUICallback('saveStatusSettings', function(data, cb)
    data = type(data) == 'table' and data or {}
    Config.Status.Enabled = strictBool(data.enabled, Config.Status.Enabled)
    if type(data.position) == 'string' and #data.position <= 32 then Config.Status.Position = data.position end
    if data.x ~= nil then Config.Status.PosX = boundedNumber(data.x, 0, 95, Config.Status.PosX) end
    if data.y ~= nil then Config.Status.PosY = boundedNumber(data.y, 0, 95, Config.Status.PosY) end
    if data.layout ~= nil then Config.Status.Layout = allowedValue(data.layout, STATUS_LAYOUTS, Config.Status.Layout) end
    if data.shape ~= nil then Config.Status.Shape = allowedValue(data.shape, STATUS_SHAPES, Config.Status.Shape) end
    if data.iconStyle ~= nil then Config.Status.IconStyle = allowedValue(data.iconStyle, STATUS_ICON_STYLES, Config.Status.IconStyle) end
    if data.scale ~= nil then Config.Status.Scale = boundedNumber(data.scale, 0.70, 1.05, Config.Status.Scale) end
    Config.Status.Glow = strictBool(data.glow, Config.Status.Glow)
    Config.Status.LowPulse = strictBool(data.lowPulse, Config.Status.LowPulse)
    Config.Status.FadeWhenFull = strictBool(data.fadeWhenFull, Config.Status.FadeWhenFull)
    Config.Status.DynamicColor = strictBool(data.dynamicColor, Config.Status.DynamicColor)
    if data.opacity ~= nil then Config.Status.Opacity = boundedNumber(data.opacity, 0.20, 1.0, Config.Status.Opacity) end
    copyBooleanMap(data.show, Config.Status.Show, STATUS_KEYS)
    pushStatus()
    playSound('menu_select')
    cb('ok')
end)

RegisterNUICallback('saveMoneySettings', function(data, cb)
    data = type(data) == 'table' and data or {}
    Config.Money.Enabled = strictBool(data.enabled, Config.Money.Enabled)
    if type(data.position) == 'string' and #data.position <= 32 then Config.Money.Position = data.position end
    if data.x ~= nil then Config.Money.PosX = boundedNumber(data.x, 0, 95, Config.Money.PosX) end
    if data.y ~= nil then Config.Money.PosY = boundedNumber(data.y, 0, 95, Config.Money.PosY) end
    if data.scale ~= nil then Config.Money.Scale = boundedNumber(data.scale, 0.75, 1.10, Config.Money.Scale) end
    if data.style ~= nil then Config.Money.Style = allowedValue(data.style, MONEY_STYLES, Config.Money.Style) end
    copyBooleanMap(data.show, Config.Money.Show, MONEY_KEYS)
    pushMoney()
    playSound('menu_select')
    cb('ok')
end)

RegisterNUICallback('saveAudioSettings', function(data, cb)
    data = type(data) == 'table' and data or {}
    Config.Sound.Enabled = strictBool(data.enabled, Config.Sound.Enabled)
    if data.volume ~= nil then
        Config.Sound.Volume = boundedNumber(data.volume, 0, 1, Config.Sound.Volume)
    end
    cb('ok')
end)

RegisterNUICallback('saveSystemSettings', function(data, cb)
    data = type(data) == 'table' and data or {}
    Config.Boot.Enabled = strictBool(data.boot, Config.Boot.Enabled)
    hudMasterEnabled = strictBool(data.hudEnabled, hudMasterEnabled)
    Config.Enabled = hudMasterEnabled

    if not hudMasterEnabled then
        cancelBootSequence()
        hudActive = false
        sendNUI({ action = 'hideSpeedo' })
    else
        local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
        if playerLoaded and vehicle and vehicle ~= 0 and not bootInProgress then
            currentVehicle = vehicle
            sendNUI({ action = 'showSpeedo' })
            hudActive = true
        end
    end
    cb('ok')
end)

RegisterNUICallback('saveNosSettings', function(data, cb)
    data = type(data) == 'table' and data or {}
    Config.NOSBridge = Config.NOSBridge or {}
    Config.Status.Show = Config.Status.Show or {}

    Config.NOSBridge.Enabled = strictBool(data.enabled, Config.NOSBridge.Enabled)
    if data.style ~= nil then Config.NOSBridge.Style = allowedValue(data.style, NOS_STYLES, Config.NOSBridge.Style or 'bottle') end
    if data.warning ~= nil then
        Config.NOSBridge.LowThreshold = boundedNumber(data.warning, 0, 100, Config.NOSBridge.LowThreshold or 20)
    end

    if type(data.alwaysShow) == 'boolean' then
        Config.Status.Show.nos = data.alwaysShow
    end

    if Config.NOSBridge.Enabled == false then
        Config.Status.Show.nos = false
        statusData.nos = 0
        nosSimActive = false
        nosSim.activeSince, nosSim.cooldownUntil = 0, 0
    else
        rsCustomsNosLastPoll = 0
        rsCustomsNosHandled = false
        local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
        if vehicle and vehicle ~= 0 then
            local handled = pullRSCustomsNosStatus(vehicle, false, true)
            if not handled then pullVehicleNosStatus(vehicle, false) end
        end
    end

    pushStatus()
    playSound('menu_select')
    cb('ok')
end)

-- ============================================================
-- KVP SETTINGS PERSISTENCE
-- Called by menu.js whenever the player saves.
-- Uses FiveM's SetResourceKvp which writes to the player's
-- actual game profile - survives server restarts, resource
-- restarts, and game closes.
-- ============================================================
RegisterNUICallback('saveKVP', function(data, cb)
    -- NUI is not an authority boundary, but malformed/huge settings should never
    -- poison the player's persistent KVP or create avoidable client errors.
    local raw = type(data) == 'table' and data.json or nil
    if type(raw) == 'string' and #raw <= 16384 then
        local ok, decoded = pcall(json.decode, raw)
        if ok and type(decoded) == 'table' then
            SetResourceKvp(KVP_KEY, raw)
            debug('Settings saved to KVP')
        end
    end
    cb('ok')
end)

RegisterNUICallback('loadKVP', function(data, cb)
    -- NUI is asking for saved settings (on menu open)
    local saved = nil
    if KVP_KEY and KVP_KEY ~= '' then
        saved = GetResourceKvpString(KVP_KEY)
    end
    cb(saved or '')
end)

RegisterNUICallback('playSound', function(data, cb)
    -- For debugging sound triggers from UI
    cb('ok')
end)

RegisterNUICallback('replayBoot', function(data, cb)
    local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
    if playerLoaded and hudMasterEnabled and vehicle and vehicle ~= 0 then
        local vData = getVehicleData(vehicle)
        if vData then
            currentVehicle = vehicle
            currentVehicleInfo = vData
            hudActive = false
            if bootInProgress then cancelBootSequence() end
            playBootSequence(vData)
        end
    end
    cb('ok')
end)


-- ============================================================
-- INVENTORY COMPAT: PAUSE / MAP MENU HIDE
-- Keeps HUD out of the way when ESC/map is open, then restores
-- it after the player closes pause/map unless inventory hid it.
-- ============================================================
CreateThread(function()
    while true do
        Wait(250)
        local pauseOpen = IsPauseMenuActive()

        if pauseOpen and not pauseMenuHiddenHud then
            pauseMenuHiddenHud = true
            closeHudMenu(true)
            if bootInProgress then cancelBootSequence() end
            sendNUI({ action = 'setHudSuppressed', suppressed = true })
        elseif not pauseOpen and pauseMenuHiddenHud then
            pauseMenuHiddenHud = false
            sendNUI({ action = 'setHudSuppressed', suppressed = false })

            if not externalHudHidden then
                if playerLoaded then
                    pushStatus()
                    pushMoney()
                end

                local ped = PlayerPedId()
                local vehicle = GetVehiclePedIsIn(ped, false)
                if playerLoaded and hudMasterEnabled and vehicle and vehicle ~= 0 then
                    hudActive = true
                    sendNUI({ action = 'showSpeedo' })
                end
            end
        end
    end
end)

-- ============================================================
-- CLEANUP ON RESOURCE STOP
-- ============================================================
AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() then
        bootGeneration = bootGeneration + 1
        qbMechanicNosRequestId = qbMechanicNosRequestId + 1
        qbMechanicNosPollPending = false
        if bootPtfxHandle then StopParticleFxLooped(bootPtfxHandle, false); bootPtfxHandle = nil end
        closeHudMenu(false)
        sendNUI({ action = 'hideAll' })
    end
end)

debug('RS HUDLIFE V4 client loaded')


-- ============================================================
-- EXTERNAL HUD VISIBILITY EXPORT
-- Lets qb-inventory hide/show this HUD when the player opens
-- their inventory, pause menu, etc.
-- Usage from another resource:
--     exports['rs-lilhudlife']:SetHUDLifeVisible(false) -- hide
--     exports['rs-lilhudlife']:SetHUDLifeVisible(true)  -- show
-- ============================================================
local function SetHUDLifeVisible(arg1, arg2)
    local visible = arg1

    -- Some callers pass (resourceName, visible). Detect and unwrap.
    if type(arg1) ~= 'boolean' and type(arg2) == 'boolean' then
        visible = arg2
    end

    if type(visible) ~= 'boolean' then
        visible = true
    end

    externalHudHidden = not visible

    if externalHudHidden then
        closeHudMenu(true)
        if bootInProgress then cancelBootSequence() end
        sendNUI({ action = 'hideAll' })
        return
    end

    -- Re-push current state so the components un-hide on next paint.
    if playerLoaded then
        pushStatus()
        pushMoney()
    end

    -- If the player is still in a vehicle, restore the speedo specifically.
    local ped = PlayerPedId()
    local vehicle = GetVehiclePedIsIn(ped, false)
    if playerLoaded and hudMasterEnabled and vehicle and vehicle ~= 0 and not pauseMenuHiddenHud then
        hudActive = true
        sendNUI({ action = 'showSpeedo' })
    end
end

exports('SetHUDLifeVisible', SetHUDLifeVisible)

RegisterNetEvent('rs-lilhudlife:client:SetVisible', function(visible)
    SetHUDLifeVisible(visible)
end)

-- Read-only release diagnostic. Run /rshuddiag in F8 after opening/closing,
-- pausing, character swapping, and stopping an inventory or this resource.
RegisterCommand('rshuddiag', function()
    print(('^5[RS HUDLife]^7 framework=%s loaded=%s menuOpen=%s focusRequested=%s radarForced=%s pause=%s externalHidden=%s hudEnabled=%s vehicle=%s boot=%s')
        :format(tostring(detectedFramework), tostring(playerLoaded), tostring(menuOpen),
            tostring(menuOpen), tostring(menuRadarForced), tostring(pauseMenuHiddenHud),
            tostring(externalHudHidden), tostring(hudMasterEnabled), tostring(inVehicle),
            tostring(bootInProgress)))
    print(('^5[RS HUDLife]^7 moneyProvider=%s cashAsItem=%s cashItem=%s qb=%s qbox=%s esx=%s ox=%s')
        :format(tostring(detectedMoneyProvider), tostring(usesCashAsItem()),
            tostring(cashItemName()), GetResourceState('qb-core'), GetResourceState('qbx_core'),
            GetResourceState('es_extended'), GetResourceState('ox_inventory')))
end, false)

-- ============================================================
-- /hudmech -- why are TRANS and BRAKE showing '--'?
-- ============================================================
-- Those two come from qbx_mechanicjob. Its client only holds a record for a
-- plate once the server has sent vehiclemod:client:setVehicleStatus for it,
-- so a freshly spawned or admin-spawned car legitimately has no data and the
-- HUD shows them as unavailable rather than inventing 100%.
--
-- This prints exactly what the export returns for the car you are sitting in,
-- so 'no record for this plate' can be told apart from 'record exists but the
-- field names changed' without guessing.
RegisterCommand('hudmech', function()
    local veh = GetVehiclePedIsIn(PlayerPedId(), false)
    if not veh or veh == 0 then
        print('^3[rs-lilhudlife]^7 /hudmech: not in a vehicle.')
        return
    end

    local plate = trimPlate(GetVehicleNumberPlateText(veh))
    print(('^5[rs-lilhudlife]^7 plate=%q  qbx_mechanicjob=%s')
        :format(plate, GetResourceState('qbx_mechanicjob')))

    if GetResourceState('qbx_mechanicjob') ~= 'started' then
        print('^3  qbx_mechanicjob is not started -- TRANS/BRAKE will always read --^7')
        return
    end

    local ok, status = pcall(function()
        return exports.qbx_mechanicjob:GetVehicleStatusList(plate)
    end)

    if not ok then
        print(('^1  export call FAILED: %s^7'):format(tostring(status)))
        return
    end
    if type(status) ~= 'table' then
        print('^3  no record for this plate. qbx_mechanicjob only tracks vehicles')
        print('^3  the server has sent status for -- expected on a spawned car.^7')
        return
    end

    print('^2  record found. fields the HUD reads:^7')
    for _, key in ipairs({ 'clutch', 'axle', 'brakes', 'radiator', 'fuel' }) do
        print(('    %-10s %s'):format(key, tostring(status[key])))
    end
    print('^5  every field present:^7')
    for k, v in pairs(status) do
        print(('    %-10s %s'):format(tostring(k), tostring(v)))
    end
end, false)
