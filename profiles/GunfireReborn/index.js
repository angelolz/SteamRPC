import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export const appID = 1217060;
export const title = "Gunfire Reborn";

const playingRegex = /^(.*)-(.*)|(.*)$/;

export function translateSteamPresence(steamRichPresence) {
    let dir = dirname(fileURLToPath(import.meta.url));
    let discordRichPresence = {};
    let resources = null;

    if(!fs.existsSync(dir + '/resources.json')) {
        return discordRichPresence;
    }

    resources = JSON.parse(fs.readFileSync(dir + '/resources.json'));
    discordRichPresence.largeImageKey = resources.cover;

    discordRichPresence.details = "Playing Gunfire Reborn";
    discordRichPresence.state = steamRichPresence;

    if(steamRichPresence.toLowerCase().includes("main menu")) {
        discordRichPresence.largeImageKey = resources.menu;
    }

    else if(steamRichPresence.toLowerCase().includes("in lobby")) {
        discordRichPresence.largeImageKey = resources.lobby;
    }

    else if(steamRichPresence.toLowerCase().includes("in game")) {
        discordRichPresence.largeImageKey = resources.in_game;
    }

    else {
        let match = steamRichPresence.match(playingRegex);

        if(match[1] == null || match[2] == null) //means they're in a vault or spiritual assault
        {
            let mapName;
            let isInVault = true;
            switch (steamRichPresence) {
                //vaults
                case "Inconspicuous Grave":
                    mapName = "Longling Tomb";
                    break;
                case "Desert Remains":
                    mapName = "Anxi Desert";
                    break;
                case "Shoreside Valley":
                    mapName = "Shanhai Twin Islands";
                    break;
                case "Snowy Fairyland": //unsure of this
                    mapName = "Hyperborean Jokul";
                    break;

                //maps in spiritual assault
                case "Mid Fjord":
                    mapName = "Shanhai Twin Islands";
                    isInVault = false;
                    break;
                case "Desert Frontier": //for some reason the game doesn't show this???
                    mapName = "Anxi Desert";
                    isInVault = false;
                    break;

                default:
                    mapName = steamRichPresence;
            }

            discordRichPresence.state = mapName + (isInVault ? " - In Vault" : "");

            let map = resources.maps.find(e => e.name === mapName);
            if(map !== undefined) {
                discordRichPresence.largeImageKey = map.imageURL;
                discordRichPresence.largeImageText = steamRichPresence;
            }
        }

        else {
            discordRichPresence.state = `${match[1].trim()} - ${match[2].trim()}`

            let map = resources.maps.find(e => e.name === match[1].trim());
            if(map !== undefined) {
                discordRichPresence.largeImageKey = map.imageURL;
                discordRichPresence.largeImageText = match[2];
            }
        }
    }

    return discordRichPresence;
}
