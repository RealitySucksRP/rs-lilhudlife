Config = {}

-- Framework selection for money/job/status data.
-- 'auto' detects rs_bridge first, then Qbox/QBCore compatibility, ESX, and
-- finally falls back to standalone native HUD values.
Config.Framework = 'auto' -- 'auto', 'qbox', 'qbcore', 'esx', 'standalone'
Config.Enabled = true -- Per-player F9 master HUD switch starts enabled.

-- ============================================================
-- RS HUDLIFE Lil Hud - CONFIGURATION
-- Reality Sucks RP
-- ============================================================

-- ============================================================
-- GENERAL
-- ============================================================
Config.Speed = {
    Unit = 'MPH',               -- 'MPH' or 'KMH'
    MaxSpeed = 200,             -- Max speed on the gauge for MPH
    MaxSpeedKMH = 320,          -- Max speed on the gauge for KMH
}

Config.Menu = {
    Key = 'F9',                 -- Keybind to open the neon menu
    Description = 'Open RS HUDLife menu'
}

-- ============================================================
-- BOOT SEQUENCE
-- The cinematic holographic vehicle display that plays when
-- the player enters a vehicle of a different class or entity
-- ============================================================
Config.Boot = {
    Enabled = true,

    -- Triggers
    PlayOnFirstEntry = true,    -- Play on first vehicle entry of session
    PlayOnVehicleChange = true, -- Play when switching to different vehicle
    PlayOnClassChange = true,   -- Play when switching to different class

    -- Timing (in ms)
    PlatformFadeIn = 400,       -- Platform materialization duration
    RingsPulse = 600,           -- Concentric rings pulse-out duration
    HologramRise = 800,         -- Hologram rises and fades in
    HologramHold = 1600,        -- Hologram rotates in place
    HologramCollapse = 700,     -- Hologram compresses into speedo
    SpeedoFadeIn = 400,         -- Speedometer fades in

    -- Info shown around the hologram
    ShowVehicleName = true,
    ShowVehicleClass = true,
    ShowVehicleStats = true,    -- speed/acceleration/traction

    -- ============================================================
    -- REVEAL STYLE - clean transparent GTA vehicle profile
    -- HUD particle layer rendered INSIDE the boot overlay (NUI/HTML).
    -- Type options: 'smoke', 'embers', 'sparks', 'snow', 'dust', 'none'
    -- ============================================================
    Particles = {
        Enabled = true,
        Type    = 'smoke',
        Count   = 22,
        Color   = '',   -- CSS color string; empty = use built-in palette for Type
        Glow    = '',   -- CSS color string; empty = use built-in palette for Type
        Speed   = 1.0,  -- multiplier on drift duration (higher = slower drift)
    },

    -- Legacy compatibility value. The v1.2.3 reveal is fully transparent
    -- and does not render a scrim or spotlight.
    ScrimStrength = 0.72,

    -- ============================================================
    -- WORLD PTFX (v1.1.3) - real in-world GTA particle on the car.
    -- This is the actual exp_grd_grenade_smoke effect playing in the
    -- 3D world (not the HUD) on the player's vehicle during the boot.
    -- Set Enabled = false to turn it off entirely.
    -- ============================================================
    WorldPtfx = {
        Enabled   = true,
        Dict      = 'core',
        Name      = 'exp_grd_grenade_smoke',
        Scale     = 1.0,
        OffsetZ   = -0.6,    -- push the smoke down toward the wheels/ground
        Networked = false,   -- false = only the player sees their own reveal smoke
    },
}

