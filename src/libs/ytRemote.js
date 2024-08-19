const isYTMusic = window.location.hostname === "music.youtube.com";
const scriptSelf = document.getElementsByClassName("ytremotescript")[0];
const chars = "abcdefghjklmnopqrstuvwxyz";
const ytrDebug = true;

let youtubeNonStop = false;
let nextButton, prevButton, pauseButton, muteButton,
    lastMetaData, lastPause, ipChecker, hashedIP,
    allowGlobalConnections, receivedPong;

// Ahh yes very readable
const ytrLog = (message, err) => ytrDebug && (err ? console.error(`[Youtube Remote] ${message}`, err) : console.log(`[Youtube Remote] ${message}`));

// ---------- Element_Hunt ---------- 
const elementSearch = (id, name) => {
    if (ytrDebug)
        ytrLog(`Looking for ${id}`);

    const elements = document.getElementsByClassName(id);
    if (elements.length > 0 && name.includes(elements[0].title)) {
        if (ytrDebug)
            ytrLog(`Found ${id}`);
        return elements[0];
    }
}

// Searching and finding media elements
const findMediaControls = () => {
    /* 
        Find buttons and use the .click() to simulate the user clicking it
        Could result in this extension breaking super quick (if any class names update)
        but I helps with compatibility with youtube-nonstop ¯\_(ツ)_/¯
    */
    ytrLog(`Searching for ${isYTMusic ? "yt_music" : "ytd_app"} elements`)

    // Next
    nextButton = elementSearch(
        isYTMusic ? "next-button" : "ytp-next-button",
        isYTMusic ? "Next" : "Next (SHIFT+n)"
    );

    // Previous/Replay/Back
    prevButton = elementSearch(
        isYTMusic ? "previous-button" : "ytp-prev-button",
        isYTMusic ? "Previous" : "Replay"
    );

    // Pause/Play
    pauseButton = elementSearch(
        isYTMusic ? "play-pause-button" : "ytp-play-button",
        isYTMusic ? ["Pause", "Play"] : ["Play (k)", "Pause (k)"]
    );

    // Whats this????
    muteButton = elementSearch(
        isYTMusic ? "volume" : "ytp-mute-button",
        isYTMusic ? "Mute" : ["Mute (m)", "Unmute (m)"]
    )

    return true;
}

// Create separate functions for each button for PeerJS to call
const nextSong = () => {
    if (nextButton === null) return;
    if (youtubeNonStop) lastInteractionTime = new Date().getTime();
    nextButton.click();
}

const muteSong = () => {
    if (muteButton === null) return;
    if (youtubeNonStop) lastInteractionTime = new Date().getTime();
    muteButton.click();
}

const prevSong = () => {
    if (prevButton === null) return;
    if (youtubeNonStop) lastInteractionTime = new Date().getTime();
    // Normal youtube.com video won't show prev button (unless in queue)
    if (!isYTMusic && prevButton.style.display === "none")
        window.history.back();
    else
        prevButton.click();
}

const pauseSong = () => {
    if (pauseButton === null) return;
    //let currentPlayState = (navigator.mediaSession.playbackState != "playing")
    if (youtubeNonStop) lastInteractionTime = new Date().getTime();
    pauseButton.click();

    // YT and YTM will not autoplay sometimes in firefox. .click() only updates UI and doesn't trigger media playback
    // Will need to look further into this

    // // If we were paused 500ms ago and still are then it must be a fresh yt page waiting for the init click
    // setTimeout(() => {
    //     if ((navigator.mediaSession.playbackState != "playing") && currentPlayState)
    //         document.getElementById(isYTMusic ? "song-media-window" : "movie_player").click();
    // }, 500);
}

const generateNewID = (length) => {
    let result = "";
    for (let i = 0; i < length; i++)
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    scriptSelf.id = result;
}

// ---------- PeerJS Server ---------- 

let lastPeerId = null;
let peer = null;
let conn = null;

