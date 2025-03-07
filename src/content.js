// Compatible with YouTube NonStop 0.9.2
// Thx lawfx for the awesome extension and inspiration to make this <3
console.log(`[Youtube Remote v${chrome.runtime.getManifest().version}]`);
let ytRemote = null;

// "inject" Toastify css v1.12.0
var toastifyJS = document.createElement('style');
toastifyJS.innerHTML = ".toastify{padding:12px 20px;color:#fff;display:inline-block;box-shadow:0 3px 6px -1px rgba(0,0,0,.12),0 10px 36px -4px rgba(77,96,232,.3);background:-webkit-linear-gradient(315deg,#73a5ff,#5477f5);background:linear-gradient(135deg,#73a5ff,#5477f5);position:fixed;opacity:0;transition:all .4s cubic-bezier(.215, .61, .355, 1);border-radius:2px;cursor:pointer;text-decoration:none;max-width:calc(50% - 20px);z-index:2147483647}.toastify.on{opacity:1}.toast-close{background:0 0;border:0;color:#fff;cursor:pointer;font-family:inherit;font-size:1em;opacity:.4;padding:0 5px}.toastify-right{right:15px}.toastify-left{left:15px}.toastify-top{top:-150px}.toastify-bottom{bottom:-150px}.toastify-rounded{border-radius:25px}.toastify-avatar{width:1.5em;height:1.5em;margin:-7px 5px;border-radius:2px}.toastify-center{margin-left:auto;margin-right:auto;left:0;right:0;max-width:fit-content;max-width:-moz-fit-content}@media only screen and (max-width:360px){.toastify-left,.toastify-right{margin-left:auto;margin-right:auto;left:0;right:0;max-width:fit-content}}";
(document.documentElement || document.head).appendChild(toastifyJS);

// It injects the scripts...
const scriptInject = (_script, _className) => {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = _script;
        if (_className)
            script.className = _className;
        script.addEventListener('load', () => resolve(script));
        script.addEventListener('error', (e) => reject(e.error || e));
        (document.documentElement || document.head).appendChild(script);
    });
}

// When our remote connections var changes, notify our server manager on the change
const notifyRemote = () => {
    chrome.storage.local.get('YTRemoteIsLocalConnectionOnly', (result) => {
        const value = result.YTRemoteIsLocalConnectionOnly || false;
        window.postMessage({
            sender: 'contentScript',
            type: 'ytrGlobalResponse',
            payload: value
        }, '*');
    });
}

// Listener for data requests from ytRemote.js
window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.sender !== 'ytRemote') return;
    const message = event.data;
    if (!message.type || !message.requestId) return;
    switch (message.type) {
        case 'ytrPasswordREQ':
            chrome.storage.local.get('YTRemotePassword', (result) => {
                const password = result.YTRemotePassword || '';
                window.postMessage({
                    sender: 'contentScript',
                    responseId: message.requestId,
                    payload: password
                }, '*');
            });
            break;
        case 'ytrVersionREQ':
            const version = chrome.runtime.getManifest().version;
            window.postMessage({
                sender: 'contentScript',
                responseId: message.requestId,
                payload: version
            }, '*');
            break;
        case 'ytrGlobalConnREQ':
            chrome.storage.local.get('YTRemoteIsLocalConnectionOnly', (result) => {
                const value = result.YTRemoteIsLocalConnectionOnly || false;
                window.postMessage({
                    sender: 'contentScript',
                    responseId: message.requestId,
                    payload: value
                }, '*');
            });
            break;
    }
});

// INJECT ALL THE SCRIPTS (should probably make this smaller)
scriptInject(chrome.runtime.getURL('libs/toastifyjs.js'), "toastifyjs").then(() => {        // Toast notifications for connections
    scriptInject(chrome.runtime.getURL('libs/md5.js'), "md5js").then(() => {                // To hash client IP
        scriptInject(chrome.runtime.getURL('libs/peerjs.js'), "peerjs").then(() => {        // For p2p connections
            scriptInject(chrome.runtime.getURL('libs/msgpack.js'), "msgpack").then(() => {  // For making our data smaller  
                scriptInject(chrome.runtime.getURL('libs/ytRemote.js'), "ytremotescript").then((ytRemoteCreated) => { // Main script
                    ytRemote = ytRemoteCreated;
                    console.log(`[Youtube Remote] Running on page`);
                    // Watch for our popup.js to call for our ID (only run if we have injected ytRemote)
                    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                        if (message.action === 'getID')
                            sendResponse({ peerID: ytRemote.id.toUpperCase() });
                    });
                    // Setup listener for when 'YTRemoteIsLocalConnectionOnly' changes
                    chrome.storage.local.onChanged.addListener(notifyRemote);
                }).catch(error => console.error(`ytRemote.js failed to inject into page:\n${error}`));
            }).catch(error => console.error(`msgpack.js failed to inject into page:\n${error}`));
        }).catch(error => console.error(`peerjs.js failed to inject into page:\n${error}`));
    }).catch(error => console.error(`md5.js failed to inject into page:\n${error}`));
}).catch(error => console.error(`toastifyjs.js failed to inject into page:\n${error}`));
