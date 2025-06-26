/**
 * Synology NAS Downloader - Background Service Worker
 * 
 * 주요 기능:
 * - 컨텍스트 메뉴 관리
 * - NAS 로그인 및 다운로드 요청 처리
 * - 설정 관리
 */

// ==================== 상수 정의 ====================
const CONSTANTS = {
  CONTEXT_MENU_ID: 'downloadToNas',
  CONTEXT_MENU_TITLE: 'NAS에 저장',
  NOTIFICATION_TITLE: 'Synology NAS Downloader',
  ICON_URL: 'icons/icon48.png',
  ERROR_MESSAGES: {
    CONFIG_INCOMPLETE: '설정을 먼저 완료해주세요.',
    INVALID_URL: '유효하지 않은 URL입니다.',
    LOGIN_FAILED: 'NAS 로그인에 실패했습니다.',
    DOWNLOAD_FAILED: '다운로드 요청에 실패했습니다.',
    GENERAL_ERROR: '오류가 발생했습니다: '
  },
  SUCCESS_MESSAGES: {
    DOWNLOAD_STARTED: '다운로드가 시작되었습니다.'
  },
  LOGIN_INDICATORS: {
    SUCCESS: ['Welcome', 'youtube-dl', '/youtube-dl'],
    FAILURE: ['id or password is not correct']
  },
  URL_PATTERNS: {
    BLOB: 'blob:',
    YOUTUBE_WATCH: 'youtube.com/watch'
  }
};

const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

// ==================== 설정 관리 ====================
class ConfigManager {
  constructor() {
    this.config = {
      nasUrl: '',
      userId: '',
      userPw: '',
      resolution: 'best'
    };
    this.init();
  }

  init() {
    this.loadConfig();
    this.setupStorageListener();
  }

  loadConfig() {
    chrome.storage.local.get(['nasUrl', 'userId', 'userPw', 'resolution'], (result) => {
      this.config = {
        nasUrl: result.nasUrl || '',
        userId: result.userId || '',
        userPw: result.userPw || '',
        resolution: result.resolution || 'best'
      };
      this.log('Config loaded', LOG_LEVELS.DEBUG);
    });
  }

  setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        Object.keys(changes).forEach(key => {
          if (this.config.hasOwnProperty(key)) {
            this.config[key] = changes[key].newValue;
          }
        });
        this.log('Config updated', LOG_LEVELS.DEBUG);
        
        // 설정 변경 시 로그인 캐시 무효화
        if (nasApiClient) {
          nasApiClient.invalidateLoginCache();
        }
      }
    });
  }

  getConfig() {
    return { ...this.config };
  }

  isConfigComplete() {
    return !!(this.config.nasUrl && this.config.userId && this.config.userPw);
  }

  log(message, level = LOG_LEVELS.INFO) {
    if (level === LOG_LEVELS.DEBUG) {
      console.log(`[ConfigManager] ${message}`);
    }
  }
}

// ==================== URL 처리 유틸리티 ====================
class UrlProcessor {
  static extractTargetUrl(info, tab) {
    console.log('=== URL Extraction ===');
    console.log('Input info:', info);
    console.log('Input tab:', tab);
    
    let targetUrl = '';

    // 우선순위: linkUrl > srcUrl > tab.url
    if (info.linkUrl) {
      targetUrl = info.linkUrl;
      console.log('Using linkUrl:', targetUrl);
    } else if (info.srcUrl) {
      targetUrl = info.srcUrl;
      console.log('Using srcUrl:', targetUrl);
    } else if (tab && tab.url) {
      targetUrl = tab.url;
      console.log('Using tab.url:', targetUrl);
    } else {
      // URL을 찾을 수 없는 경우
      console.log('No URL found in any source');
      return '';
    }

    // blob URL 방지
    if (targetUrl.startsWith(CONSTANTS.URL_PATTERNS.BLOB)) {
      console.log('Blob URL detected, attempting to use tab URL');
      if (tab && tab.url) {
        targetUrl = tab.url;
        console.log('Using tab URL instead:', targetUrl);
      } else {
        console.log('No tab URL available for blob replacement');
        return ''; // blob URL이고 tab URL도 없는 경우
      }
    }

    // YouTube 페이지 특별 처리
    if (tab && tab.url && this.isYouTubeUrl(tab.url)) {
      console.log('YouTube page detected, using tab URL');
      targetUrl = tab.url;
    }

    console.log('Final extracted URL:', targetUrl);
    return targetUrl;
  }

