import { readdir } from "node:fs/promises";
import fs from 'fs';

import DiscordRPC from "@xhayper/discord-rpc";
import SteamID from "steamid";
import fetch from "node-fetch";
import LogUpdate from "log-update";

// ==================== Configuration Settings =====================
// Steam user identification

// You'll need to find your own SteamID64 URL using https://steamrep.com
// Note: This also allows custom URLs like https://steamcommunity.com/id/crementif but they require providing a valid web key.
const steamProfileURL = "https://steamcommunity.com/profiles/76561198034348102";

// ONLY needs to be replaced if you use a custom URL in the steamProfileURL variable above. There's no real benefit!
// You can get one from https://steamcommunity.com/dev/apikey. Use localhost as the domain name.
const steamWebKey = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

// Advanced Configuration Settings
const pollRate = 20*1000; // Poll Steam Rich Presence every n seconds. You should keep this at or above 20 seconds.
const discordClientId = "433731243516100629"; // Keep this id unless you want to supply your own application id.

// =================================================================
// Initialize Status Variables
let gameStatus = "";
let discordStatus = "logging in";
let steamStatus = "obtaining user id";
let debugLine = "";
let currSpinFrame = 0;

// Initialize Discord Objects
const discordRPCClient = new DiscordRPC.Client({
    clientId: discordClientId,
    transport: "ipc"
});

// Setup discord RPC
discordRPCClient.on("ready", () => {
    discordStatus = "connected (IPC)";
    renderWindow();
});

discordRPCClient.on("error", (err, message) => {
    discordStatus = `error ${err}: ${message}`;
    renderWindow();
});

// =================================================================
// Logging
function renderWindow() {
    const spinFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    currSpinFrame++;
    if(currSpinFrame === 10) currSpinFrame = 0;

    LogUpdate(
        `Steam: ${!steamStatus.startsWith("connected") ? steamStatus+spinFrames[currSpinFrame] : steamStatus}\n` +
        `Discord: ${discordStatus === "connected (IPC)" ? discordStatus : spinFrames[currSpinFrame]}\n` +
        `Game: ${gameStatus}\n` +
        `\n` +
        `> ${debugLine}\n`
    );
}

// =================================================================
// SteamRPC Logic
async function getSteamUserId() {
    if(steamProfileURL.startsWith("https://steamcommunity.com/profiles/")) {
        return new SteamID(steamProfileURL.split("profiles/")[1].split("/")[0]);
    }

    if(steamProfileURL.startsWith("https://steamcommunity.com/id/")) {
        let res = await fetch(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${steamWebKey}&vanityurl=${steamProfileURL.split("id/")[1].split("/")[0]}`);
        if(res.ok) {
            let resJson = await res.json();
            if (resJson.response.success === 1)
                return new SteamID(resJson.response.steamid);
        }
    }
}

async function updateResources(folder) {
    let res = await fetch(`https://raw.githubusercontent.com/angelolz1/SteamRPC/master/profiles/${folder}/resources.json`);
    if(res.ok) {
        let resJson = await res.json();
        fs.writeFileSync(`./profiles/${folder}/resources.json`, JSON.stringify(resJson));
    }
}

async function loadProfiles() {
    let profiles = {};
    let profileFolders = (await readdir("profiles")).filter((folder) => folder !== "ExampleProfile");

    for (const folder of profileFolders) {
        let profile = await import(`./profiles/${folder}/index.js`);

        if(typeof profile.title != "string")
            throw new Error("Exported 'title' couldn't be found or isn't a valid string type!")

        if(typeof profile.appID != "number")
            throw new Error("Exported 'appID' couldn't be found or isn't a valid number type!");

        if(typeof profile.translateSteamPresence != "function")
            throw new Error("Exported 'translateSteamPresence' function couldn't be found or isn't a valid function type!");

        if(profiles.hasOwnProperty(profile.appID))
            throw new Error(`Found two profiles that export the same appID ${profile.appID}! Make sure to change the appID variable in each profile!`);

        debugLine = `[${Object.keys(profiles).length}/${profileFolders.length}] Loading '${folder}'...`;
        await updateResources(folder);
        profiles[profile.appID] = profile;
        renderWindow();
    }

    debugLine = `Finished loading ${Object.keys(profiles).length} profile(s), waiting for Steam Rich Presence events...`;

    return profiles;
}

async function pollSteamPresence(steamUserId, profiles) {
    // todo: Is there a way to find/create the Join Game button on the user's profile page, eg steam://joinlobby/1938090/109775241047500448/76561198259089872
    let res = await fetch(`https://steamcommunity.com/miniprofile/${steamUserId.getSteam3RenderedID().substring(5, 5+9)}/json?appid=undefined`, {headers: {"X-Requested-With": "XMLHttpRequest"}});

    if(!res.ok) {
        gameStatus = "";
        steamStatus = `Error ${res.status} while fetching status: ${res.statusText}`;
        renderWindow();
        return;
    }

    let resJson = await res.json();
    steamStatus = "connected";
    gameStatus = "";

    if(!resJson.in_game) {
        await discordRPCClient.user?.clearActivity();
        debugLine = `Loaded ${Object.keys(profiles).length} profiles, waiting for Steam Rich Presence events...`;
        return;
    }

    gameStatus = `${resJson.in_game.name} (no Rich Presence available)`;
    if (resJson.in_game?.logo && resJson.in_game?.rich_presence) {
        let curr_appid = resJson.in_game.logo.split("/apps/")[1].split("/")[0];
        let curr_rpc = resJson.in_game.rich_presence;
        debugLine = "Current Steam RPC Status: " + resJson.in_game.rich_presence;

        if (profiles.hasOwnProperty(curr_appid)) {
            let profile = profiles[curr_appid];
            let translatedDiscordRPC = profile.translateSteamPresence(curr_rpc, discordRPCClient);
            gameStatus = profile.title;

            if (typeof translatedDiscordRPC !== "object")
                throw new Error(`Profile returned '${typeof translatedDiscordRPC}' instead of an object.`);

            await discordRPCClient.user?.setActivity(translatedDiscordRPC);
        }
    }

    renderWindow();
}

// =================================================================
// Start each component

let loadingPrint = setInterval(renderWindow, 0.5*1000);
let [steamUserId, profiles] = await Promise.all([getSteamUserId(), loadProfiles()]);
clearInterval(loadingPrint);

if(Object.keys(profiles).length <= 0)
    throw new Error("No profiles were found inside the /profiles directory!");

if(steamUserId === undefined)
    throw new Error("Failed to obtain user id from steamProfileURL variable. It should be set to either https://steamcommunity.com/id/crementif or https://steamcommunity.com/profiles/76561198259089872.");

steamStatus = `Using Steam User ID ${steamUserId.getSteamID64()}`;

renderWindow();
await pollSteamPresence(steamUserId, profiles);
setInterval(pollSteamPresence, pollRate, steamUserId, profiles);

discordRPCClient.login();