const refuseConnection = (c) => {
    ytrLog(`OUTA HERE`);
    c.on("open", () => {
        c.send(JSON.stringify({ type: "reject" }));
        setTimeout(() => c.close(), 500);
    });
}

const setupConnection = (c) => {
    conn = c;
    ytrLog("Connected to: " + conn.peer);
    connToast.showToast();

    // Reset metadata incase it has already been collected
    lastMetaData = null;
    pauseFound = null;

    conn.on("data", (data) => {
        try {
            const message = JSON.parse(data);
            switch (message.type) {
                case "next":
                    nextSong();
                    break;
                case "prev":
                    prevSong();
                    break;
                case "pause":
                    pauseSong();
                    break;
                case "mute":
                    muteButton();
                    break;
                case "vol":
                    // Have to do this dynamically, as transitions between pages can mess with it 
                    if (message.vol >= 0 && message.vol <= 100) {
                        if (youtubeNonStop) lastInteractionTime = Date.now();
                        document.getElementsByClassName("html5-video-player")[0].setVolume(message.vol);
                    }
                    break;
                case "pong":
                    if (message.id)
                        receivedPong = (message.id == conn.peer);
                    break;
                default:
                    ytrLog(`Unknown message: ${data}`);
                    break;
            }
        } catch (err) {
            ytrLog(`Error handling data: ${err}`);
        }
    });

    conn.on("close", () => {
        conn = null;
        if (ytrDebug)
            ytrLog("Connection reset");
        lostToast.showToast();
    });
    c.on("open", () => {
        conn.send(JSON.stringify({ type: "accept" }));
    });
}

const initPeerJS = () => {
    const peerId = scriptSelf.id;
    peer = new Peer(peerId);

    peer.on("open", (id) => {
        peer.id = peer.id || lastPeerId;
        lastPeerId = peer.id;

        if (ytrDebug)
            ytrLog(`Peer ID: ${peer.id}`);
    });

    peer.on("connection", (c) => {
        // Fix this crap plz 
        console.log(hashedIP, c.metadata.local, `${c.metadata.id}` == `${hashedIP}`)
        // If our hashed IP doesn't match the clients and we don't want global connections then refuse
        if (c.metadata.local != hashedIP && !allowGlobalConnections) {
            console.log("id doesn't match & no global");
            refuseConnection(c);
            return;
        }

        // Check if our connection is still alive, replace if dead
        if (conn && conn.open) {
            // Old Peer is trying to manually reconnect (connect them back)
            if (conn.peer == c.peer) {
                console.log("connection is old client");
                setupConnection(c);
                return;
            }

            // Check if client currently exists
            //  This is mainly for mobile devices with their [sleep-wake], as it doesn't send a close and
            //  PeerJS .send on its own won't throw an error if the peer never responds

            //  It's a really hacky way to do this as ping over 2.5 sec will cause a disconnect from old
            //  peer if a new peer attempts to connect
            receivedPong = false;
            conn.send(JSON.stringify({ type: "ping" }));
            console.log("Checking client response");
            setTimeout(() => {
                if (receivedPong) { // If our old client responded then we can ignore the new client
                    console.log("PONG");
                    refuseConnection(c);
                    return;
                } else {
                    console.log("No response");
                    setupConnection(c);
                    return;
                }
            }, 1500);
        } else {
            // If we don't have a connection
            console.log("don't have a connection");
            setupConnection(c);
        }
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
        conn = null;
        ytrLog(err);
        lostToast.showToast();
        errorToast.showToast();
    });

    return true;
}