  static isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  static isYouTubeUrl(url) {
    const youtubePatterns = [
      'youtube.com/watch',
      'youtube.com/shorts',
      'youtu.be/',
      'youtube.com/channel/',
      'youtube.com/c/',
      'youtube.com/user/',
      'youtube.com/playlist'
    ];
    
    return youtubePatterns.some(pattern => url.includes(pattern));
  }
}

// ==================== NAS API 클라이언트 ====================
class NasApiClient {
  constructor(configManager) {
    this.configManager = configManager;
    this.loginCache = {
      isLoggedIn: false,
      timestamp: 0,
      cacheDuration: 180 * 60 * 1000 // 3시간 캐시 (30분에서 변경)
    };
    this.loadLoginCache();
  }

  // Chrome Storage에서 로그인 캐시 로드
  loadLoginCache() {
    chrome.storage.local.get(['loginCache'], (result) => {
      if (result.loginCache) {
        this.loginCache = result.loginCache;
        this.log('Login cache loaded from storage', LOG_LEVELS.DEBUG);
      }
    });
  }

  // Chrome Storage에 로그인 캐시 저장
  saveLoginCache() {
    chrome.storage.local.set({ loginCache: this.loginCache }, () => {
      this.log('Login cache saved to storage', LOG_LEVELS.DEBUG);
    });
  }

