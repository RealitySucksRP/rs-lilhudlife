fx_version 'cerulean'
game 'gta5'
name 'rs-lilhudlife'
author 'Reality Sucks RP'
description 'RS HUDLife - all-weapon holographic HUD, inventory reserve ammo, status rings, NOS and 25 speedometers with drift balance, 3D bounce & polished menu UI'
version '1.4.18'

shared_script 'config.lua'

client_scripts {
    'bridge/client.lua',
    'client/main.lua'
}

server_script 'server/main.lua'

-- Frameworks are detected at runtime; no external framework is mandatory.

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/rs-uiscale.js',
    'html/css/style.css',
    'html/css/menu-v136.css',
    'html/css/menu-v137.css',
    'html/css/menu-interactive.css',
    'html/css/weapon.css',
    'html/css/motion-v1413.css',
    'html/css/menu-orbit-v1414.css',
    'html/css/speedo-3d-v1417.css',
    'html/css/menu-polish-v1417.css',
    'html/js/app.js',
    'html/js/vehicle-art-index.js',
    'html/js/boot.js',
    'html/js/speedo.js',
    'html/js/speedo-3d-v1417.js',
    'html/js/status.js',
    'html/js/money.js',
    'html/js/weapon.js',
    'html/js/menu.js',
    'html/js/menu-interactive.js',
    'html/js/menu-orbit-v1414.js',
    'html/js/menu-polish-v1417.js',
    'html/sounds/*.ogg',
    'html/assets/*.png',
    'html/assets/icons/*.png',
    'html/assets/icons/README.txt',
    'html/assets/vehicles/*.png',
    'html/assets/vehicles/*.webp'
}
