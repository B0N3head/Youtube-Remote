const isYTMusic = window.location.hostname === "music.youtube.com";
const scriptSelf = document.getElementsByClassName("ytremotescript")[0];
const chars = "abcdefghjklmnopqrstuvwxyz";
const ytrDebug = false;

let youtubeNonStop = false;
let nextButton, prevButton, pauseButton, muteButton, volumeSlider,
    lastMetaData, lastPause, lastMute, lastVolume, mediaContData,
    ipChecker, hashedIP, allowGlobalConnections, receivedPong;

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

const refuseConnection = (c, m) => {
    c.on("open", () => {
        c.send(JSON.stringify({ type: "reject", value: m ? m : null }));
        setTimeout(() => c.close(), 500);
    });
}

const setupConnection = (c) => {
    conn = c;
    ytrLog("Connected to: " + conn.peer);
    connToast.showToast();

    // Reset metadata incase it has already been collected
    lastMetaData = null;
    setTimeout(() => handleMediaChanges(true), 1000);    // Force


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
                case "mute": // This is unused...
                    muteSong();
                    break;
                case "vol":
                    // Check if we are currently muted (if so then unmute then change the volume)
                    if (isYTMusic ? muteButton.querySelector('path').getAttribute('d').startsWith('M3') : muteButton.title == "Unmute (m)")
                        muteSong();

                    // Have to do this dynamically, as transitions between pages can mess with it 
                    if (message.vol >= 0 && message.vol <= 100) {
                        if (youtubeNonStop) lastInteractionTime = Date.now();
                        document.getElementsByClassName("html5-video-player")[0].setVolume(message.vol);
                    }
                    break;
                case "pong":
                    if (message.id)
                        receivedPong = (message.id == conn.peer); // Only accept the pong if the expected client is responding
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

    conn.on("open", () => {
        conn.send(JSON.stringify({ type: "accept" }));
    });
}

const initPeerJS = () => {
    const peerId = scriptSelf.id;
    peer = new Peer(peerId, {
        config: {
            'iceServers': [
                { url: 'stun:stun.l.google.com:19302' },
                { url: 'turn:turn.bistri.com:80', credential: 'homeo', username: 'homeo' }
            ]
        }
    });

    peer.on("open", (id) => {
        peer.id = peer.id || lastPeerId;
        lastPeerId = peer.id;

        if (ytrDebug)
            ytrLog(`Peer ID: ${peer.id}`);
    });

    peer.on("connection", (c) => {
        // If our hashed IP doesn't match the clients and we don't want global connections then refuse
        if (c.metadata.localID != hashedIP && !allowGlobalConnections) {
            refuseConnection(c, "Server is only accepting local connections");
            return;
        }

        // Check if our connection is still alive, replace if dead
        if (conn && conn.open) {
            // Old Peer is trying to manually reconnect (connect them back)
            if (conn.peer == c.peer) {
                setupConnection(c);
                return;
            }

            // Check if client currently exists  
            //  This is mainly for mobile devices with their [sleep-wake], as it doesn't send a close and
            //  PeerJS .send on its own won't throw an error if the peer never responds

            //  It's a hacky way to do this as ping over 2.5 sec will cause a disconnect from old
            //  peer if a new peer attempts to connect
            receivedPong = false;
            conn.send(JSON.stringify({ type: "ping" }));
            setTimeout(() => {
                if (receivedPong) { // If our old client responded then we can ignore the new client
                    refuseConnection(c, "Server is already serving a client");
                    return;
                } else {
                    setupConnection(c);
                    return;
                }
            }, 2500);
        } else {
            // If we don't have a connection then set it up
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
        if (err.type == "browser-incompatible")
            alert("Your browser does not support WebRTC\nPlease disable any blocking extensions and/or check that your browser supports WebRTC");
        conn = null;
        ytrLog(err);
        errorToast.showToast();
    });

    return true;
}

// It hurts that this may now be useless :(
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
}

const handleMediaChanges = (forced) => {
    mediaContData = { type: "mediaControl" };

    // Check though metadata if currently paused
    const pauseFound = (navigator.mediaSession.playbackState == "playing")
    if (forced || (pauseFound != lastPause && lastPause != null))
        mediaContData.play = pauseFound;

    lastPause = pauseFound;

    // Get the current value of the slider
    const foundVolume = volumeSlider.ariaValueNow;
    if (forced || (foundVolume != lastVolume && lastVolume != null))
        mediaContData.volume = foundVolume;

    lastVolume = foundVolume;

    // (YTM) Check svg used by mute | (YT) Just check the title
    const muteFound = isYTMusic ? muteButton.querySelector('path').getAttribute('d').startsWith('M3') : muteButton.title == "Unmute (m)";
    if (forced || (muteFound != lastMute && lastMute != null && muteFound == true))
        mediaContData.mute = muteFound;

    lastMute = muteFound;
    if (Object.keys(mediaContData).length > 1)
        conn.send(JSON.stringify(mediaContData));
}

const validHosts = [
    "https://i.ytimg.com/",
    "https://img.youtube.com/",
    "https://i3.ytimg.com/",
    "https://yt3.ggpht.com/",
    "https://lh3.googleusercontent.com/"
];

const handleMetaDataChanges = () => {
    // Options.js cannot load external resources, so we'll just encode the image and send it to the client
    const metaDataFound = navigator.mediaSession.metadata;
    if (metaDataFound != lastMetaData && metaDataFound != null) {
        let currentMatch = null;
        if (metaDataFound.artwork.length == 1) {    // Youtube (usually only has one thumb)  
            currentMatch = metaDataFound.artwork[0].src;
        }
        else {  // YT Music (usually has 3-4)
            let top = 0;
            metaDataFound.artwork.forEach(obj => {
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

        let dataToSend = {
            type: "meta",
            time: Math.floor(Date.now() / 1000),
            title: navigator.mediaSession.metadata.title,
            artist: navigator.mediaSession.metadata.artist,
            artwork: currentMatch
        };

        // If the thumbnail is in our manifest file then we can send it as a url to options.js
        // Otherwise we will base64 encode and send it (incase yt changes the thumbnail domains or I've missed one)
        if (validHosts.some(validHost => currentMatch.startsWith(validHost))) {
            conn.send(JSON.stringify(dataToSend));
        } else {
            fetchImageAsBase64(currentMatch)
                .then(base64Image => {
                    dataToSend.artwork = base64Image;
                    conn.send(JSON.stringify(dataToSend));
                })
                .catch(err => {
                    console.error(err);
                    errorToast.showToast();
                });
        }

        // Only update the latest data found once we have sent the data (client errors will break this rn :D)
        lastMetaData = metaDataFound;
    }
}

// Check every 3 sec for any changes that should be sent to the client
const interval = setInterval(() => {
    if (conn && conn.open) {
        handleMediaChanges();
        handleMetaDataChanges();
    }
}, 3000);

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
    if (event.data.type && event.data.type === "ytrGlobalResponse")
        allowGlobalConnections = event.data.info;
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