  async login() {
    // 캐시된 로그인 상태 확인
    if (this.isLoginCached()) {
      this.log('Using cached login status', LOG_LEVELS.DEBUG);
      return true;
    }

    try {
      const config = this.configManager.getConfig();
      this.log('Attempting login with config', LOG_LEVELS.DEBUG, config);
      
      const formData = new FormData();
      formData.append('id', config.userId);
      formData.append('myPw', config.userPw);

      const response = await fetch(`${config.nasUrl}/login`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const loginSuccess = await this.validateLoginResponse(response);
      
      // 로그인 성공 시 캐시 업데이트
      if (loginSuccess) {
        this.updateLoginCache(true);
        this.log('Login successful and cached', LOG_LEVELS.INFO);
      } else {
        this.updateLoginCache(false);
        this.log('Login failed', LOG_LEVELS.ERROR);
      }
      
      return loginSuccess;
    } catch (error) {
      this.log('Login error', LOG_LEVELS.ERROR, error);
      this.updateLoginCache(false);
      return false;
    }
  }

  isLoginCached() {
    const now = Date.now();
    const timeSinceLogin = now - this.loginCache.timestamp;
    const isCached = this.loginCache.isLoggedIn && timeSinceLogin < this.loginCache.cacheDuration;
    
    this.log(`Login cache check: isLoggedIn=${this.loginCache.isLoggedIn}, timeSinceLogin=${Math.round(timeSinceLogin/1000)}s, cacheDuration=${Math.round(this.loginCache.cacheDuration/1000)}s, isCached=${isCached}`, LOG_LEVELS.DEBUG);
    
    return isCached;
  }

  updateLoginCache(isLoggedIn) {
    this.loginCache.isLoggedIn = isLoggedIn;
    this.loginCache.timestamp = Date.now();
    this.saveLoginCache();
  }

  // 로그인 캐시 무효화 (설정 변경 시)
  invalidateLoginCache() {
    this.loginCache.isLoggedIn = false;
    this.loginCache.timestamp = 0;
    this.saveLoginCache();
  }

  async validateLoginResponse(response) {
    console.log('=== Login Response Validation ===');
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    
    // 302 리다이렉트는 성공
    if (response.status === 302) {
      console.log('Login successful (302 redirect)');
      return true;
    }

    const responseText = await response.text();
    console.log('Response text length:', responseText.length);
    console.log('Response text preview:', responseText.substring(0, 500));
    
    // 실패 메시지 확인
    if (CONSTANTS.LOGIN_INDICATORS.FAILURE.some(indicator => 
      responseText.includes(indicator))) {
      console.log('Login failed - found failure indicator');
      return false;
    }

    // 성공 지표 확인
    const hasSuccessIndicator = CONSTANTS.LOGIN_INDICATORS.SUCCESS.some(indicator => 
      responseText.includes(indicator));
    
    const hasWelcomeMessage = responseText.includes('Welcome') && 
      responseText.includes(this.configManager.getConfig().userId);

    const isSuccess = hasSuccessIndicator || hasWelcomeMessage || 
           (response.status === 200 && !responseText.includes('id or password is not correct'));
    
    console.log('Login validation result:', {
      hasSuccessIndicator,
      hasWelcomeMessage,
      status200: response.status === 200,
      noFailureMessage: !responseText.includes('id or password is not correct'),
      finalResult: isSuccess
    });
    
    return isSuccess;
  }

  async requestDownload(url) {
    try {
      const config = this.configManager.getConfig();
      
      // 다운로드 요청 전에 로그인 상태 확인 및 필요시 로그인 시도
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        throw new Error('NAS 로그인에 실패했습니다.');
      }
      
      // /youtube-dl/q 엔드포인트는 인증이 필요하지 않음
      const requestBody = {
        url: url,
        resolution: config.resolution
      };

      this.log('Sending download request', LOG_LEVELS.DEBUG);
      this.log('Request URL', LOG_LEVELS.DEBUG, `${config.nasUrl}/youtube-dl/q`);
      this.log('Request body', LOG_LEVELS.DEBUG, requestBody);

      // /youtube-dl/q 엔드포인트 사용 (인증 불필요)
      const response = await fetch(`${config.nasUrl}/youtube-dl/q`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody),
        credentials: 'include'
      });

      this.log('Download response status', LOG_LEVELS.DEBUG, response.status);
      this.log('Download response headers', LOG_LEVELS.DEBUG, response.headers);

      const responseText = await response.text();
      this.log('Download response text', LOG_LEVELS.DEBUG, responseText);
      
