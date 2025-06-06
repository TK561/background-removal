// グローバル変数
let selectedFiles = [];
let processingResults = [];
let currentUploadMethod = '';
let historyData = [];

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // 初期コンテンツをセット
    showTab('upload');
    
    // ドラッグ&ドロップイベントの設定
    setupDragAndDrop();
    
    // ファイル入力の設定
    setupFileInput();
    
    // 検索ボックスのイベント
    setupSearchEvents();
}

// タブ切り替え
function showTab(tabName) {
    // タブボタンの状態更新
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.includes(tabName === 'upload' ? '新規処理' : '履歴')) {
            btn.classList.add('active');
        }
    });
    
    // コンテンツの更新
    const content = document.getElementById('content');
    
    if (tabName === 'upload') {
        content.innerHTML = getUploadTabHTML();
        // アップロードタブの初期化
        setupUploadTab();
    } else if (tabName === 'history') {
        content.innerHTML = getHistoryTabHTML();
        // 履歴を読み込み
        loadHistory();
    }
}

// アップロードタブのHTML
function getUploadTabHTML() {
    return `
        <div id="uploadTab" class="tab-content active">
            <!-- アップロード方法選択 -->
            <div class="upload-section">
                <div class="upload-methods">
                    <div class="upload-method" onclick="selectUploadMethod('button')">
                        <div class="upload-icon">📁</div>
                        <div class="upload-title">ボタンで選択</div>
                        <div class="upload-desc">ファイル選択ダイアログから<br>複数の写真を選択</div>
                    </div>
                    <div class="upload-method" onclick="selectUploadMethod('drag')">
                        <div class="upload-icon">🎯</div>
                        <div class="upload-title">ドラッグ&ドロップ</div>
                        <div class="upload-desc">写真を直接ドラッグして<br>エリアにドロップ</div>
                    </div>
                </div>
                
                <!-- ボタン選択エリア -->
                <div class="file-select-container" id="buttonSelectArea" style="display: none;">
                    <button class="file-select-btn" onclick="document.getElementById('fileInput').click()">
                        📸 写真を選択（複数可）
                    </button>
                    <input type="file" id="fileInput" multiple accept="image/*" style="display: none;">
                </div>
                
                <!-- ドラッグ&ドロップエリア -->
                <div class="drop-zone" id="dropZone" style="display: none;">
                    <div style="font-size: 3rem; margin-bottom: 20px;">📸</div>
                    <div class="drop-zone-text">ここに写真をドラッグ&ドロップ</div>
                    <div class="drop-zone-hint">複数ファイル対応 | JPG, PNG, WebP | 最大50MB</div>
                </div>
            </div>
            
            <!-- 選択されたファイル一覧 -->
            <div class="selected-files" id="selectedFiles" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div style="font-size: 1.3rem; font-weight: bold;">📋 選択された写真</div>
                    <div id="filesSummary">0枚選択</div>
                </div>
                <div id="fileList"></div>
            </div>
            
            <!-- 処理開始 -->
            <div style="text-align: center; margin: 30px 0;">
                <button style="background: linear-gradient(45deg, #2196F3, #1976D2); color: white; border: none; 
                               padding: 18px 50px; font-size: 1.3rem; border-radius: 30px; cursor: pointer;" 
                        id="processBtn" onclick="startBatchProcessing()" disabled>
                    🚀 背景除去を開始
                </button>
            </div>
            
            <!-- バッチ処理進行状況 -->
            <div class="batch-progress" id="batchProgress" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div style="font-size: 1.3rem; font-weight: bold;">🔄 処理中...</div>
                    <div style="font-size: 1.1rem; color: #4CAF50;" id="batchProgressText">0/0</div>
                </div>
                <div style="width: 100%; height: 15px; background: rgba(255,255,255,0.2); border-radius: 10px; 
                            overflow: hidden; margin-bottom: 15px;">
                    <div style="height: 100%; background: linear-gradient(90deg, #4CAF50, #8BC34A); 
                                width: 0%; transition: width 0.5s ease;" id="batchProgressFill"></div>
                </div>
                <div style="opacity: 0.9; margin-bottom: 15px;" id="batchCurrent">処理を準備中...</div>
            </div>
            
            <!-- 結果表示 -->
            <div class="results" id="results" style="display: none;">
                <div style="font-size: 1.3rem; font-weight: bold; margin-bottom: 20px;">✅ 処理完了</div>
                <div id="resultsList"></div>
                <div style="text-align: center; margin-top: 20px;">
                    <button onclick="downloadAll()" style="background: linear-gradient(45deg, #4CAF50, #45a049); 
                                                          color: white; border: none; padding: 15px 30px; 
                                                          font-size: 1.1rem; border-radius: 25px; cursor: pointer;">
                        💾 すべてダウンロード
                    </button>
                </div>
            </div>
        </div>
    `;
}