-- ============================================================
-- SPEEDOMETER
-- V2 uses the Maximum Velocity Warning design
-- ============================================================
Config.Speedo = {
    -- Default layout for NEW players: halo, vehicle, apex, classic, neon, minimal,
    -- turbo, volt, survival, cluster
    -- (Each player can change this live in the F9 menu; their choice saves per-player.)
    Style = 'cluster',

    -- The all-in-one Survival Cluster carries its own live status readouts.
    -- Hide the separate status rings only while that cluster is visible in a vehicle.
    HideStandaloneStatusInCluster = true,

    -- Warning thresholds (as a fraction of MaxSpeed, 0.0-1.0)
    WarningThreshold = 0.75,    -- Speed readout shifts to the warning color
    CriticalThreshold = 0.90,   -- Flashing "velocity alert" banner

    -- ------------------------------------------------------------
    -- DEFAULT ON-SCREEN PLACEMENT (percent based, matches the F9 menu)
    -- These seed the position for players who have not customized it yet.
    -- Once a player moves the HUD in the F9 menu, their layout is saved
    -- per-player (KVP) and overrides these values.
    --   PosX = percent from the LEFT edge
    --   PosY = percent from the BOTTOM edge
    -- ------------------------------------------------------------
    PosX = 20,
    PosY = 4,
    Scale = 0.88,               -- compact default; player can resize in F9

    -- Legacy 9-zone fields (kept for reference; placement now uses PosX/PosY above)
    Position = 'bottom-center',
    Offset = { x = -300, y = 20 },

    -- Data updates
    UpdateInterval = 50,        -- ms between HUD updates (50 = 20fps data)
}

-- ============================================================
-- SOUND
-- All sound hooks. Drop your .ogg files in html/sounds/ and
-- reference them by filename (without extension).
--
-- Uses the NUI PlaySoundFrontend system by default.
-- Set UseCustomSounds = true if using a sound lib like xSound.
-- ============================================================
Config.Sound = {
    Enabled = true,
    UseCustomSounds = true,     -- true = play .ogg from html/sounds/
                                -- false = use GTA native PlaySoundFrontend

    Volume = 0.5,               -- 0.0 to 1.0

    -- Custom sound files (only used if UseCustomSounds = true)
    -- Drop files in html/sounds/ with matching names
    Files = {
        boot_start      = 'boot_start.ogg',      -- Platform materializes
        hologram_appear = 'hologram_appear.ogg', -- Vehicle hologram rises
        hologram_collapse = 'hologram_collapse.ogg', -- Hologram collapses
        hud_ready       = 'hud_ready.ogg',       -- Speedometer locked in
        menu_open       = 'menu_open.ogg',       -- Menu opens
        menu_close      = 'menu_close.ogg',      -- Menu closes
        menu_select     = 'menu_select.ogg',     -- Menu item selected
    },

    -- Native GTA sound fallback (if UseCustomSounds = false)
    -- Format: { soundName = 'NAME', soundSet = 'SET' }
    Native = {
        boot_start      = { soundName = 'Zoom_In', soundSet = 'DLC_HEIST_PLANNING_BOARD_SOUNDS' },
        hologram_appear = { soundName = 'Sticky_Bomb_Active_Beep', soundSet = 'GTAO_FM_Events_Soundset' },
        hologram_collapse = { soundName = 'CLICK_BACK', soundSet = 'WEB_NAVIGATION_SOUNDS_PHONE' },
        hud_ready       = { soundName = 'Nav_Up_Down', soundSet = 'GTAO_STORE_SOUNDSET' },
        menu_open       = { soundName = 'Zoom_In', soundSet = 'DLC_HEIST_PLANNING_BOARD_SOUNDS' },
        menu_close      = { soundName = 'Zoom_Out', soundSet = 'DLC_HEIST_PLANNING_BOARD_SOUNDS' },
        menu_select     = { soundName = 'SELECT', soundSet = 'HUD_FRONTEND_DEFAULT_SOUNDSET' },
    }
}

