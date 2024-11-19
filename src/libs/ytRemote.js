const isYTMusic = window.location.hostname === "music.youtube.com";
const scriptSelf = document.getElementsByClassName("ytremotescript")[0];
const chars = "abcdefghjklmnopqrstuvwxyz123456"; // silly people could confuse I as l (even though no lowercase are used) so just remove "i"
let ytrDebug = true; // changed by user during runtime via console

const validHosts = [
    "https://i.ytimg.com/",
    "https://img.youtube.com/",
    "https://i3.ytimg.com/",
    "https://yt3.ggpht.com/",
    "https://lh3.googleusercontent.com/",
];

let youtubeNonStop = false;
let nextButton, prevButton, pauseButton, muteButton,
    volumeSlider, lastMetaTitle, lastPause, lastMute,
    lastVolume, mediaContData, ipChecker, hashedIP,
    allowGlobalConnections, receivedPong, ytrVersion;

// Ahh yes, very readable
const ytrLog = (message, err) => ytrDebug && (err ? (console.warn(`[Youtube Remote] ${message}`, err), errorToast.showToast()) : console.log(`[Youtube Remote] ${message}`));
const sendPeerData = (data) => conn && conn.open ? (conn.send(msgpack.encode(data)), ytrLog(`Sent: ${JSON.stringify(data)}`)) : ytrLog("Connection is closed");
const getAttribute = (element, selector, attribute) => attribute ? element.querySelector(selector)?.getAttribute(attribute) ?? "" : element.querySelector(selector) ?? "";

const generateNewID = (length) => {
    let result = "";
    for (let i = 0; i < length; i++)
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    scriptSelf.id = result;
};

// ---------- Element_Hunt ----------
const elementSearch = (id, name) => {
    if (ytrDebug) ytrLog(`Looking for ${id}`);
    const elements = document.getElementsByClassName(id);
    if (elements.length > 0 && name.includes(elements[0].title)) {
        if (ytrDebug) ytrLog(`Found ${id}`);
        return elements[0];
    }
};

const findMediaControls = () => {
    /* 
        Find buttons and use the .click() to simulate the user clicking it
        Could result in this extension breaking super quick (if any class names update)
        but I helps with compatibility with youtube-nonstop ¯\_(ツ)_/¯
    */
    ytrLog(`Searching for ${isYTMusic ? "yt_music" : "ytd_app"} elements`);

    nextButton = elementSearch(
        isYTMusic ? "next-button" : "ytp-next-button",
        isYTMusic ? "Next" : "Next (SHIFT+n)"
    );
    prevButton = elementSearch(
        isYTMusic ? "previous-button" : "ytp-prev-button",
        isYTMusic ? "Previous" : "Replay"
    );
    pauseButton = elementSearch(
        isYTMusic ? "play-pause-button" : "ytp-play-button",
        isYTMusic ? ["Pause", "Play"] : ["Play (k)", "Pause (k)"]
    );
    muteButton = elementSearch(
        isYTMusic ? "volume" : "ytp-mute-button",
        isYTMusic ? "Mute" : ["Mute (m)", "Unmute (m)"]
    );
    volumeSlider = elementSearch(
        isYTMusic ? "volume-slider" : "ytp-volume-panel",
        isYTMusic ? "Volume" : "Volume"
    );
    return true;
};

// Create separate functions for each button for PeerJS to call
const nextSong = () => {
    if (nextButton === null) return;
    if (youtubeNonStop) lastInteractionTime = new Date().getTime();
    nextButton.click();
};

const muteSong = () => {
    if (muteButton === null) return;
    if (youtubeNonStop) lastInteractionTime = new Date().getTime();
    muteButton.click();
};

const prevSong = () => {
    if (prevButton === null) return;
    if (youtubeNonStop) lastInteractionTime = new Date().getTime();
    // Normal youtube.com video won't show prev button (unless in queue)
    if (!isYTMusic && prevButton.style.display === "none")
        window.history.back();
    else prevButton.click();
};

const pauseSong = () => {
    if (pauseButton === null) return;
    //let currentPlayState = (navigator.mediaSession.playbackState != "playing")
    if (youtubeNonStop) lastInteractionTime = new Date().getTime();
    pauseButton.click();

    // YT and YTM autoplay is disabled browser wide on firefox, you need to enable it in settings
    // setTimeout(() => {
    //     if ((navigator.mediaSession.playbackState != "playing") && currentPlayState)
    //         document.getElementById(isYTMusic ? "song-media-window" : "movie_player").click();
    // }, 500);
};

