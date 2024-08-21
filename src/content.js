// Compatible with YouTube NonStop 0.9.2
// Thx lawfx for the awesome extension and inspiration to make this <3
console.log(`[Youtube Remote v${chrome.runtime.getManifest().version}]`);
let ytRemote = null;

// "inject" Toastify css 1.12.0
var toastifyJS = document.createElement('style');
toastifyJS.innerHTML = ".toastify{padding:12px 20px;color:#fff;display:inline-block;box-shadow:0 3px 6px -1px rgba(0,0,0,.12),0 10px 36px -4px rgba(77,96,232,.3);background:-webkit-linear-gradient(315deg,#73a5ff,#5477f5);background:linear-gradient(135deg,#73a5ff,#5477f5);position:fixed;opacity:0;transition:all .4s cubic-bezier(.215, .61, .355, 1);border-radius:2px;cursor:pointer;text-decoration:none;max-width:calc(50% - 20px);z-index:2147483647}.toastify.on{opacity:1}.toast-close{background:0 0;border:0;color:#fff;cursor:pointer;font-family:inherit;font-size:1em;opacity:.4;padding:0 5px}.toastify-right{right:15px}.toastify-left{left:15px}.toastify-top{top:-150px}.toastify-bottom{bottom:-150px}.toastify-rounded{border-radius:25px}.toastify-avatar{width:1.5em;height:1.5em;margin:-7px 5px;border-radius:2px}.toastify-center{margin-left:auto;margin-right:auto;left:0;right:0;max-width:fit-content;max-width:-moz-fit-content}@media only screen and (max-width:360px){.toastify-left,.toastify-right{margin-left:auto;margin-right:auto;left:0;right:0;max-width:fit-content}}";
(document.documentElement || document.head).appendChild(toastifyJS);

const scriptInject = (_script, _className) => {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = _script;
        if (_className)
            script.className = _className;
        script.addEventListener('load', resolve);
        script.addEventListener('error', e => reject(e.error, _className));
        (document.documentElement || document.head).appendChild(script);
        resolve(script);
    });
}

const notifyRemote = () => {
    chrome.storage.local.get(['YTRemoteIsLocalConnectionOnly']).then((value) => {
        if (Object.keys(value).length == 1)
            window.postMessage({ type: "ytrGlobalResponse", info: value.YTRemoteIsLocalConnectionOnly });
        else // Do not allow remote connections if the value has never been set
            window.postMessage({ type: "ytrGlobalResponse", info: false });
    });
}

chrome.storage.local.onChanged.addListener(notifyRemote); // Fires notifyRemote on change

// Fires on ytRemote request
window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data.type && event.data.type === "ytrGlobalRequest")
        notifyRemote();
});

// INJECT ALL THE SCRIPTS
scriptInject(chrome.runtime.getURL('libs/toastifyjs.js'), "toastifyjs").then(() => {
    scriptInject(chrome.runtime.getURL('libs/md5.js'), "md5js").then(() => {
        scriptInject(chrome.runtime.getURL('libs/peerjs.js'), "peerjs").then(() => {
            scriptInject(chrome.runtime.getURL('libs/ytRemote.js'), "ytremotescript").then((ytRemoteCreated) => {
                ytRemote = ytRemoteCreated;
                // Watch for our popup.js to call for our ID (only run if we have injected ytRemote)
                chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                    if (message.action === 'getID')
                        sendResponse({ peerID: ytRemote.id.toUpperCase() });
                });
            }).catch(error => console.error(`${_className} failed to inject into page:\n${error}`));
        }).catch(error => console.error(`${_className} failed to inject into page:\n${error}`));
    }).catch(error => console.error(`${_className} failed to inject into page:\n${error}`));
}).catch(error => console.error(`${_className} failed to inject into page:\n${error}`));