-- ============================================================
-- VEHICLE CLASS TO HOLOGRAM MAPPING
-- Maps FiveM vehicle class IDs (GetVehicleClass) to hologram shapes.
-- 7 hologram shapes are built into the UI: car, motorcycle, bicycle,
-- helicopter, plane, boat, truck.
-- ============================================================
Config.ClassHolograms = {
    [0]  = 'car',         -- Compacts
    [1]  = 'car',         -- Sedans
    [2]  = 'car',         -- SUVs
    [3]  = 'car',         -- Coupes
    [4]  = 'car',         -- Muscle
    [5]  = 'car',         -- Sports Classics
    [6]  = 'car',         -- Sports
    [7]  = 'car',         -- Super
    [8]  = 'motorcycle',  -- Motorcycles
    [9]  = 'truck',       -- Off-road
    [10] = 'truck',       -- Industrial
    [11] = 'truck',       -- Utility
    [12] = 'car',         -- Vans
    [13] = 'bicycle',     -- Cycles
    [14] = 'boat',        -- Boats
    [15] = 'helicopter',  -- Helicopters
    [16] = 'plane',       -- Planes
    [17] = 'truck',       -- Service
    [18] = 'truck',       -- Emergency
    [19] = 'truck',       -- Military
    [20] = 'truck',       -- Commercial
    [21] = 'truck',       -- Trains
    [22] = 'car',         -- Open Wheel
}

-- Class display names (shown in boot cinematic)
Config.ClassNames = {
    [0]  = 'COMPACT',
    [1]  = 'SEDAN',
    [2]  = 'SUV',
    [3]  = 'COUPE',
    [4]  = 'MUSCLE',
    [5]  = 'CLASSIC',
    [6]  = 'SPORTS',
    [7]  = 'SUPERCAR',
    [8]  = 'MOTORCYCLE',
    [9]  = 'OFF-ROAD',
    [10] = 'INDUSTRIAL',
    [11] = 'UTILITY',
    [12] = 'VAN',
    [13] = 'BICYCLE',
    [14] = 'BOAT',
    [15] = 'HELICOPTER',
    [16] = 'PLANE',
    [17] = 'SERVICE',
    [18] = 'EMERGENCY',
    [19] = 'MILITARY',
    [20] = 'COMMERCIAL',
    [21] = 'TRAIN',
    [22] = 'OPEN WHEEL',
}

-- ============================================================
-- STATUS RINGS (Health, Armor, Hunger, Thirst, Stamina)
-- Universal bridge-ready status HUD. Native GTA health/armor/stamina
-- always works, and hunger/thirst can match QBCore, ESX status,
-- statebags, exports, or custom standalone events.
-- ============================================================
Config.Status = {
    Enabled = true,

    -- ------------------------------------------------------------
    -- DEFAULT ON-SCREEN PLACEMENT (percent based, matches the F9 menu)
    -- Seeds the position for players who have not customized it yet;
    -- per-player layouts saved via the F9 menu override these.
    --   PosX = percent from the LEFT edge
    --   PosY = percent from the BOTTOM edge
    -- ------------------------------------------------------------
    PosX = 2,
    PosY = 18,

    -- Legacy 9-zone fields (kept for reference; placement now uses PosX/PosY above)
    Position = 'bottom-center',
    Offset = { x = 220, y = 20 },

    Shape = 'circle',               -- 'circle', 'diamond', 'hexagon', 'square'
    -- 'crystal', 'neon', 'mono', or 'vivid'
    -- Uploaded full-color PNG icons override the built-in icon art in every finish.
    -- 'vivid' = full-color 3D icons (hand+heart, vest, burger, bottle, wind, lungs)
    -- To use your OWN art instead, drop PNGs in html/assets/icons/ named
    -- health.png, armor.png, hunger.png, thirst.png, stamina.png, oxygen.png
    -- They are auto-detected and override the built-in icons for any style.
    IconStyle = 'vivid',
    Layout = 'horizontal',          -- 'horizontal', 'stacked', or 'compact'
    Scale = 0.88,                   -- menu limits this to 0.70 through 1.05

    -- Sync-hud style effects
    Glow = true,                    -- Colored outer halo around each ring
    LowPulse = true,                -- Pulse glow when value is low
    FadeWhenFull = false,           -- Fade rings back when at 100% (only light up when needed)
    DynamicColor = false,           -- Ring shifts color based on value (green->yellow->red as it drops)
    Opacity = 1.0,                  -- Overall ring opacity 0.3 to 1.0

    -- Per-ring toggles (turn any off individually)
    Show = {
        health  = true,
        armor   = true,
        hunger  = true,
        thirst  = true,
        stamina = true,
        oxygen  = false,            -- still appears automatically while underwater
        nos     = false,            -- still appears automatically in a NOS-equipped vehicle
    },

    -- Per-ring colors
    -- oxygen is auto-shown only while swimming underwater
    -- nos is auto-shown only when the vehicle has nitrous fitted
    Colors = {
        health  = '#ff3050',
        armor   = '#60a5fa',
        hunger  = '#ff9040',
        thirst  = '#00e0ff',
        stamina = '#fbbf24',
        oxygen  = '#40c8ff',
        nos     = '#ff4d4d',
    },

    -- Low-value threshold (percent)
    LowThreshold = 25,
}


