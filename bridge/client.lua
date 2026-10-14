-- rs-lilhudlife framework provider.
--
-- The HUD previously resolved its framework by requiring a *resource* named
-- qb-core to be started. Qbox never satisfies that: qbx_core only declares
-- provide 'qb-core', so GetResourceState('qb-core') is 'missing' and the HUD
-- silently fell back to standalone mode, losing money, job and framework
-- status values.
--
-- Direct framework providers are tried first so vehicle artwork works without
-- rs_bridge. The bridge remains an optional final compatibility provider.

RSHUDBridge = RSHUDBridge or {}

local function bridgeUp()
    return GetResourceState('rs_bridge') == 'started'
end

-- Resolves a vehicle model hash to its spawn name using the framework's own
-- vehicle registry. Needed because GetEntityArchetypeName is unreliable on
-- GTA V Enhanced, and the per-vehicle artwork in html/assets/vehicles is keyed
-- by spawn name -- a wrong key means a silhouette instead of the car.
---@param hash number
---@return string|nil
function RSHUDBridge.GetVehicleModelName(hash)
    hash = tonumber(hash)
    if not hash then return nil end

    -- Native Qbox registry. This works when its optional QB compatibility
    -- bridge is disabled and is the reliable path on GTA V Enhanced.
    if GetResourceState('qbx_core') == 'started' then
        local ok, vehicle = pcall(function()
            return exports.qbx_core:GetVehiclesByHash(hash)
        end)
        if ok and type(vehicle) == 'table' then
            local name = vehicle.model or vehicle.name
            if type(name) == 'string' and name ~= '' then return name:lower() end
        end
    end

    -- QBCore registry. Some builds index Shared.Vehicles by spawn name while
    -- others additionally expose a hash field, so handle both forms.
    if GetResourceState('qb-core') == 'started' then
        local okCore, core = pcall(function()
            return exports['qb-core']:GetCoreObject()
        end)
        local vehicles = okCore and core and core.Shared and core.Shared.Vehicles or nil
        if type(vehicles) == 'table' then
            for key, vehicle in pairs(vehicles) do
                if type(vehicle) == 'table' then
                    local model = vehicle.model or key
                    local vehicleHash = tonumber(vehicle.hash)
                    if not vehicleHash and type(model) == 'string' then
                        vehicleHash = joaat(model)
                    end
                    if vehicleHash == hash and type(model) == 'string' and model ~= '' then
                        return model:lower()
                    end
                end
            end
        end
    end

    if bridgeUp() then
        local ok, name = pcall(function()
            return exports.rs_bridge:GetVehicleModelName(hash)
        end)
        if ok and type(name) == 'string' and name ~= '' then return name:lower() end
    end
    return nil
end

-- Returns 'qbox' | 'qbcore' | 'esx' | nil
function RSHUDBridge.Framework()
    if not bridgeUp() then return nil end
    local ok, framework = pcall(function() return exports.rs_bridge:GetFramework() end)
    if ok and framework and framework ~= 'standalone' then return framework end
    return nil
end


-- Is the player dead or bleeding out?
--
-- This cannot be answered from entity health. qbx_medical sets the ped to
-- FULL health on death (client/dead.lua) and to 150 in laststand
-- (client/laststand.lua), precisely so GTA does not kill and respawn the ped
-- while the medical system runs its own bleed-out timer. A HUD that trusts
-- GetEntityHealth therefore reports 100% over a corpse -- which is exactly
-- what it used to do here.
--
-- rs_bridge answers it properly for Qbox, QBCore and ESX alike.
---@return boolean
function RSHUDBridge.IsPlayerDownOrDead()
    if bridgeUp() then
        local ok, dead = pcall(function() return exports.rs_bridge:IsPlayerDead() end)
        if ok and dead == true then return true end

        local ok2, down = pcall(function() return exports.rs_bridge:IsPlayerDown() end)
        if ok2 and down == true then return true end
    end

    -- Native Qbox fallback works even when the QB compatibility bridge is off.
    if GetResourceState('qbx_core') == 'started' then
        local okData, data = pcall(function() return exports.qbx_core:GetPlayerData() end)
        local metadata = okData and data and data.metadata or nil
        if type(metadata) == 'table' then
            if metadata.isdead == true or metadata.inlaststand == true then return true end
        end
    end

    -- Direct QB/Qbox compatibility fallback.
    local okCore, core = pcall(function() return exports['qb-core']:GetCoreObject() end)
    if okCore and core and core.Functions and core.Functions.GetPlayerData then
        local okData, data = pcall(function() return core.Functions.GetPlayerData() end)
        local metadata = okData and data and data.metadata or nil
        if type(metadata) == 'table' then
            if metadata.isdead == true or metadata.inlaststand == true then return true end
        end
    end

    return IsEntityDead(PlayerPedId())
end

RSHUDBridge.Core = {
    Functions = {
        GetPlayerData = function()
            if not bridgeUp() then return {} end
            local ok, data = pcall(function() return exports.rs_bridge:GetPlayerData() end)
            return ok and data or {}
        end,
        TriggerCallback = function(name, cb, ...)
            if not bridgeUp() then if cb then cb(nil) end return nil end
            return exports.rs_bridge:TriggerServerCallback(name, cb, ...)
        end,
        Notify = function(message, notifyType, duration)
            if not bridgeUp() then return false end
            return exports.rs_bridge:Notify(message, notifyType, duration)
        end
    }
}