// ---------- PeerJS Server ----------
let lastPeerId = null;
let peer = null;
let conn = null;

const refuseConnection = (c, reason) => {
    ytrLog(`Refusing connection from: ${c.peer}`, reason);
    c.on("open", () => {
        c.send(msgpack.encode({ type: "reject" }));
        setTimeout(() => c.close(), 500);
    });
};

const setupConnection = (c) => {
    conn = c;
    ytrLog(`Connected to: ${conn.peer}`);
    connToast.showToast();
    conn.on("data", (data) => {
        try {
            const message = msgpack.decode(new Uint8Array(data));
            switch (message.type) {
                // case "seek":
                //     const player = document.querySelector("video");
                //     if (player)
                //         player.currentTime = message.time;
                //     break;
                case "next":
                    nextSong();
                    break;
                case "prev":
                    prevSong();
                    break;
                case "pause":
                    pauseSong();
                    break;
                case "mute": // This is unused rn...
                    muteSong();
                    break;
                case "vol":
                    // Check if we are currently muted (if so then unmute then change the volume)
                    if (isYTMusic ? muteButton.querySelector("path").getAttribute("d").startsWith("M3") : muteButton.title == "Unmute (m)")
                        muteSong();

                    // Have to do this dynamically, as transitions between pages can mess with it
                    if (message.vol >= 0 && message.vol <= 100) {
                        if (youtubeNonStop) lastInteractionTime = Date.now();
                        // Set the volume from the "html5-video-player" element, as setting it from "video" is only cosmetic for some reason
                        document.getElementsByClassName("html5-video-player")[0].setVolume(message.vol);
                    }
                    break;
                case "ping":
                    sendPeerData({ type: "pong" });
                    break;
                case "pong":
                    if (message.id) receivedPong = message.id == conn.peer; // Only accept the pong if the expected client is responding
                    break;
                default:
                    ytrLog(`Unknown message: ${data}`);
                    break;
            }
        } catch (err) {
            ytrLog("Error handling data", err);
        }
    });

    conn.on("close", () => {
        conn = null;
        ytrLog("Connection reset");
        lostToast.showToast();
    });

    conn.on("open", () => {
        sendPeerData({ type: "accept" });
        // Send metadata to client
        sendClientMediaChanges(true);
    });
};

const connectPeer = (c) => {
    // Check if our connection is still alive then check if it's dead or the same client
    if (conn && conn.open) {
        // Old Peer is trying to manually reconnect (connect them back)
        if (conn.peer == c.peer) {
            setupConnection(c);
        } else {
            /*
                Check if our client still exists.
                This is mainly for mobile devices when they silently time out the connection during the device sleep/wake
                It's a hacky way to fix this, as ping over 2500ms will cause a disconnect from any peer if a new peer attempts to connect...
            */
            receivedPong = false;
            sendPeerData({ type: "ping" });
            setTimeout(() => {
                if (receivedPong) {
                    refuseConnection(c); // If our old client responded then we can ignore the new client
                } else {
                    setupConnection(c); // Otherwise out with the old and in with the new
                }
            }, 2500);
        }
    } else {
        // If we don't have a connection then set it up
        setupConnection(c);
    }
}

const initPeerJS = () => {
    const peerId = scriptSelf.id;
    peer = new Peer(peerId, {
        config: {
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                {
                    urls: "turn:turn.bistri.com:80",
                    credential: "homeo",
                    username: "homeo",
                }, // hmmmmm...
            ],
        },
    });

    peer.on("open", (id) => {
        peer.id = peer.id || lastPeerId;
        lastPeerId = peer.id;
        ytrLog(`Peer ID: ${peer.id}`);
    });


    // Never trust the client!
    peer.on("connection", (c) => {
        // Try to get our stored password
        reqLocalStorageData({ type: "ytrPasswordREQ" }).then((storedPassword) => {
            if (hashedIP != null && c.metadata.localID == hashedIP) {
                // Everything is working as inteded, check ip and passwords as normal
                if (allowGlobalConnections) {
                    if (c.metadata.password && c.metadata.password === storedPassword)
                        connectPeer(c);
                    else
                        refuseConnection(c, "Invalid password");
                } else {
                    connectPeer(c);
                }
            } else {
                // Either our IP api's are down or something is wrong with the client
                if (allowGlobalConnections) {
                    if (c.metadata.password && c.metadata.password === storedPassword)
                        connectPeer(c); // global connections allowed and the password is correct
                    else
                        refuseConnection(c, "Invalid password");
                } else {
                    refuseConnection(c, "Global connections are disabled");
                }
            }
        }).catch((err) => {
            ytrLog("Error parsing password", err);
            refuseConnection(c);
            return;
        });
    });

    peer.on("disconnected", () => {
        ytrLog("Connection disconnect. (silently) attempt to reconnect");
        peer.id = lastPeerId;
        peer._lastServerId = lastPeerId;
        peer.reconnect();
    });

    peer.on("close", () => {
        conn = null;
        ytrLog("Connection destroyed");
        lostToast.showToast();
    });

    peer.on("error", (err) => {
        if (err.type == "browser-incompatible")
            alert("Your browser does not support WebRTC\nPlease disable any blocking extensions and/or check that your browser supports WebRTC");
        conn = null;
        ytrLog("PeerJS peer.on error thrown", err);
        errorToast.showToast();
    });

    return true;
};

