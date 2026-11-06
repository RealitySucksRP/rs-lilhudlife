fx_version 'cerulean'
game 'gta5'
name 'rs-lilhudlife'
author 'Reality Sucks RP'
description 'RS HUDLife - modular weapon HUD, status rings, vehicle telemetry and ten speedometers'
version '1.4.6'

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
    'html/css/weapon.css',
    'html/js/app.js',
    'html/js/vehicle-art-index.js',
    'html/js/boot.js',
    'html/js/speedo.js',
    'html/js/status.js',
    'html/js/money.js',
    'html/js/weapon.js',
    'html/js/menu.js',
    'html/sounds/*.ogg',
    'html/assets/*.png',
    'html/assets/icons/*.png',
    'html/assets/icons/README.txt',
    'html/assets/vehicles/*.png',
    'html/assets/vehicles/*.webp'
}
