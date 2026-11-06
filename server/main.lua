-- ============================================================
-- RS HUDLIFE V4 - SERVER
-- Reality Sucks RP
-- ============================================================

local resourceName = GetCurrentResourceName()
local version = '1.4.4'
local moneyModeRequests = {}
local MONEY_MODE_COOLDOWN_MS = 1500

AddEventHandler('onResourceStart', function(resource)
    if resource == resourceName then
        print('^5[RS-HUDLIFE]^7 V4 loaded (' .. version .. ')')
        print('^5[RS-HUDLIFE]^7 Reality Sucks RP')
    end
end)

local function configuredCashItem()
    local configured = Config and Config.Money and Config.Money.CashItem
    if type(configured) == 'string' then
        configured = configured:lower()
        if configured ~= '' and configured ~= 'auto' then return configured end
    end
    return nil
end

local function configuredMoneyMode()
    local money = Config and Config.Money or {}
    if money.CashAsItem == true then return true end
    if money.CashAsItem == false then return false end
    return nil
end

local function oxAccountItem()
    local raw = GetConvar('inventory:accounts', '["money"]')
    local ok, accounts = pcall(json.decode, raw)
    if not ok or type(accounts) ~= 'table' then
        return nil
    end

    local configured = configuredCashItem()
    local found = {}
    for _, account in pairs(accounts) do
        if type(account) == 'string' and account ~= '' then
            found[account:lower()] = true
        end
    end

    if configured and found[configured] then return configured end
    if found.money then return 'money' end
    if found.cash then return 'cash' end
    return nil
end

local function qbInventoryCashMode()
    if GetResourceState('qb-inventory') ~= 'started' then return nil end

    local okMode, cashAsItem = pcall(function()
        return exports['qb-inventory']:IsCashAsItem()
    end)
    if not okMode then return nil end

    local itemName = configuredCashItem() or 'cash'
    local okName, providerItem = pcall(function()
        return exports['qb-inventory']:GetCashItemName()
    end)
    if okName and type(providerItem) == 'string' and providerItem ~= '' then
        itemName = providerItem:lower()
    end

    return cashAsItem == true, itemName
end

local function detectMoneyMode()
    local forcedMode = configuredMoneyMode()
    local configuredItem = configuredCashItem()

    -- Explicit framework-cash always wins. This is useful when an inventory
    -- resource is running for items but the server intentionally keeps cash in
    -- the framework account table.
    if forcedMode == false then
        return false, configuredItem or 'cash', 'config'
    end

    local qbCashAsItem, qbItem = qbInventoryCashMode()
    local oxStarted = GetResourceState('ox_inventory') == 'started'
    local oxItem = oxStarted and oxAccountItem() or nil

    if forcedMode == true then
        -- If the owner forces physical cash but leaves CashItem='auto', still
        -- resolve the provider's real item name instead of silently assuming
        -- `cash` (standard Qbox/ox_inventory uses `money`).
        if configuredItem then return true, configuredItem, 'config' end
        if qbCashAsItem == true then return true, qbItem or 'cash', 'qb-inventory' end
        if oxItem then return true, oxItem, 'ox_inventory' end
        return true, qbItem or 'cash', 'config'
    end

    -- Auto mode uses positive provider proof. If both inventory resources happen
    -- to be running, an explicit qb-inventory physical-cash contract takes
    -- priority; otherwise a configured ox_inventory account can still win over
    -- an unrelated/legacy qb-inventory resource left started on the server.
    if qbCashAsItem == true then
        return true, qbItem or 'cash', 'qb-inventory'
    end
    if oxItem then
        return true, oxItem, 'ox_inventory'
    end

    if GetResourceState('qb-inventory') == 'started' then
        return false, qbItem or configuredItem or 'cash', 'qb-inventory'
    end
    if oxStarted then
        return false, configuredItem or 'cash', 'ox_inventory'
    end

    return false, configuredItem or 'cash', 'framework'
end

RegisterNetEvent('rs-lilhudlife:server:requestMoneyMode', function()
    local src = source
    if type(src) ~= 'number' or src <= 0 then return end

    local now = GetGameTimer()
    local last = moneyModeRequests[src] or -MONEY_MODE_COOLDOWN_MS
    if now >= last and now - last < MONEY_MODE_COOLDOWN_MS then return end
    moneyModeRequests[src] = now

    local cashAsItem, itemName, provider = detectMoneyMode()
    TriggerClientEvent('rs-lilhudlife:client:setMoneyMode', src, cashAsItem, itemName, provider)
end)

AddEventHandler('playerDropped', function()
    moneyModeRequests[source] = nil
end)

-- Independent Qbox player-data adapter. The client cannot call a documented
-- qbx_core:GetPlayerData export without importing Qbox's framework module.
-- Serve a minimal read-only HUD snapshot from the authoritative server player.
-- The caller cannot select a target ID or mutate framework money/inventory.
local qboxDataRequests = {}
local QBOX_DATA_COOLDOWN_MS = 1500

RegisterNetEvent('rs-lilhudlife:server:requestQboxPlayerData', function(requestToken)
    local src = source
    if type(src) ~= 'number' or src <= 0 then return end
    if type(requestToken) ~= 'number' or requestToken < 1 or requestToken > 1000000000 then return end
    if requestToken % 1 ~= 0 then return end
    if GetResourceState('qbx_core') ~= 'started' then return end

    local now = GetGameTimer()
    local last = qboxDataRequests[src]
    if last and now >= last and now - last < QBOX_DATA_COOLDOWN_MS then return end
    qboxDataRequests[src] = now

    local ok, player = pcall(function() return exports.qbx_core:GetPlayer(src) end)
    local data = ok and player and player.PlayerData
    if type(data) ~= 'table' then return end -- character not selected yet

    local metadata = type(data.metadata) == 'table' and data.metadata or {}
    local money = type(data.money) == 'table' and data.money or {}
    TriggerClientEvent('rs-lilhudlife:client:qboxPlayerData', src, {
        money = { cash = tonumber(money.cash) or 0, bank = tonumber(money.bank) or 0 },
        job = type(data.job) == 'table' and data.job or {},
        metadata = {
            isdead = metadata.isdead == true,
            inlaststand = metadata.inlaststand == true,
            hunger = metadata.hunger,
            thirst = metadata.thirst,
            stress = metadata.stress,
            nos = metadata.nos,
        },
    }, requestToken)
end)

AddEventHandler('playerDropped', function()
    qboxDataRequests[source] = nil
end)