// 履歴タブのHTML
function getHistoryTabHTML() {
    return `
        <div id="historyTab" class="tab-content">
            <div class="history-section">
                <div class="history-header">
                    <div class="history-title">📚 処理履歴</div>
                    <div class="history-controls">
                        <input type="text" class="search-box" id="historySearch" placeholder="🔍 ファイル名で検索">
                        <select class="filter-select" id="historyFilter">
                            <option value="7">過去7日間</option>
                            <option value="30" selected>過去30日間</option>
                            <option value="90">過去90日間</option>
                            <option value="365">過去1年間</option>
                        </select>
                        <button class="history-btn history-btn-secondary" onclick="refreshHistory()">
                            🔄 更新
                        </button>
                    </div>
                </div>
                
                <!-- 履歴統計 -->
                <div class="history-stats" id="historyStats">
                    <div class="history-stat">
                        <div class="history-stat-icon">📊</div>
                        <div class="history-stat-value" id="totalProcessed">0</div>
                        <div class="history-stat-label">処理済み</div>
                    </div>
                    <div class="history-stat">
                        <div class="history-stat-icon">💾</div>
                        <div class="history-stat-value" id="totalSize">0 MB</div>
                        <div class="history-stat-label">総容量</div>
                    </div>
                    <div class="history-stat">
                        <div class="history-stat-icon">⚡</div>
                        <div class="history-stat-value" id="avgTime">0s</div>
                        <div class="history-stat-label">平均処理時間</div>
                    </div>
                    <div class="history-stat">
                        <div class="history-stat-icon">📅</div>
                        <div class="history-stat-value" id="lastProcessed">-</div>
                        <div class="history-stat-label">最終処理</div>
                    </div>
                </div>
                
                <!-- 履歴リスト -->
                <div class="history-list" id="historyList">
                    <div class="history-empty">
                        <div class="history-empty-icon">📭</div>
                        <div class="history-empty-text">履歴がまだありません</div>
                        <div class="history-empty-hint">写真を処理すると、ここに履歴が表示されます</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// アップロードタブの設定
function setupUploadTab() {
    // ファイル入力の再設定
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
    
    // ドラッグ&ドロップの再設定
    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('drop', handleDrop);
        dropZone.addEventListener('dragleave', handleDragLeave);
    }
}

// アップロード方法選択
window.selectUploadMethod = function(method) {
    currentUploadMethod = method;
    document.getElementById('buttonSelectArea').style.display = method === 'button' ? 'block' : 'none';
    document.getElementById('dropZone').style.display = method === 'drag' ? 'block' : 'none';
    
    // アクティブ状態の更新
    document.querySelectorAll('.upload-method').forEach(div => div.classList.remove('active'));
    if (method === 'button') {
        document.querySelector('.upload-method[onclick*="button"]').classList.add('active');
    } else {
        document.querySelector('.upload-method[onclick*="drag"]').classList.add('active');
    }
};

// ファイル選択ハンドラ
function handleFileSelect(e) {
    selectedFiles = Array.from(e.target.files);
    updateSelectedFileList();
}

// ドラッグ&ドロップハンドラ
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files);
    selectedFiles = files.filter(file => file.type.startsWith('image/'));
    updateSelectedFileList();
}

// ファイル入力設定
function setupFileInput() {
    document.addEventListener('change', function(e) {
        if (e.target.id === 'fileInput') {
            handleFileSelect(e);
        }
    });
}

// ドラッグ&ドロップ設定
function setupDragAndDrop() {
    document.addEventListener('dragover', function(e) {
        if (e.target.id === 'dropZone' || e.target.closest('#dropZone')) {
            handleDragOver(e);
        }
    });
    
    document.addEventListener('drop', function(e) {
        if (e.target.id === 'dropZone' || e.target.closest('#dropZone')) {
            handleDrop(e);
        }
    });
    
    document.addEventListener('dragleave', function(e) {
        if (e.target.id === 'dropZone' || e.target.closest('#dropZone')) {
            handleDragLeave(e);
        }
    });
}

// 選択ファイルリスト更新
function updateSelectedFileList() {
    const fileList = document.getElementById('fileList');
    const filesSummary = document.getElementById('filesSummary');
    const selectedFilesDiv = document.getElementById('selectedFiles');
    const processBtn = document.getElementById('processBtn');
    
    if (selectedFiles.length === 0) {
        selectedFilesDiv.style.display = 'none';
        processBtn.disabled = true;
        return;
    }
    
    fileList.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 10px; background: rgba(255,255,255,0.1); border-radius: 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;';
        div.innerHTML = `
            <span>${file.name} (${formatFileSize(file.size)})</span>
            <button onclick="removeFile(${index})" style="background: none; border: none; color: #f44336; cursor: pointer; font-size: 1.2rem;">❌</button>
        `;
        fileList.appendChild(div);
    });
    
    filesSummary.textContent = `${selectedFiles.length}枚選択`;
    selectedFilesDiv.style.display = 'block';
    processBtn.disabled = false;
}

// ファイル削除
window.removeFile = function(index) {
    selectedFiles.splice(index, 1);
    updateSelectedFileList();
};

// バッチ処理開始
window.startBatchProcessing = async function() {
    if (selectedFiles.length === 0) return;
    
    const processBtn = document.getElementById('processBtn');
    const batchProgress = document.getElementById('batchProgress');
    const results = document.getElementById('results');
    
    processBtn.disabled = true;
    batchProgress.style.display = 'block';
    results.style.display = 'none';
    
    // FormDataを作成
    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('files', file);
    });
    
    try {
        // プログレス更新
        updateProgress(0, selectedFiles.length, '処理を開始しています...');
        
        // サーバーに送信
        const response = await fetch('/process', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('処理に失敗しました');
        }
        
        const data = await response.json();
        
        if (data.success) {
            processingResults = data.results;
            showResults();
        } else {
            throw new Error(data.error || '処理に失敗しました');
        }
        
    } catch (error) {
        alert('エラー: ' + error.message);
    } finally {
        processBtn.disabled = false;
        batchProgress.style.display = 'none';
    }
};

// プログレス更新
function updateProgress(current, total, message) {
    const progressText = document.getElementById('batchProgressText');
    const progressFill = document.getElementById('batchProgressFill');
    const currentText = document.getElementById('batchCurrent');
    
    progressText.textContent = `${current}/${total}`;
    progressFill.style.width = `${(current / total) * 100}%`;
    currentText.textContent = message;
}

// 結果表示
function showResults() {
    const results = document.getElementById('results');
    const resultsList = document.getElementById('resultsList');
    
    resultsList.innerHTML = '';
    
    processingResults.forEach((result, index) => {
        const resultDiv = document.createElement('div');
        resultDiv.style.cssText = 'background: rgba(255,255,255,0.1); border-radius: 15px; padding: 20px; margin-bottom: 20px;';
        resultDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3>${result.filename}</h3>
                <span style="color: #4CAF50;">処理時間: ${result.processing_time.toFixed(2)}秒</span>
            </div>
            <div style="text-align: center; margin-bottom: 15px;">
                <img src="${result.result_data}" style="max-width: 300px; max-height: 300px; border-radius: 10px;">
            </div>
            <div style="text-align: center;">
                <a href="${result.result_data}" download="nobg_${result.filename}" 
                   style="background: linear-gradient(45deg, #4CAF50, #45a049); color: white; 
                          text-decoration: none; padding: 10px 20px; border-radius: 20px; 
                          display: inline-block;">
                    💾 ダウンロード
                </a>
            </div>
        `;
        resultsList.appendChild(resultDiv);
    });
    
    results.style.display = 'block';
    
    // 選択ファイルをクリア
    selectedFiles = [];
    updateSelectedFileList();
}

