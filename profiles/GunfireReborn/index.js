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

    else {
        let match = steamRichPresence.match(playingRegex);

        if(match[1] == null || match[2] == null) //means they're in a vault
        {
            let mapName;
            switch (steamRichPresence) {
                case "Inconspicuous Grave":
                    mapName = "Longling Tomb";
                    break;
                case "Act 2 Vault Name": //TODO
                    mapName = "Anxi Desert";
                    break;
                case "Act 3 Vault Name": //TODO
                    mapName = "Duo Fjord";
                    break;
                case "Act 4 Vault Name": //TODO
                    mapName = "Hyperborean Jokul";
                    break;
                default:
                    mapName = steamRichPresence;
            }

            discordRichPresence.state = mapName + " - In Vault";

            let map = resources.maps.find(e => e.name === mapName);
            if(map !== undefined) {
                discordRichPresence.largeImageKey = map.imageURL;
                discordRichPresence.largeImageText = steamRichPresence;
            }
        }

        else {
            discordRichPresence.state = `${match[1]} - ${match[2]}`

            let map = resources.maps.find(e => e.name === match[1]);
            if(map !== undefined) {
                discordRichPresence.largeImageKey = map.imageURL;
                discordRichPresence.largeImageText = match[2];
            }
        }
    }

    return discordRichPresence;
}