const fetchImageAsBase64 = (artworkList) => {
    return new Promise((resolve, reject) => {
        // We don"t want the highest quality as our image frame is only (200px tall)
        let currentMatch = null;
        if (artworkList.length == 1)
            // Youtube (usually only has one thumb)          
            currentMatch = artworkList[0].src;
        else {
            // YT Music (usually has 3-4)
            let top = 0;
            artworkList.forEach(obj => {
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
        xhr.open("GET", currentMatch);
        xhr.responseType = "blob";
        xhr.send();
    });
}

const handleMediaChanges = () => {
    const pauseFound = (navigator.mediaSession.playbackState == "playing")
    if (pauseFound != lastPause && lastPause != null) {
        conn.send(JSON.stringify({ type: "play", value: pauseFound }));
    }
    lastPause = pauseFound;

    // TODO:
    // - Volume slider updates (yt -> remote)
    // - Mute button updates (yt -> remote)
}

const handleMetaDataChanges = () => {
    // Options.js cannot load external resources, so we'll just encode the image and send it to the client
    const metaDataFound = navigator.mediaSession.metadata;
    if (metaDataFound != lastMetaData && metaDataFound != null) {
        fetchImageAsBase64(navigator.mediaSession.metadata.artwork)
            .then(base64Image => {
                conn.send(JSON.stringify({
                    type: "meta",
                    time: Math.floor(Date.now() / 1000),
                    title: navigator.mediaSession.metadata.title,
                    artist: navigator.mediaSession.metadata.artist,
                    artwork: base64Image
                }));
                // Only update the latest data found once we have sent the data (client errors will break this rn)
                lastMetaData = metaDataFound;
            })
            .catch(err => {
                console.error(err);
                errorToast.showToast();
            });
    }
}

// Check every 2 sec for any changes that should be sent to the client
const interval = setInterval(() => {
    if (conn && conn.open) {
        handleMediaChanges();
        handleMetaDataChanges();
    }
}, 2000);

// ---------- Misc ---------- 

const createToastTmpl = (text) => {
    return Toastify({
        text: text,
        duration: 3000,
        stopOnFocus: true,
        style: {
            background: "rgb(30, 30, 31)",
            fontSize: "12px",
            fontFamily: '"Segoe UI", Tahoma, sans-serif',
            boxShadow: "-5px 3px 7px 0px rgb(250 204 21 / 3%) inset"
        }
    });
};

const lostToast = createToastTmpl("Youtube Remote - Client Disconnected");
const connToast = createToastTmpl("Youtube Remote - Client Connected");
const readyToast = createToastTmpl("Youtube Remote - Ready");
const errorToast = createToastTmpl("Youtube Remote - Error Occurred");

const elementWait = (selector) => {
    return new Promise(resolve => {
        if (document.querySelector(selector))
            return resolve(document.querySelector(selector));

        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

// Try to get a hashed IP (to test local connections against)
const attemptIpHash = () => {
    fetch("https://api.ipify.org?format=json")
        .then(response => response.json())
        .then(data => {
            hashedIP = md5(data.ip);
            clearInterval(ipChecker);
        })
        .catch(err => {
            ytrLog("Could not generate hashed IP", err)
        });
}

// Listen for messages from content script
window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data.type && event.data.type === "ytrGlobalResponse") {
        allowGlobalConnections = event.data.info;
        console.log("Message from content script:", event.data);
        console.log("Messassipt:", allowGlobalConnections);
    }
});

// Wait for the player controls to exist
elementWait(isYTMusic ? "ytmusic-player-bar" : ".ytp-chrome-controls").then((elm) => {
    generateNewID(6);
    if (findMediaControls() && initPeerJS()) {
        // Send request to our content.js for the current YTRemoteIsLocalConnectionOnly value
        window.postMessage({ type: "ytrGlobalRequest" }, "*");
        // Check if the variable exists (used by YT-nonstop)
        youtubeNonStop = typeof lastInteractionTime !== "undefined";
        ipChecker = setInterval(attemptIpHash, 2000);

        ytrLog("Waiting for client connection");
        readyToast.showToast();
    } else {
        // We don't want to check for updates if we aren't able to serve clients
        clearInterval(interval);
    }

    if (youtubeNonStop)
        ytrLog("Enabled Youtube NonStop Compatibility");
});