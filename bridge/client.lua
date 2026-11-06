-- RS HUDLife's internal framework and vehicle adapter.
-- No external compatibility resource is needed.
RSHUDBridge = RSHUDBridge or {}

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
-- Read the owning framework's metadata/state and use ped state as fallback.
---@return boolean
function RSHUDBridge.IsPlayerDownOrDead()
    -- Qbox's documented client data is QBX.PlayerData (when imported).
    -- HUDLife's internal server snapshot also covers Qbox without that import.
    if GetResourceState('qbx_core') == 'started' then
        local data = RSHUDBridge.QboxPlayerData
        if type(QBX) == 'table' and type(QBX.PlayerData) == 'table' and next(QBX.PlayerData) then
            data = QBX.PlayerData
        end
        local metadata = type(data) == 'table' and data.metadata or nil
        if type(metadata) == 'table' then
            if metadata.isdead == true or metadata.inlaststand == true then return true end
        end
        if LocalPlayer and LocalPlayer.state then
            if LocalPlayer.state.isDead == true or LocalPlayer.state.inLaststand == true then return true end
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

