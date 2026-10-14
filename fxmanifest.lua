fx_version 'cerulean'
game 'gta5'
name 'rs-lilhudlife'
author 'Reality Sucks RP'
description 'RS HUDLife V4.5 - live equalizer mic, voice range meter, neon menu, NOS controls, and ten speedometers'
version '1.4.3'

shared_script 'config.lua'

client_scripts {
    'bridge/client.lua',
    'client/main.lua'
}

server_script 'server/main.lua'

-- Optional: rs_bridge is preferred when present, but direct Qbox/QBCore/ESX
-- fallbacks keep money/job/status auto-detection working without it.

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/rs-uiscale.js',
    'html/css/style.css',
    'html/css/menu-v136.css',
    'html/css/menu-v137.css',
    'html/js/app.js',
    'html/js/boot.js',
    'html/js/speedo.js',
    'html/js/status.js',
    'html/js/money.js',
    'html/js/menu.js',
    'html/sounds/*.ogg',
    'html/assets/*.png',
    'html/assets/icons/*.png',
    'html/assets/icons/README.txt',
    'html/assets/vehicles/*.png',
    'html/assets/vehicles/*.webp',
    'html/assets/vehicles/README.txt'
}
