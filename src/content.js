console.log(`[Youtube Remote v${chrome.runtime.getManifest().version}]`);

// Compatible with YouTube NonStop 0.9.2
// Thx lawfx for the awesome extension <3

// Generate a random 6 char ID
const chars = "abcdefghjklmnopqrstuvwxyz";
let result = "";
for (let i = 0; i < 6; i++)
    result += chars.charAt(Math.floor(Math.random() * chars.length));

// "inject" Toastify js 1.12.0
var toastifyJS = document.createElement('style');
toastifyJS.innerHTML = ".toastify{padding:12px 20px;color:#fff;display:inline-block;box-shadow:0 3px 6px -1px rgba(0,0,0,.12),0 10px 36px -4px rgba(77,96,232,.3);background:-webkit-linear-gradient(315deg,#73a5ff,#5477f5);background:linear-gradient(135deg,#73a5ff,#5477f5);position:fixed;opacity:0;transition:all .4s cubic-bezier(.215, .61, .355, 1);border-radius:2px;cursor:pointer;text-decoration:none;max-width:calc(50% - 20px);z-index:2147483647}.toastify.on{opacity:1}.toast-close{background:0 0;border:0;color:#fff;cursor:pointer;font-family:inherit;font-size:1em;opacity:.4;padding:0 5px}.toastify-right{right:15px}.toastify-left{left:15px}.toastify-top{top:-150px}.toastify-bottom{bottom:-150px}.toastify-rounded{border-radius:25px}.toastify-avatar{width:1.5em;height:1.5em;margin:-7px 5px;border-radius:2px}.toastify-center{margin-left:auto;margin-right:auto;left:0;right:0;max-width:fit-content;max-width:-moz-fit-content}@media only screen and (max-width:360px){.toastify-left,.toastify-right{margin-left:auto;margin-right:auto;left:0;right:0;max-width:fit-content}}";
(document.head || document.documentElement).appendChild(toastifyJS);

// Listen for messages from the web page
window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data.type && event.data.type === "YTWebpage") {
        chrome.runtime.sendMessage({ message: event.data.payload, recipient: "background" });
    }
});

// Listen for messages from background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "WEBPAGE_MESSAGE") {
        console.log("Message from web page via background:", request.message);
    } else if (request.type === "POPUP_MESSAGE") {
        console.log("Message from popup via background:", request.message);
    } else if (request.type === "OPTIONS_MESSAGE") {
        console.log("Message from options via background:", request.message);
    }
});

// Send a message to the web page
const sendMessageToWebPage = (message) => {
    window.postMessage({ type: "FROM_CONTENT", payload: message }, "*");
};


// "inject" yt_remote script
const ytRemoteScript = document.createElement('script');
ytRemoteScript.id = result;
ytRemoteScript.className = 'ytRemoteScript';
ytRemoteScript.src = chrome.runtime.getURL('yt_remote.js');
(document.head || document.documentElement).appendChild(ytRemoteScript);


// Watch for our popup.js to call for our ID
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getID')
        sendResponse({ peerID: result.toUpperCase() });
});