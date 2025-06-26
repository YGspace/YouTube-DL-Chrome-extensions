/**
 * Synology NAS Downloader - Popup
 * 
 * 주요 기능:
 * - URL 입력 및 다운로드 요청
 * - 현재 페이지/클립보드 URL 가져오기
 * - 설정 상태 표시
 */

// ==================== 상수 정의 ====================
const POPUP_CONSTANTS = {
  STORAGE_KEYS: ['nasUrl', 'userId', 'userPw', 'resolution'],
  DEFAULT_RESOLUTION: 'best',
  MESSAGES: {
    URL_REQUIRED: 'URL을 입력해주세요.',
    INVALID_URL: '유효하지 않은 URL입니다.',
    DOWNLOAD_STARTED: '다운로드가 시작되었습니다!',
    DOWNLOAD_FAILED: '다운로드 요청에 실패했습니다: ',
    GENERAL_ERROR: '오류가 발생했습니다: ',
    CURRENT_PAGE_SUCCESS: '현재 페이지 URL이 입력되었습니다.',
    CURRENT_PAGE_ERROR: '현재 페이지 URL을 가져올 수 없습니다.',
    CLIPBOARD_SUCCESS: '클립보드의 URL이 입력되었습니다.',
    CLIPBOARD_NO_URL: '클립보드에 유효한 URL이 없습니다.',
    CLIPBOARD_ERROR: '클립보드를 읽을 수 없습니다.',
    DOWNLOADING: '다운로드 중...',
    DOWNLOAD_START: '다운로드 시작'
  },
  STATUS_MESSAGES: {
    CONNECTED: 'NAS에 연결됨',
    SETUP_REQUIRED: '설정을 완료해주세요.'
  },
  HELP_URL: 'https://github.com/hyeonsangjeon/youtube-dl-nas'
};

// ==================== 팝업 관리자 ====================
class PopupManager {
  constructor() {
    this.config = {};
    this.elements = this.initializeElements();
    this.init();
  }

  initializeElements() {
    return {
      urlInput: document.getElementById('urlInput'),
      resolutionSelect: document.getElementById('resolutionSelect'),
      downloadBtn: document.getElementById('downloadBtn'),
      downloadBtnText: document.getElementById('downloadBtnText'),
      currentPageBtn: document.getElementById('currentPageBtn'),
      currentTabBtn: document.getElementById('currentTabBtn'),
      clipboardBtn: document.getElementById('clipboardBtn'),
      optionsBtn: document.getElementById('optionsBtn'),
      helpLink: document.getElementById('helpLink'),
      aboutLink: document.getElementById('aboutLink'),
      statusIndicator: document.getElementById('statusIndicator'),
      statusText: document.getElementById('statusText'),
      connectionStatus: document.getElementById('connectionStatus'),
      connectionMessage: document.getElementById('connectionMessage'),
      statusMessage: document.getElementById('statusMessage')
    };
  }

  init() {
    this.loadConfig();
    this.setupEventListeners();
    this.setupStorageListener();
  }

  setupEventListeners() {
    this.elements.downloadBtn.addEventListener('click', () => this.handleDownload());
    this.elements.currentPageBtn.addEventListener('click', () => this.getCurrentPageUrl());
    this.elements.currentTabBtn.addEventListener('click', () => this.getCurrentTabUrl());
    this.elements.clipboardBtn.addEventListener('click', () => this.getClipboardUrl());
    this.elements.optionsBtn.addEventListener('click', () => this.openOptions());
    this.elements.helpLink.addEventListener('click', () => this.openHelp());
    this.elements.aboutLink.addEventListener('click', () => this.openAbout());
  }

  setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        this.loadConfig();
      }
    });
  }

  loadConfig() {
    chrome.storage.local.get(POPUP_CONSTANTS.STORAGE_KEYS, (result) => {
      this.config = {
        nasUrl: result.nasUrl || '',
        userId: result.userId || '',
        userPw: result.userPw || '',
        resolution: result.resolution || POPUP_CONSTANTS.DEFAULT_RESOLUTION
      };
      this.updateUI();
    });
  }

  updateUI() {
    const hasNasUrl = !!this.config.nasUrl;
    
    if (hasNasUrl) {
      // NAS URL이 있으면 실제 연결 테스트 수행
      this.elements.statusIndicator.className = 'status-indicator disconnected';
      this.elements.statusText.textContent = '연결 확인 중...';
      this.elements.connectionMessage.textContent = 'NAS 서버 연결을 확인하고 있습니다';
      this.elements.connectionStatus.style.display = 'block';
      this.elements.downloadBtn.disabled = true;
      this.elements.downloadBtnText.textContent = POPUP_CONSTANTS.MESSAGES.DOWNLOAD_START;
      this.elements.resolutionSelect.value = this.config.resolution;
      
      // 실제 연결 테스트 수행
      this.checkConnectionStatus();
    } else {
      this.elements.statusIndicator.className = 'status-indicator disconnected';
      this.elements.statusText.textContent = '연결되지 않음';
      this.elements.connectionMessage.textContent = 'NAS URL을 설정해주세요';
      this.elements.connectionStatus.style.display = 'block';
      this.elements.downloadBtn.disabled = true;
      this.elements.downloadBtnText.textContent = POPUP_CONSTANTS.MESSAGES.DOWNLOAD_START;
    }
  }

  async handleDownload() {
    const url = this.elements.urlInput.value.trim();
    const resolution = this.elements.resolutionSelect.value;
    
    console.log('=== Popup Download Request ===');
    console.log('URL:', url);
    console.log('Resolution:', resolution);
    console.log('Config:', this.config);
    
    if (!url) {
      console.log('URL is empty');
      this.showStatus(POPUP_CONSTANTS.MESSAGES.URL_REQUIRED, 'error');
      return;
    }
    
    console.log('Validating URL...');
    if (!this.isValidUrl(url)) {
      console.log('URL validation failed');
      this.showStatus(POPUP_CONSTANTS.MESSAGES.INVALID_URL, 'error');
      return;
    }
    console.log('URL validation passed');
    
    this.setDownloadButtonState(true, POPUP_CONSTANTS.MESSAGES.DOWNLOADING);
    
    try {
      console.log('Sending message to background script...');
      const message = {
        action: 'download',
        url: url,
        resolution: resolution
      };
      console.log('Message to send:', message);
      
      const response = await chrome.runtime.sendMessage(message);
      
      console.log('Response from background:', response);
      
      if (response && response.success) {
        this.showStatus(POPUP_CONSTANTS.MESSAGES.DOWNLOAD_STARTED, 'success');
        this.elements.urlInput.value = '';
      } else {
        const errorMsg = response && response.error ? response.error : '알 수 없는 오류';
        console.error('Download failed:', errorMsg);
        this.showStatus(POPUP_CONSTANTS.MESSAGES.DOWNLOAD_FAILED + errorMsg, 'error');
      }
    } catch (error) {
      console.error('Download error:', error);
      this.showStatus(POPUP_CONSTANTS.MESSAGES.GENERAL_ERROR + error.message, 'error');
    } finally {
      this.setDownloadButtonState(false, POPUP_CONSTANTS.MESSAGES.DOWNLOAD_START);
    }
  }

  setDownloadButtonState(isDownloading, text) {
    this.elements.downloadBtn.disabled = isDownloading;
    this.elements.downloadBtnText.textContent = text;
    
    if (isDownloading) {
      this.elements.downloadBtn.classList.add('loading');
    } else {
      this.elements.downloadBtn.classList.remove('loading');
    }
  }

  async getCurrentPageUrl() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        this.elements.urlInput.value = tab.url;
        this.showStatus(POPUP_CONSTANTS.MESSAGES.CURRENT_PAGE_SUCCESS, 'success');
      }
    } catch (error) {
      console.error('Error getting current page URL:', error);
      this.showStatus(POPUP_CONSTANTS.MESSAGES.CURRENT_PAGE_ERROR, 'error');
    }
  }

  async getCurrentTabUrl() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        this.elements.urlInput.value = tab.url;
        this.showStatus(POPUP_CONSTANTS.MESSAGES.CURRENT_PAGE_SUCCESS, 'success');
      }
    } catch (error) {
      console.error('Error getting current tab URL:', error);
      this.showStatus(POPUP_CONSTANTS.MESSAGES.CURRENT_PAGE_ERROR, 'error');
    }
  }

  async getClipboardUrl() {
    try {
      const text = await navigator.clipboard.readText();
      if (text && this.isValidUrl(text)) {
        this.elements.urlInput.value = text;
        this.showStatus(POPUP_CONSTANTS.MESSAGES.CLIPBOARD_SUCCESS, 'success');
      } else {
        this.showStatus(POPUP_CONSTANTS.MESSAGES.CLIPBOARD_NO_URL, 'error');
      }
    } catch (error) {
      console.error('Error reading clipboard:', error);
      this.showStatus(POPUP_CONSTANTS.MESSAGES.CLIPBOARD_ERROR, 'error');
    }
  }

  openOptions() {
    chrome.runtime.openOptionsPage();
  }

  openHelp() {
    chrome.tabs.create({
      url: POPUP_CONSTANTS.HELP_URL
    });
  }

  openAbout() {
    chrome.tabs.create({
      url: 'https://github.com/your-repo'
    });
  }

  isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  showStatus(message, type = 'info') {
    this.elements.statusMessage.textContent = message;
    this.elements.statusMessage.className = `status-message ${type}`;
    this.elements.statusMessage.style.display = 'block';
    
    // 3초 후 자동 숨김
    setTimeout(() => {
      this.elements.statusMessage.style.display = 'none';
    }, 3000);
  }

  async checkConnectionStatus() {
    try {
      console.log('Checking connection status...');
      
      // 먼저 연결 상태 확인
      const connectionResponse = await chrome.runtime.sendMessage({
        action: 'checkConnection'
      });
      
      console.log('Connection check response:', connectionResponse);
      
      // 로그인 상태도 확인
      const loginResponse = await chrome.runtime.sendMessage({
        action: 'checkLoginStatus'
      });
      
      console.log('Login status response:', loginResponse);
      
      if (connectionResponse && connectionResponse.success) {
        this.elements.statusIndicator.className = 'status-indicator connected';
        this.elements.statusText.textContent = '연결됨';
        
        if (loginResponse && loginResponse.success && loginResponse.isLoggedIn) {
          this.elements.connectionMessage.textContent = 'NAS 서버에 연결되었습니다 (로그인됨)';
          this.elements.downloadBtn.disabled = false;
        } else {
          this.elements.connectionMessage.textContent = 'NAS 서버에 연결되었습니다 (로그인 필요)';
          this.elements.downloadBtn.disabled = false; // 연결만 되면 다운로드 시도 가능
        }
        
        this.elements.connectionStatus.style.display = 'block';
      } else {
        this.elements.statusIndicator.className = 'status-indicator disconnected';
        this.elements.statusText.textContent = '연결 안됨';
        
        let errorMessage = 'NAS 서버에 연결할 수 없습니다';
        if (connectionResponse && connectionResponse.error) {
          errorMessage = connectionResponse.error;
        } else if (loginResponse && loginResponse.error) {
          errorMessage = loginResponse.error;
        }
        
        this.elements.connectionMessage.textContent = errorMessage;
        this.elements.connectionStatus.style.display = 'block';
        this.elements.downloadBtn.disabled = true;
      }
    } catch (error) {
      console.error('Connection check error:', error);
      this.elements.statusIndicator.className = 'status-indicator disconnected';
      this.elements.statusText.textContent = '연결 오류';
      this.elements.connectionMessage.textContent = '연결 상태를 확인할 수 없습니다: ' + error.message;
      this.elements.connectionStatus.style.display = 'block';
      this.elements.downloadBtn.disabled = true;
    }
  }
}

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup loaded');
  
  new PopupManager();
}); 