RS-HUDLIFE V4 - SOUND FILES
===========================

Drop your own .ogg audio files in this directory, named exactly:

    boot_start.ogg          - Platform materializes (~400ms ideal)
    hologram_appear.ogg     - Vehicle wireframe rises into view (~800ms)
    hologram_collapse.ogg   - Hologram compresses into speedo (~700ms)
    hud_ready.ogg           - Speedometer locked in (~400ms short beep)
    menu_open.ogg           - Settings menu opens
    menu_close.ogg          - Settings menu closes
    menu_select.ogg         - Menu option clicked


AUDIO SOURCE IDEAS
------------------
Free sci-fi UI sound libraries:
- freesound.org (search: "hologram", "power up", "sci-fi ui")
- zapsplat.com (free with account)
- mixkit.co (royalty free)
- soundbible.com

Or generate with AI:
- elevenlabs.io sound effects generator
- stability.ai stable audio


SETTING YOUR OWN FILENAMES
--------------------------
Edit config.lua and change the filenames under:
    Config.Sound.Files

SWITCHING TO NATIVE GTA SOUNDS
------------------------------
Don't want to provide .ogg files? Edit config.lua:
    Config.Sound.UseCustomSounds = false

This will use native GTA sounds via PlaySoundFrontend instead.
The native sound mappings are in config.lua under Config.Sound.Native.