      // HTTP 상태 코드 확인
      if (!response.ok) {
        this.log(`HTTP error: ${response.status} ${response.statusText}`, LOG_LEVELS.ERROR);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // JSON 파싱 시도
      let result;
      try {
        result = JSON.parse(responseText);
        this.log('Parsed JSON result', LOG_LEVELS.DEBUG, result);
      } catch (parseError) {
        this.log('Failed to parse JSON response', LOG_LEVELS.ERROR, parseError);
        this.log('Raw response text', LOG_LEVELS.DEBUG, responseText);
        
        // JSON 파싱 실패 시에도 응답 텍스트에서 성공/실패 여부 확인
        if (responseText.includes('success') || responseText.includes('Success') || 
            responseText.includes('received your download') || responseText.includes('download has started')) {
          return true;
        } else if (responseText.includes('error') || responseText.includes('Error') || 
                   responseText.includes('fail') || responseText.includes('wrong')) {
          throw new Error('서버에서 다운로드 실패 응답을 받았습니다: ' + responseText);
        } else {
          throw new Error('서버 응답을 파싱할 수 없습니다: ' + responseText);
        }
      }
      
      // NAS 서버의 응답 형식에 맞춰 성공 여부 확인
      if (result.success === true) {
        this.log('Download success confirmed', LOG_LEVELS.DEBUG);
        return true;
      } else if (result.success === false) {
        const errorMessage = result.msg || result.error || result.message || '알 수 없는 오류';
        throw new Error('다운로드 실패: ' + errorMessage);
      } else {
        // success 필드가 없는 경우, 다른 성공 지표 확인
        if (result.msg && (result.msg.includes('received your download') || result.msg.includes('download has started'))) {
          return true;
        } else if (result.status === 'success' || result.message === 'success') {
          return true;
        } else {
          throw new Error('서버 응답에서 성공 여부를 확인할 수 없습니다: ' + JSON.stringify(result));
        }
      }
    } catch (error) {
      this.log('Download request error', LOG_LEVELS.ERROR, error);
      throw error; // 오류를 다시 던져서 상위에서 처리하도록 함
    }
  }

  log(message, level = LOG_LEVELS.INFO, error = null) {
    const logMessage = `[NasApiClient] ${message}`;
    switch (level) {
      case LOG_LEVELS.ERROR:
        console.error(logMessage, error);
        break;
      case LOG_LEVELS.WARN:
        console.warn(logMessage);
        break;
      case LOG_LEVELS.DEBUG:
        console.log(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }
}

// ==================== 알림 관리자 ====================
class NotificationManager {
  static show(message, type = 'info') {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: CONSTANTS.ICON_URL,
        title: CONSTANTS.NOTIFICATION_TITLE,
        message: message
      });
    } catch (error) {
      console.error('Failed to show notification:', error);
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  static showError(message) {
    this.show(message, 'error');
  }

  static showSuccess(message) {
    this.show(message, 'success');
  }
}

// ==================== 다운로드 관리자 ====================
class DownloadManager {
  constructor(configManager, nasApiClient) {
    this.configManager = configManager;
    this.nasApiClient = nasApiClient;
  }

  async handleDownloadRequest(info, tab) {
    try {
      console.log('=== Download Request Processing ===');
      console.log('Info:', info);
      console.log('Tab:', tab);
      
      // 설정 확인 (NAS URL만 확인)
      if (!this.configManager.config.nasUrl) {
        console.log('NAS URL not configured');
        return { success: false, error: 'NAS URL이 설정되지 않았습니다.' };
      }

      // URL 추출 및 검증
      const targetUrl = UrlProcessor.extractTargetUrl(info, tab);
      console.log('Extracted target URL:', targetUrl);
      
      if (!targetUrl) {
        console.log('No URL extracted');
        return { success: false, error: 'URL을 추출할 수 없습니다.' };
      }
      
      if (!UrlProcessor.isValidUrl(targetUrl)) {
        console.log('Invalid URL:', targetUrl);
        return { success: false, error: CONSTANTS.ERROR_MESSAGES.INVALID_URL };
      }

      console.log('Starting download request (no login required for /youtube-dl/q)...');
      // 다운로드 요청 (/youtube-dl/q는 인증 불필요)
      try {
        const downloadSuccess = await this.nasApiClient.requestDownload(targetUrl);
        console.log('Download result:', downloadSuccess);
        
        if (downloadSuccess) {
          return { success: true, message: CONSTANTS.SUCCESS_MESSAGES.DOWNLOAD_STARTED };
        } else {
          return { success: false, error: CONSTANTS.ERROR_MESSAGES.DOWNLOAD_FAILED };
        }
      } catch (downloadError) {
        console.error('Download request failed:', downloadError);
        return { success: false, error: '다운로드 요청에 실패했습니다: ' + downloadError.message };
      }

    } catch (error) {
      console.error('Download request error:', error);
      return { success: false, error: CONSTANTS.ERROR_MESSAGES.GENERAL_ERROR + error.message };
    }
  }

  setTemporaryResolution(resolution) {
    this.configManager.config.resolution = resolution;
    this.configManager.log(`Temporary resolution set to ${resolution}`);
  }
}