-- ============================================================
-- UNIVERSAL HEALTH / STATUS BRIDGE
-- Keeps the HUD values matched to whatever health/status system
-- the server owner uses: QBCore, ESX status, statebags, exports,
-- ambulance/job scripts, or standalone custom scripts.
-- ============================================================
Config.HealthBridge = {
    Enabled = true,

    -- Auto mode means: use native GTA ped values for real health,
    -- armor, stamina, and oxygen, then also listen/poll the enabled
    -- framework/status sources below for hunger, thirst, stress, etc.
    Mode = 'auto', -- 'auto', 'native', 'qbcore', 'esx_status', 'statebag', 'exports', 'standalone'

    FrameworkDetectTimeout = 2500,
    NeedsPollInterval = 2000,

    -- Native values are the safest baseline because most medical/job
    -- systems eventually change the actual ped health/armor.
    Native = {
        Enabled = true,
        PollInterval = 500,
        Health = true,
        Armor = true,
        Stamina = true,
        Oxygen = true,
    },

    -- QBCore metadata support: hunger/thirst are normally stored here.
    -- Stress can be inverted into the stamina ring only if you want that.
    QBCore = {
        Enabled = true,
        Metadata = {
            hunger = 'hunger',
            thirst = 'thirst',
            stress = 'stress',
            nos = 'nos',             -- optional; ignored when your framework has no NOS metadata
        },
        StaminaFromStress = false,
    },

    -- ESX status support. esx_status usually sends values through
    -- esx_status:onTick. High values such as 1000000 are normalized.
    ESXStatus = {
        Enabled = true,
        Event = 'esx_status:onTick',
        StatusNames = {
            hunger = 'hunger',
            thirst = 'thirst',
            stress = 'stress',
        },
    },

    -- Statebag support for standalone or custom status resources.
    -- Example from another client script:
    --     LocalPlayer.state:set('hunger', 82, true)
    --     LocalPlayer.state:set('thirst', 74, true)
    StateBags = {
        Enabled = true,
        Keys = {
            health = 'health',
            armor = 'armor',
            hunger = 'hunger',
            thirst = 'thirst',
            stamina = 'stamina',
            stress = 'stress',
            oxygen = 'oxygen',
            nos = 'nos',
        },
        Invert = {
            stress = true,
        },
    },

    -- Export support for paid/free medical or status scripts.
    -- Turn this on and point it at your script if that script exposes
    -- current values. Each function should return 0-100, 0.0-1.0, or
    -- a high ESX-style value that can be normalized.
    Exports = {
        Enabled = false,
        Resource = 'your_health_resource',
        PayloadFunction = '', -- optional: one export returning { health=100, hunger=80, thirst=70 }
        Functions = {
            health = '',
            armor = '',
            hunger = '',
            thirst = '',
            stamina = '',
            oxygen = '',
            nos = '',
        },
    },

    -- Public events/exports for any standalone health system.
    -- Trigger these from your medical, bodyhealth, ambulance, prison,
    -- zombie, survival, or job script whenever values change.
    Events = {
        SetStatus = 'rs-lilhudlife:client:SetStatus',
        SetNeeds = 'rs-lilhudlife:client:SetNeeds',
        SetHealth = 'rs-lilhudlife:client:SetHealth',
        SetNOS = 'rs-lilhudlife:client:SetNOS',
        Refresh = 'rs-lilhudlife:client:RefreshStatus',

        -- After revive/heal events, the HUD re-pulls native/framework
        -- values so the rings do not stay stale.
        RefreshAfter = {
            'hospital:client:Revive',
            'hospital:client:HealInjuries',
            'qb-ambulancejob:client:Revive',
            'esx_ambulancejob:revive',
            'wasabi_ambulance:revive',
        }
    }
}

