// Message handler for cross internal script communication

let hashedIP = null;

function scanTabs(tab, change) {
    console.log(tab.title);
}

chrome.tabs.onUpdated.addListener(scanTabs);
chrome.tabs.onCreated.addListener(scanTabs);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const { message, recipient } = request;
    console.error(`Processing message: ${message}`);

    switch (recipient) {
        case "webpage":
            chrome.tabs.sendMessage(sender.tab.id, { message });
            break;
        case "popup":
            chrome.runtime.sendMessage({ message });
            break;
        case "content":
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0)
                    chrome.tabs.sendMessage(tabs[0].id, { message });
            });
            break;
        case "options":
            chrome.runtime.sendMessage({ message });
            break;
        default:
            console.error(`Unknown recipient: ${recipient}`);
            break;
    }
});