// ==================== 컨텍스트 메뉴 관리자 ====================
class ContextMenuManager {
  static createContextMenu() {
    try {
      console.log('Creating context menu...');
      
      // 기존 컨텍스트 메뉴 제거
      chrome.contextMenus.removeAll(() => {
        console.log('Removed existing context menus');
        
        // 새 컨텍스트 메뉴 생성
        chrome.contextMenus.create({
          id: CONSTANTS.CONTEXT_MENU_ID,
          title: CONSTANTS.CONTEXT_MENU_TITLE,
          contexts: ['link', 'video', 'audio', 'page']
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('Context menu creation error:', chrome.runtime.lastError);
          } else {
            console.log('Context menu created successfully');
          }
        });
      });
    } catch (error) {
      console.error('Error creating context menu:', error);
    }
  }

  static setupClickHandler(downloadManager) {
    console.log('Setting up context menu click handler...');
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      console.log('=== Context Menu Click ===');
      console.log('Menu item ID:', info.menuItemId);
      console.log('Info:', info);
      console.log('Tab:', tab);
      
      if (info.menuItemId === CONSTANTS.CONTEXT_MENU_ID) {
        console.log('Processing NAS download request...');
        try {
          const result = await downloadManager.handleDownloadRequest(info, tab);
          console.log('Context menu download result:', result);
          
          if (result.success) {
            NotificationManager.showSuccess(result.message);
          } else {
            NotificationManager.showError(result.error);
          }
        } catch (error) {
          console.error('Context menu download error:', error);
          NotificationManager.showError('다운로드 처리 중 오류가 발생했습니다: ' + error.message);
        }
      } else {
        console.log('Unknown menu item clicked:', info.menuItemId);
      }
    });
    console.log('Context menu click handler setup complete');
  }
}

// ==================== 메시지 핸들러 ====================
class MessageHandler {
  static setup(downloadManager) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('=== Message Received ===');
      console.log('Request action:', request.action);
      console.log('Full request:', request);
      console.log('Sender:', sender);
      