-- ============================================================
-- NOS / NITRO BRIDGE
-- The all-in-one cluster can read common vehicle state-bag/decorator names.
-- Any nitro resource can also push a live 0-100 value with:
--   TriggerEvent('rs-lilhudlife:client:SetNOS', percent)
--   exports['rs-lilhudlife']:SetNOS(percent)
-- or the universal SetStatus bridge using { nos = percent }.
-- ============================================================
Config.NOSBridge = {
    Enabled = true,
    Default = 0,
    Style = 'bottle',             -- 'bottle', 'neon', or 'mono'
    LowThreshold = 20,            -- warning threshold shown in the F9 menu

    -- Checked on Entity(vehicle).state first. Table payloads such as
    -- { amount = 50, max = 100 } and values in either 0-1 or 0-100 work.
    VehicleStateKeys = {
        'nos', 'nosLevel', 'nos_level', 'nosAmount', 'nos_amount',
        'nitro', 'nitroLevel', 'nitro_level', 'nitroAmount', 'nitro_amount',
        'nitroFuel', 'nitro_fuel', 'nitrous', 'nitrousLevel', 'nitrous_level',
        'nitrousAmount', 'nitrous_amount', 'boost', 'boostLevel', 'boost_level'
    },

    -- Some resources store the value on LocalPlayer.state instead of the vehicle.
    PlayerStateKeys = {
        'nos', 'nosLevel', 'nos_level', 'nitro', 'nitroLevel', 'nitro_level',
        'nitrous', 'nitrousLevel', 'nitrous_level', 'boost'
    },

    Decorators = {
        'nos', 'nosLevel', 'nos_level', 'nitro', 'nitroLevel', 'nitro_level',
        'nitrous', 'nitrousLevel', 'nitrous_level', 'boost'
    },

    -- Safe compatibility listeners. Official qb-mechanicjob uses the
    -- UpdateNitrous spelling and sends (level, hasNitro).
    EventAliases = {
        'hud:client:UpdateNitrous',
        'hud:client:UpdateNitro',
        'qb-hud:client:UpdateNitrous',
        'qb-hud:client:UpdateNitro',
        'qb-mechanicjob:client:UpdateNitrous',
        'nitro:client:UpdateLevel',
        'nitrous:client:UpdateLevel',
        'nos:client:UpdateLevel',
    },

    -- RealitySucksRP LS Customs is the primary NOS provider on this server.
    -- Its accepted baseline stores NOS as a special-part entitlement and exports
    -- HasNitrous/GetSpecialParts/GetVehicleProperties. Because it is not a
    -- consumable tank, an installed bottle displays as 100% unless a newer build
    -- provides an actual charge export/state value. Both resource names work.
    RSCustoms = {
        Enabled = true,
        Resources = { 'rs-lscustoms', 'rs-zombielscustoms' },
        PollInterval = 750,
        InstalledPercent = 100,
        HasExport = 'HasNitrous',
        SpecialPartsExport = 'GetSpecialParts',
        PropertiesExport = 'GetVehicleProperties',
        LevelExports = { 'GetNitrousLevel', 'GetNOSLevel', 'GetNosLevel', 'GetNitroLevel' },
        StateKeys = {
            'rsSpecialParts', 'rs_special_parts',
            'rs_lscustoms_special_parts', 'rs_zombielscustoms_special_parts',
            'rs_lscustoms_nitrous', 'rs_zombielscustoms_nitrous'
        },
    },

    -- Optional compatibility for servers that actually use qb-mechanicjob's
    -- separate nitrousVehicles table. Disabled here so it cannot overwrite the
    -- RS Customs bottle with a false 0% when the plate is absent from that table.
    QbMechanicjob = {
        Enabled = false,
        Resource = 'qb-mechanicjob',
        Callback = 'qb-mechanicjob:server:getnitrousVehicles',
        PollInterval = 1500,
        CallbackTimeout = 4000, -- release a stuck callback so polling can recover
    },

    -- ============================================================
    -- NOS DRAIN  --  you should not need to touch this
    --
    -- Most NOS scripts only tell us "this car HAS nitrous" - they never
    -- report how much is left. With only that, the ring would sit at
    -- 100% and never move. So the HUD works the charge out itself by
    -- watching the boost key.
    --
    -- It configures itself in this order, automatically:
    --
    --   1. If your NOS script publishes a real level (any of the
    --      LevelExports above, or a NOS statebag), that is used and
    --      everything below is ignored.
    --
    --   2. Otherwise the HUD finds your NOS/customs resource and reads
    --      the timings out of ITS OWN config file, so the drain matches
    --      whatever that server is actually set to. Works with
    --      rs-lscustoms, rs-zombielscustoms, or anyone else's script,
    --      with nothing to configure and no numbers kept in two places.
    --
    --   3. Only if both of those fail does it fall back to the values
    --      below.
    --
    -- Run  /nosdebug  in game to see which of the three is in use.
    -- ============================================================
    Simulate = {
        Enabled = true,
        AutoCalibrate = true,       -- read timings from the server's NOS script

        -- Last-resort fallbacks, used only if auto-calibration finds nothing.
        Control = 21,               -- boost key: 21 = LEFT SHIFT
        RequireAccelerate = true,   -- must also be holding W to burn
        MaxBurstMs = 4500,          -- how long a full bottle lasts (4.5s)
        CooldownMs = 2500,          -- how long it takes to refill (2.5s)
    },
}