// すべてダウンロード
window.downloadAll = function() {
    processingResults.forEach((result, index) => {
        const a = document.createElement('a');
        a.href = result.result_data;
        a.download = `nobg_${result.filename}`;
        a.click();
        
        // 遅延を入れて連続ダウンロードを防ぐ
        setTimeout(() => {}, index * 100);
    });
};

// 履歴関連
async function loadHistory() {
    try {
        const searchQuery = document.getElementById('historySearch')?.value || '';
        const daysBack = document.getElementById('historyFilter')?.value || '30';
        
        const response = await fetch(`/history?search=${encodeURIComponent(searchQuery)}&days=${daysBack}`);
        const data = await response.json();
        
        historyData = data.items;
        updateHistoryStats(data.stats);
        renderHistoryList(data.items);
        
    } catch (error) {
        console.error('履歴読み込みエラー:', error);
    }
}

function updateHistoryStats(stats) {
    document.getElementById('totalProcessed').textContent = stats.total_count;
    document.getElementById('totalSize').textContent = formatFileSize(stats.total_size || 0);
    document.getElementById('avgTime').textContent = (stats.avg_time || 0).toFixed(1) + 's';
    
    if (historyData.length > 0) {
        const lastDate = new Date(historyData[0].created_at);
        document.getElementById('lastProcessed').textContent = formatRelativeTime(lastDate);
    } else {
        document.getElementById('lastProcessed').textContent = '-';
    }
}

