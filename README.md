<h1 align="center">
Youtube Remote v2.0.4
</h1>
<p align="center">
<a>Control <b>any</b> youtube client from any device on <b>your local network</b></a></br>
<h3 align="center">
Now with global connection support*
</h3>
</p>

<p align="center">
<a href="https://addons.mozilla.org/en-GB/firefox/addon/youtube-remote/"><img src="https://github.com/user-attachments/assets/b3c51aa7-0064-47dd-939d-e5440854d1f6" alt="Get Youtube Remote for Firefox"></a>
<a href="https://chromewebstore.google.com/detail/youtube-remote/phccfmnmdkjljjeecleakhblcmdbofna?hl=en"><img src="https://github.com/user-attachments/assets/c387978f-c691-4930-9384-7a2957067c96" alt="Get Youtube Remote for Microsoft Edge"></a>
<a href="https://chromewebstore.google.com/detail/youtube-remote/phccfmnmdkjljjeecleakhblcmdbofna?hl=en"><img src="https://github.com/user-attachments/assets/7b785468-11a7-46b6-b171-499b958a3dd7" alt="Get Youtube Remote for Chrome"></a>
</p>

***

###### *requires server to use a password if using global connections

### Designed and tested with:
- music.youtube.com - (*Firefox/Chrome/Edge*)
- youtube.com -  (*Firefox/Chrome/Edge*)


<img src="https://github.com/user-attachments/assets/fed96993-6ae0-4cc3-997d-72bb06cbced0"/>

<img src="https://github.com/user-attachments/assets/b33e46a3-7daf-470e-80f0-1e8742ef0dd2"/>

## Behind the scenes
### Why?
Wanted to make skipping/volume/pausing a lot easier when using a device with a far host. The framework for p2p media control has been layed down, would be awesome to see it ported to other sites

### Data stored in LocalStorage
|Value|Description|Write|Read|
|-|-|-|-|
| YTRemoteIsLocalConnectionOnly | Should we allow local connections? | popup.js | options.js ytRemote.js |
| YTRemotePassword | Password required for global connections | options.js popup.js | options.js ytRemote.js |
| YTRemoteLastDisplayedKey | Last ID that was shown by Popup.js<br>(QOF for testing p2p) | popup.js | options.js |
| YTRemoteLastUsedKey | Last ID that had a successful connection | options.js | options.js |