      if (request.action === 'download' || request.action === 'downloadUrl') {
        console.log('=== Popup Download Request ===');
        console.log('Request:', request);
        console.log('Sender tab:', sender.tab);
        
        // 팝업에서 전달받은 해상도로 임시 설정 업데이트
        if (request.resolution) {
          downloadManager.setTemporaryResolution(request.resolution);
          console.log('Temporary resolution set to:', request.resolution);
        }
        
        // 팝업 요청인 경우 URL을 직접 사용
        const info = { 
          linkUrl: request.url,
          pageUrl: request.url  // 추가로 pageUrl도 설정
        };
        const tab = sender.tab || null; // tab이 없으면 null 사용
        
        console.log('Processed info object:', info);
        console.log('Processed tab object:', tab);
        
        downloadManager.handleDownloadRequest(info, tab)
          .then(result => {
            console.log('Download result:', result);
            sendResponse(result);
          })
          .catch(error => {
            console.error('Download error:', error);
            sendResponse({ success: false, error: error.message || '알 수 없는 오류' });
          });
        return true; // 비동기 응답을 위해 true 반환
      } else if (request.action === 'checkConnection') {
        console.log('=== Connection Check Request ===');
        try {
          const config = downloadManager.configManager.getConfig();
          const hasNasUrl = !!config.nasUrl;
          
          console.log('Has NAS URL:', hasNasUrl);
          console.log('Config:', config);
          
          if (!hasNasUrl) {
            sendResponse({ success: false, error: 'NAS URL이 설정되지 않았습니다.' });
            return true;
          }
          
          // 여러 엔드포인트로 연결 테스트 시도
          const testEndpoints = [
            { url: `${config.nasUrl}/`, method: 'GET', description: '루트 페이지' },
            { url: `${config.nasUrl}/login`, method: 'GET', description: '로그인 페이지' },
            { url: `${config.nasUrl}/youtube-dl`, method: 'GET', description: 'youtube-dl 페이지' }
          ];
          
          console.log('Testing endpoints:', testEndpoints.map(e => e.url));
          
          let connectionSuccess = false;
          let lastError = null;
          let testIndex = 0;
          
          const testNextEndpoint = () => {
            if (testIndex >= testEndpoints.length) {
              // 모든 테스트 완료
              if (connectionSuccess) {
                sendResponse({ success: true });
              } else {
                sendResponse({ success: false, error: lastError || '모든 연결 테스트가 실패했습니다.' });
              }
              return;
            }
            
            const endpoint = testEndpoints[testIndex];
            console.log(`Testing connection to: ${endpoint.description} (${endpoint.url})`);
            
            fetch(endpoint.url, {
              method: endpoint.method,
              credentials: 'include',
              headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
              }
            })
            .then(testResponse => {
              console.log(`${endpoint.description} response status:`, testResponse.status);
              
              // 200, 404, 405 등은 서버가 응답하고 있다는 의미
              if (testResponse.status >= 200 && testResponse.status < 500) {
                console.log(`Connection successful via ${endpoint.description}`);
                connectionSuccess = true;
                sendResponse({ success: true });
              } else {
                lastError = `${endpoint.description} 응답 오류: ${testResponse.status} ${testResponse.statusText}`;
                testIndex++;
                testNextEndpoint();
              }
            })
            .catch(endpointError => {
              console.error(`${endpoint.description} connection error:`, endpointError);
              lastError = `${endpoint.description} 연결 실패: ${endpointError.message}`;
              testIndex++;
              testNextEndpoint();
            });
          };
          
          testNextEndpoint();
          return true;
        } catch (error) {
          console.error('Connection check error:', error);
          sendResponse({ success: false, error: error.message });
          return true;
        }
      } else if (request.action === 'checkLoginStatus') {
        console.log('=== Login Status Check Request ===');
        try {
          const isLoggedIn = downloadManager.nasApiClient.isLoginCached();
          const config = downloadManager.configManager.getConfig();
          
          console.log('Login status check:', {
            isLoggedIn,
            hasConfig: !!(config.nasUrl && config.userId && config.userPw),
            nasUrl: config.nasUrl
          });
          
          sendResponse({ 
            success: true, 
            isLoggedIn,
            hasConfig: !!(config.nasUrl && config.userId && config.userPw),
            nasUrl: config.nasUrl
          });
          return true;
        } catch (error) {
          console.error('Login status check error:', error);
          sendResponse({ success: false, error: error.message });
          return true;
        }
      } else {
        console.log('Unknown action:', request.action);
        sendResponse({ success: false, error: '알 수 없는 액션: ' + request.action });
        return true;
      }
    });
  }
}

// ==================== 초기화 ====================
let configManager, nasApiClient, downloadManager;

// 초기화 함수
function initializeExtension() {
  console.log('=== Extension Initialization ===');
  
  try {
    console.log('Creating ConfigManager...');
    configManager = new ConfigManager();
    
    console.log('Creating NasApiClient...');
    nasApiClient = new NasApiClient(configManager);
    
    console.log('Creating DownloadManager...');
    downloadManager = new DownloadManager(configManager, nasApiClient);
    
    console.log('Setting up context menu...');
    ContextMenuManager.createContextMenu();
    ContextMenuManager.setupClickHandler(downloadManager);
    
    console.log('Setting up message handler...');
    MessageHandler.setup(downloadManager);
    
    console.log('Extension initialization complete');
  } catch (error) {
    console.error('Extension initialization error:', error);
  }
}

// 확장 프로그램 설치/업데이트 시 초기화
chrome.runtime.onInstalled.addListener((details) => {
  console.log('=== Extension Installed/Updated ===');
  console.log('Install details:', details);
  initializeExtension();
});

// 브라우저 시작 시 초기화
chrome.runtime.onStartup.addListener(() => {
  console.log('=== Browser Startup ===');
  initializeExtension();
}); 