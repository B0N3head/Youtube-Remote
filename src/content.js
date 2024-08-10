console.log(`[Youtube Remote v${chrome.runtime.getManifest().version}]`);

// Compatible with YouTube NonStop 0.9.2
// Thx lawfx for the awesome extension <3

// Generate a random 6 char ID
const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
let result = "";
for (let i = 0; i < 6; i++)
    result += chars.charAt(Math.floor(Math.random() * chars.length));

// "inject" yt_remote script
const ytRemoteScript = document.createElement('script');
ytRemoteScript.id = result;
ytRemoteScript.className = 'ytRemoteScript';
ytRemoteScript.src = chrome.runtime.getURL('yt_remote.js');
(document.head || document.documentElement).appendChild(ytRemoteScript);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getID')
        sendResponse({ peerID: result.toUpperCase() });
});