const fetchImageAsBase64 = (artworkSRC) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(xhr.response);
            } else {
                reject(new Error(`Failed to fetch image: ${xhr.statusText}`));
            }
        };
        xhr.onerror = () => reject(new Error("Network error occurred"));
        xhr.open("GET", artworkSRC);
        xhr.responseType = "blob";
        xhr.send();
    });
};

const sendClientMediaChanges = (forced) => {
    const currentMetadata = navigator.mediaSession.metadata;
    if (currentMetadata != null) {
        let dataToSend = { type: "meta" };
        // Check if the song title has changed
        if (forced || currentMetadata.title != lastMetaTitle) {
            let currentMatch = null;

            if (currentMetadata.artwork.length == 1) {
                // Youtube (usually only has one thumb)
                currentMatch = currentMetadata.artwork[0].src;
            } else {
                // YT Music (usually has 3-4)
                let top = 0;
                currentMetadata.artwork.forEach((obj) => {
                    // Search though thumbnail images (try to limit size to 250px)
                    if (currentMatch == null) {
                        currentMatch = obj.src;
                    } else {
                        let single = Number(obj.sizes.split("x")[0]);
                        if (single > top && top < 250 && single < 420) {
                            currentMatch = obj.src;
                            top = single;
                        }
                    }
                });
            }

            dataToSend.title = currentMetadata.title;
            dataToSend.artist = currentMetadata.artist;

            // If the thumbnail host is in our manifest file then we can send it as a url to options.js
            // Otherwise we base64 encode and send it (incase yt changes the thumbnail domains or I've missed one)
            if (validHosts.some((validHost) => currentMatch.startsWith(validHost))) {
                dataToSend.artwork = currentMatch; // Will be a url
            } else {
                fetchImageAsBase64(currentMatch)
                    .then((base64Image) => (dataToSend.artwork = base64Image))
                    .catch((err) => {
                        console.error(err);
                        errorToast.showToast();
                    });
            }
            // Keep track of the title for song changes
            lastMetaTitle = currentMetadata.title;
        }

        // Check though metadata if currently playing
        const pauseFound = navigator.mediaSession.playbackState == "playing";
        if (forced || (pauseFound != lastPause && lastPause != null))
            dataToSend.playing = pauseFound;
        lastPause = pauseFound;

        // Get the current value of the volume slider
        const foundVolume = volumeSlider.ariaValueNow;
        if (forced || (foundVolume != lastVolume && lastVolume != null))
            dataToSend.volume = foundVolume;
        lastVolume = foundVolume;

        // // Current progress of media (native client to update time, estimate sync)
        // const foundProgress = document.querySelector("video");
        // if (forced || (foundProgress.currentTime != lastProgress && lastProgress != null)) {
        //     dataToSend.mediaTime = foundProgress.currentTime;
        //     dataToSend.mediaDuration = foundProgress.duration;
        // }
        // lastProgress = foundProgress.currentTime;

        // (YTM) Check svg used by mute | (YT) Just check the title
        const muteFound = isYTMusic
            ? muteButton
                .querySelector("path")
                .getAttribute("d")
                .startsWith("M3")
            : muteButton.title == "Unmute (m)";
        if (forced || (muteFound != lastMute && lastMute != null))
            dataToSend.mute = muteFound;
        lastMute = muteFound;

        // If something was added to our dataToSend, then send it to the client
        if (Object.keys(dataToSend).length > 1) {
            dataToSend.time = Math.floor(Date.now() / 1000);
            sendPeerData(dataToSend);
        }
    } else {
        ytrDebug("No metadata to report on");
    }
};

