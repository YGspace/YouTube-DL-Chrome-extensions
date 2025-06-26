Synology NAS Downloader Chrome Extension
A Chrome extension that integrates with the youtube-dl-nas server on Synology NAS, allowing you to download videos via right-click while browsing the web.

🚀 Key Features
Right-click Menu: When right-clicking a link or video on a webpage, a "Save to NAS" menu appears

Popup Interface: Click the extension icon to input a URL and start downloading

Supports Various Resolutions: From best quality to 144p, including audio-only download options

Connection Status Indicator: Check NAS connection status in real-time

Quick Actions: Instantly fetch current page URL or clipboard URL

Clean Code Architecture: Modular class-based structure for improved maintainability

📋 Requirements
Chrome browser (Manifest V3 support)

youtube-dl-nas Docker container running on Synology NAS

A network environment with access to the NAS

🔧 Installation Guide
1. Load the Extension
In Chrome, go to chrome://extensions/

Enable "Developer mode" in the top-right corner

Click "Load unpacked"

Select the my-nas-extension folder

2. Configuration
Click the extension icon

Click the "Settings" button

Enter the following information:

NAS Address: http://your-nas.synology.me:9998

User ID: MY_ID configured during Docker setup

Password: MY_PW configured during Docker setup

Default Resolution: Choose your preferred resolution

Click "Save Settings"

Confirm settings via "Connection Test"

🎯 How to Use
Using the Right-click Menu
Right-click a video link on supported sites such as YouTube, Vimeo

Select "Save to NAS" from the context menu

A download request is automatically sent

Using the Popup
Click the extension icon

Enter a URL (or use "Current Page" / "Clipboard" buttons)

Select resolution

Click "Start Download"

🏗️ Architecture
Class-based Modular Structure
graphql
복사
편집
Background Service Worker (background.js)
├── ConfigManager          # Settings management
├── UrlProcessor          # URL utility functions
├── NasApiClient          # Communication with NAS API
├── NotificationManager   # Notification management
├── DownloadManager       # Download request handling
├── ContextMenuManager    # Context menu handling
└── MessageHandler        # Message handling

Options Page (options.js)
├── OptionsConfigManager  # Options page management
├── ConnectionTester      # Connection testing
└── OptionsMessageHandler # Message handling

Popup (popup.js)
└── PopupManager          # Popup interface management
Major Improvements
Constant Separation: All hardcoded strings moved to constants

Improved Error Handling: Specific error messages and type-based handling

Code Reusability: Shared logic extracted into utility classes

Memory Optimization: Removed unnecessary logs and optimized memory usage

Type Safety: Clear function signatures and return types

Testability: Enhanced testability with pure functions and dependency injection

🔗 Supported Sites
Compatible with all sites supported by youtube-dl, including:

YouTube

Vimeo

Dailymotion

Facebook

Twitter

Instagram

Over 1,000 other sites

⚙️ Resolution Options
best: Highest quality

2160p: 4K (2160p)

1440p: 1440p

1080p: Full HD (1080p)

720p: HD (720p)

480p: 480p

360p: 360p

240p: 240p

144p: 144p

audio-m4a: Audio only (M4A)

audio-mp3: Audio only (MP3)

🛠️ Troubleshooting
Connection Test Failure
Verify the NAS address is correct

Check if the port number is accurate

Confirm the ID/password are correct

Ensure the NAS is running

Download Request Failure
Make sure the URL is valid

Check if the site is supported by youtube-dl

Verify that the NAS has sufficient disk space

Permission Errors
Ensure all required extension permissions are granted

Update Chrome to the latest version

📁 File Structure
perl
복사
편집
my-nas-extension/
├── manifest.json          # Extension manifest
├── background.js          # Background service worker (class-based)
├── popup.html             # Popup interface
├── popup.js               # Popup logic (PopupManager class)
├── options.html           # Settings page
├── options.js             # Settings logic (OptionsConfigManager class)
├── icons/                 # Icon files
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # This file
🔒 Security
All communication is encrypted via HTTPS

Passwords are stored securely in Chrome storage

Session management via cookie-based authentication

CORS policy compliance

Input validation and XSS protection

🧪 Development Guide
Code Style
ES6+ class-based structure

Constants defined in uppercase

Function names in camelCase

Class names in PascalCase

JSDoc-style comments

Debugging
Use Chrome DevTools Console tab to inspect logs

Monitor API requests/responses via Network tab

Check storage state in the Application tab

Extension Development
Add new methods to relevant classes for new features

Extract shared logic into utility classes

Always use try-catch blocks for error handling

📝 License
MIT License

🤝 Contributing
Please submit bug reports or feature suggestions via GitHub Issues.

📞 Support
GitHub: https://github.com/hyeonsangjeon/youtube-dl-nas

Docker Hub: https://hub.docker.com/r/modenaf360/youtube-dl-nas/