-- ============================================================
-- MONEY + ID HUD
-- ============================================================
Config.Money = {
    Enabled = true,

    -- 'auto' asks the active provider whether framework cash is physically
    -- mirrored into inventory. For ox_inventory this reads the server's
    -- `inventory:accounts` convar instead of assuming every ox server uses a
    -- money item. Set true/false only when intentionally overriding detection.
    CashAsItem = 'auto',

    -- 'auto' uses the provider's authoritative item/account name (`money` on
    -- standard Qbox/ox_inventory, configurable cash item on supported QB
    -- inventories). Set a name here only for a custom physical-cash setup.
    CashItem = 'auto',

    -- 'glass', 'clean', 'neon', 'executive', or 'compact'
    Style = 'glass',

    -- ------------------------------------------------------------
    -- DEFAULT ON-SCREEN PLACEMENT (percent based, matches the F9 menu)
    -- Seeds the position for players who have not customized it yet;
    -- per-player layouts saved via the F9 menu override these.
    --   PosX = percent from the RIGHT edge
    --   PosY = percent from the TOP edge
    -- ------------------------------------------------------------
    PosX = 1,
    PosY = 1,

    -- Legacy 9-zone fields (kept for reference; placement now uses PosX/PosY above)
    Position = 'top-left',
    Offset = { x = 20, y = 20 },

    Scale = 1.0,

    -- Per-pill toggles
    Show = {
        server  = true,         -- Server name pill
        cash    = true,
        bank    = true,
        id      = true,         -- Player ID pill
        job     = true,         -- Job / rank pill
        voice   = true,         -- Live mic connection, talking and range pill
    },

    Voice = {
        Enabled = true,
        UpdateInterval = 120,   -- Talking indicator refresh in milliseconds
    },

    -- Server branding
    ServerName = 'REALITY SUCKS RP',

    -- Update interval in ms (how often to pull money/job from QBCore)
    UpdateInterval = 1000,
}

-- ============================================================
-- DEBUG
-- ============================================================
Config.Debug = false           -- Print debug info to client console
