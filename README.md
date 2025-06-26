# 📦 Synology NAS Downloader - Chrome Extension

A lightweight, class-based Chrome extension that allows you to download videos directly to your Synology NAS using the youtube-dl-nas Docker container.  
Built with a simple, spaghetti-style codebase, it delivers fast and effective functionality — just right-click any video link or use the popup interface to queue downloads instantly.

---

## 🚀 Features

- **🖱️ Context Menu Integration**:  
  Right-click any video or link → "Save to NAS"

- **🔲 Popup Interface**:  
  Manual URL input + resolution selection + clipboard/page auto-fill

- **📶 Real-Time Status**:  
  Displays connection and login status to your NAS

- **🎞️ Resolution Options**:  
  Full range from `2160p` to `144p`, including `audio-mp3/m4a`

- **🛠 Modular Codebase**:  
  ES6+ class-based architecture, clear separation of concerns

- **🔐 Secure Credentials**:  
  Stored securely in Chrome local storage

---

## 🧰 Requirements

- Chrome Browser (Manifest V3 support)  
- Synology NAS with `youtube-dl-nas` Docker container  
- Public NAS address (e.g., `http://your-nas.synology.me:9998`)

---

## 🧭 Installation

1. Clone or download this repository  
2. Open `chrome://extensions/` in Chrome  
3. Enable **Developer Mode**  
4. Click **Load Unpacked** and select the `my-nas-extension/` folder

---

## ⚙️ Configuration

1. Click the extension icon → Settings  
2. Input the following:
![image](https://github.com/user-attachments/assets/f51a41ea-42fa-413e-b822-03fc2d683aed)

   - **NAS URL**: e.g., `http://your-nas.synology.me:9998`
   - **User ID** / **Password**
   - **Default Resolution**
3. Save Settings and click **Test Connection**

---

## 🎯 How to Use

### 🔸 Right-click Method
- Navigate to any video page (YouTube, Vimeo, etc.)  
- Right-click → **Save to NAS**

### 🔹 Popup Method
- Open the extension popup  
- Enter or auto-fill a video URL  
- Select resolution  
- Click **Download**

---

## 🏗 Code Architecture

```
background.js (service worker)
├── ConfigManager         # Load/save config
├── UrlProcessor         # Extract and validate URLs
├── NasApiClient         # Communicate with NAS API
├── DownloadManager      # Request download handling
├── NotificationManager  # System alerts
├── ContextMenuManager   # Right-click menu setup
└── MessageHandler       # Handle extension messages

options.js
├── OptionsConfigManager # Form UI + storage
├── ConnectionTester     # Test NAS login status
└── OptionsMessageHandler

popup.js
└── PopupManager         # Manage popup UI and download flow
```

---

## 🔍 File Structure

```
my-nas-extension/
├── manifest.json
├── background.js
├── options.html
├── options.js
├── popup.html
├── popup.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## 🌐 Supported Sites

All sites supported by `youtube-dl`, including:

- YouTube
- Vimeo
- Twitter
- Facebook
- Instagram
- Dailymotion
- Over 1000+ platforms

---

## 🎞 Resolution Options

| Option        | Description               |
|---------------|---------------------------|
| `best`        | Highest available quality |
| `2160p`       | 4K UHD                    |
| `1440p`       | 2K                        |
| `1080p`       | Full HD                   |
| `720p`        | HD                        |
| `480p`        | SD                        |
| `360p`        | Low                       |
| `240p` / `144p` | Very low                 |
| `audio-mp3`   | Audio only (MP3)          |
| `audio-m4a`   | Audio only (M4A)          |

---

## 🧪 Troubleshooting

### ❌ Cannot Connect to NAS
- Verify NAS URL and port
- Check Docker container is running
- Ensure correct ID/PW

### ❌ Download Fails
- Validate the URL
- Check NAS storage availability
- Confirm the target site is supported by youtube-dl

---

## 🛡 Security

- ✅ Password stored in Chrome local storage (not in plain DOM)
- ✅ HTTPS communication with NAS (if configured)
- ✅ Session managed with cookies
- ✅ XSS-safe DOM updates
- ✅ Clean error handling and logs

---

## 🧑‍💻 Developer Notes

- Built with modular ES6+ classes  
- `console.log` used for structured debug  
- All async tasks use `try-catch`  
- Utility-first, reusable components  
- Easy to extend (e.g., add new API endpoints or UI states)

---

## 📝 License

MIT License

---

## 📞 References

- GitHub: [hyeonsangjeon/youtube-dl-nas](https://github.com/hyeonsangjeon/youtube-dl-nas)  
- Docker Hub: [modenaf360/youtube-dl-nas](https://hub.docker.com/r/modenaf360/youtube-dl-nas/)