// Check every 2 sec for any changes that should be sent to the client
const metadataCheckInterval = setInterval(() => {
    if (conn && conn.open)
        sendClientMediaChanges();
}, 2000);

// ---------- Misc ----------
const createToastTemplate = (text) => {
    return Toastify({
        text: text,
        duration: 3500,
        stopOnFocus: true,
        style: {
            background: "rgb(30, 30, 31)",
            fontSize: "12px",
            fontFamily: '"Segoe UI", Tahoma, sans-serif',
            boxShadow: "-5px 3px 7px 0px rgb(250 204 21 / 3%) inset",
        },
    });
};

const lostToast = createToastTemplate("YT-Remote - Client Disconnected");
const connToast = createToastTemplate("YT-Remote - Client Connected");
const readyToast = createToastTemplate("YT-Remote - Ready");
const errorToast = createToastTemplate("YT-Remote - Error [See console]");

const elementWait = (selector) => {
    return new Promise((resolve) => {
        if (document.querySelector(selector)) return resolve();
        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                resolve();
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
};

// Try to get a hashed IP (to test local connections against)
const attemptIpHash = () => {
    fetch("https://api.ipify.org?format=json")
        .then((response) => response.json())
        .then((data) => {
            // Include current version as a "salt" (mainly to not allow mismatched local clients to connect)
            hashedIP = md5(data.ip + ytrVersion);
            clearInterval(ipChecker);
        })
        .catch((err) => ytrLog("Could not generate hashed IP", err));
};

// Listen for update messages from content.js
window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.sender !== 'contentScript') return;
    const message = event.data;
    if (message.type === "ytrGlobalResponse") {
        allowGlobalConnections = message.payload;
        ytrLog(`allowGlobalConnections: ${allowGlobalConnections}`);
    }
});

// Request data from content.js
const reqLocalStorageData = (message) => {
    return new Promise((resolve, reject) => {
        const requestId = `${Date.now()}${Math.random()}`;
        message.requestId = requestId;
        message.sender = 'ytRemote'; // Identify the sender
        const handleResponse = (event) => {
            if (event.source !== window || !event.data || event.data.sender !== 'contentScript') return;
            if (event.data && event.data.responseId === requestId) {
                window.removeEventListener("message", handleResponse);
                if (event.data.error) {
                    reject(event.data.error);
                } else {
                    resolve(event.data.payload);
                }
            }
        };
        window.addEventListener("message", handleResponse);
        window.postMessage(message, "*");
        setTimeout(() => {  // set a timeout to reject if no response is received
            window.removeEventListener("message", handleResponse);
            reject("Timeout waiting for response");
        }, 5000);
    });
};

// Generate ID for popup to display
generateNewID(6);

// Wait for the player controls to exist
elementWait(isYTMusic ? "ytmusic-player-bar" : ".ytp-chrome-controls").then(
    () => {
        // If the browser is super slow (or super quick) PeerJS won't init in time, so wait for it to exist
        const peerJSSanityCheck = setInterval(() => {
            if (typeof Peer === "function") {
                if (findMediaControls() && initPeerJS()) {
                    // Send request to our content.js for some storage.local values
                    reqLocalStorageData({ type: "ytrGlobalConnREQ" })
                        .then((value) => {
                            allowGlobalConnections = value;
                            ytrLog(`Initial allowGlobalConnections: ${allowGlobalConnections}`);
                        }).catch((err) => ytrLog("Error getting global connections setting", err));

                    reqLocalStorageData({ type: "ytrVersionREQ" })
                        .then((version) => {
                            ytrVersion = version;
                            ytrLog(`YTRemote version: ${ytrVersion}`);
                        }).catch((err) => ytrLog("Error getting version", err));
                    // Check if a core variable used by YT-nonstop exists
                    youtubeNonStop = typeof lastInteractionTime !== "undefined";
                    if (youtubeNonStop)
                        ytrLog("Enabled Youtube NonStop Compatibility");
                    // Start to attempt to retrieve IP hash
                    ipChecker = setInterval(attemptIpHash, 2000);
                    // Show that everything is good to go
                    readyToast.showToast();
                    ytrLog("Waiting for client connection");
                } else {
                    // We don't want to check for metadata updates if we aren't able to serve clients
                    clearInterval(metadataCheckInterval);
                }
                // Remove self sanity check
                clearInterval(peerJSSanityCheck);
            }
        }, 1000);
    }
);
