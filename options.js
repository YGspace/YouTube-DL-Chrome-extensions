/**
 * Synology NAS Downloader - Options Page
 * 
 * 주요 기능:
 * - NAS 설정 관리
 * - 연결 테스트
 * - 설정 저장 및 로드
 */

// ==================== 상수 정의 ====================
const OPTIONS_CONSTANTS = {
  STORAGE_KEYS: ['nasUrl', 'userId', 'userPw', 'resolution'],
  DEFAULT_RESOLUTION: 'best',
  MESSAGES: {
    CONFIG_INCOMPLETE: '모든 필드를 입력해주세요.',
    INVALID_URL: '올바른 NAS 주소를 입력해주세요.',
    SAVE_SUCCESS: '설정이 저장되었습니다.',
    CONNECTION_TESTING: '연결을 테스트하고 있습니다...',
    CONNECTION_SUCCESS: '연결 테스트 성공! NAS에 정상적으로 연결되었습니다.',
    CONNECTION_FAILED: '연결 테스트 실패. NAS 주소, ID, 비밀번호를 확인해주세요.',
    CONNECTION_ERROR: '연결 테스트 중 오류가 발생했습니다: ',
    SAVE_FIRST: '먼저 설정을 저장해주세요.'
  },
  LOGIN_INDICATORS: {
    SUCCESS: ['Welcome', 'youtube-dl', '/youtube-dl'],
    FAILURE: ['id or password is not correct']
  }
};

// ==================== 설정 관리자 ====================
class OptionsConfigManager {
  constructor() {
    this.formElements = {
      nasUrl: document.getElementById('nasUrl'),
      userId: document.getElementById('userId'),
      userPw: document.getElementById('userPw'),
      resolution: document.getElementById('resolution')
    };
    this.statusElement = document.getElementById('status');
    this.connectionTester = null; // ConnectionTester 인스턴스를 저장할 변수
    this.init();
  }

  init() {
    this.loadSettings();
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('settingsForm').addEventListener('submit', (e) => this.saveSettings(e));
    document.getElementById('testConnection').addEventListener('click', () => this.handleTestConnection());
  }

  // 연결 테스트 핸들러
  handleTestConnection() {
    if (this.connectionTester) {
      this.connectionTester.testConnection();
    } else {
      console.error('ConnectionTester not initialized');
    }
  }

  // ConnectionTester 인스턴스 설정
  setConnectionTester(connectionTester) {
    this.connectionTester = connectionTester;
  }

  loadSettings() {
    chrome.storage.local.get(OPTIONS_CONSTANTS.STORAGE_KEYS, (result) => {
      this.formElements.nasUrl.value = result.nasUrl || '';
      this.formElements.userId.value = result.userId || '';
      this.formElements.userPw.value = result.userPw || '';
      this.formElements.resolution.value = result.resolution || OPTIONS_CONSTANTS.DEFAULT_RESOLUTION;
    });
  }

  getFormData() {
    return {
      nasUrl: this.formElements.nasUrl.value.trim(),
      userId: this.formElements.userId.value.trim(),
      userPw: this.formElements.userPw.value,
      resolution: this.formElements.resolution.value
    };
  }

  validateFormData(data) {
    if (!data.nasUrl || !data.userId || !data.userPw) {
      this.showStatus(OPTIONS_CONSTANTS.MESSAGES.CONFIG_INCOMPLETE, 'error');
      return false;
    }

    if (!this.isValidUrl(data.nasUrl)) {
      this.showStatus(OPTIONS_CONSTANTS.MESSAGES.INVALID_URL, 'error');
      return false;
    }

    return true;
  }

  async saveSettings(event) {
    event.preventDefault();
    
    const settings = this.getFormData();
    
    if (!this.validateFormData(settings)) {
      return;
    }

    chrome.storage.local.set(settings, () => {
      this.showStatus(OPTIONS_CONSTANTS.MESSAGES.SAVE_SUCCESS, 'success');
      
      // 백그라운드에 설정 업데이트 알림
      chrome.runtime.sendMessage({
        action: 'updateSettings',
        settings: settings
      });
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
    this.statusElement.textContent = message;
    this.statusElement.className = `status ${type}`;
    this.statusElement.style.display = 'block';
    
    // 성공 메시지는 3초 후 자동 숨김
    if (type === 'success') {
      setTimeout(() => {
        this.statusElement.style.display = 'none';
      }, 3000);
    }
  }
}

// ==================== 연결 테스터 ====================
class ConnectionTester {
  constructor(configManager) {
    this.configManager = configManager;
  }

  async testConnection() {
    const settings = this.configManager.getFormData();
    
    if (!this.configManager.validateFormData(settings)) {
      return;
    }
    
    this.configManager.showStatus(OPTIONS_CONSTANTS.MESSAGES.CONNECTION_TESTING, 'info');
    
    try {
      const loginSuccess = await this.testLogin(settings.nasUrl, settings.userId, settings.userPw);
      
      if (loginSuccess) {
        this.configManager.showStatus(OPTIONS_CONSTANTS.MESSAGES.CONNECTION_SUCCESS, 'success');
      } else {
        this.configManager.showStatus(OPTIONS_CONSTANTS.MESSAGES.CONNECTION_FAILED, 'error');
      }
    } catch (error) {
      console.error('Connection test error:', error);
      this.configManager.showStatus(OPTIONS_CONSTANTS.MESSAGES.CONNECTION_ERROR + error.message, 'error');
    }
  }

  async testLogin(nasUrl, userId, userPw) {
    try {
      const formData = new FormData();
      formData.append('id', userId);
      formData.append('myPw', userPw);
      
      const response = await fetch(`${nasUrl}/login`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      return this.validateLoginResponse(response, userId);
    } catch (error) {
      console.error('Login test error:', error);
      return false;
    }
  }

  async validateLoginResponse(response, userId) {
    // 302 리다이렉트는 성공
    if (response.status === 302) {
      return true;
    }

    const responseText = await response.text();
    
    // 실패 메시지 확인
    if (OPTIONS_CONSTANTS.LOGIN_INDICATORS.FAILURE.some(indicator => 
      responseText.includes(indicator))) {
      return false;
    }

    // 성공 지표 확인
    const hasSuccessIndicator = OPTIONS_CONSTANTS.LOGIN_INDICATORS.SUCCESS.some(indicator => 
      responseText.includes(indicator));
    
    const hasWelcomeMessage = responseText.includes('Welcome') && 
      responseText.includes(userId);

    return hasSuccessIndicator || hasWelcomeMessage || 
           (response.status === 200 && !responseText.includes('id or password is not correct'));
  }
}

// ==================== 메시지 핸들러 ====================
class OptionsMessageHandler {
  static setup() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'updateSettings') {
        console.log('Settings updated in background');
      }
    });
  }
}

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', function() {
  const configManager = new OptionsConfigManager();
  const connectionTester = new ConnectionTester(configManager);
  
  // configManager에 connectionTester 설정
  configManager.setConnectionTester(connectionTester);
  
  // 전역 함수로 연결 테스터 노출 (이벤트 리스너에서 사용)
  window.testConnection = () => connectionTester.testConnection();
  
  OptionsMessageHandler.setup();
}); 