function renderHistoryList(items) {
    const historyList = document.getElementById('historyList');
    
    if (items.length === 0) {
        historyList.innerHTML = `
            <div class="history-empty">
                <div class="history-empty-icon">🔍</div>
                <div class="history-empty-text">該当する履歴がありません</div>
                <div class="history-empty-hint">検索条件を変更してみてください</div>
            </div>
        `;
        return;
    }
    
    historyList.innerHTML = '';
    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'history-item';
        itemDiv.innerHTML = `
            <div class="history-item-header">
                <div class="history-item-info">
                    <div class="history-item-filename">${item.filename}</div>
                    <div class="history-item-meta">
                        <span>📐 ${item.image_width}×${item.image_height}</span>
                        <span>💾 ${formatFileSize(item.file_size)}</span>
                        <span>⚡ ${item.processing_time.toFixed(1)}秒</span>
                        <span>📅 ${formatRelativeTime(new Date(item.created_at))}</span>
                    </div>
                </div>
                <div class="history-item-actions">
                    <a href="/download/${item.session_id}" class="history-btn">
                        💾 ダウンロード
                    </a>
                </div>
            </div>
        `;
        historyList.appendChild(itemDiv);
    });
}

// 履歴更新
window.refreshHistory = function() {
    loadHistory();
};

// 検索イベント設定
function setupSearchEvents() {
    document.addEventListener('input', function(e) {
        if (e.target.id === 'historySearch') {
            // デバウンス処理
            clearTimeout(window.searchTimeout);
            window.searchTimeout = setTimeout(() => {
                loadHistory();
            }, 500);
        }
    });
    
    document.addEventListener('change', function(e) {
        if (e.target.id === 'historyFilter') {
            loadHistory();
        }
    });
}

// ユーティリティ関数
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatRelativeTime(date) {
    const now = new Date();
    const diff = (now - date) / 1000;
    
    if (diff < 60) return `${Math.floor(diff)}秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}日前`;
    
    return date.toLocaleDateString('ja-JP');
}