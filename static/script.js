// --- 全局变量和初始化 ---
const synth = window.speechSynthesis;
let voices = [];
let currentPage = 1;
const itemsPerPage = 5;
let currentAnalysisData = null; // 当前分析结果对象，用于可编辑备注与导出/收藏同步
let currentSearchTerm = '';

const MINI_MAX_VOICE_MAP = {
    '英式英语【媒体】': 'moss_audio_80254f50-bc80-11f0-8d50-aebac59e892f',
    '自然节目主持人男声': 'English_Magnetic_Male_12',
    '新闻播报男声': 'English_Lively_Male_10'
};

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isRecognizing = false;
let currentAudio = null;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
}

// 等待语音列表可用
function waitForVoices(timeoutMs = 1000) {
    return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
            const list = synth.getVoices();
            if (list && list.length > 0) {
                voices = list;
                resolve();
            } else if (Date.now() - start < timeoutMs) {
                setTimeout(check, 100);
            } else {
                resolve(); // 超时也继续，使用默认声音
            }
        };
        check();
    });
}

function populateVoiceList() {
    voices = synth.getVoices();
}
populateVoiceList();
if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = populateVoiceList;
}

// --- 核心功能 ---
// script.js - 修复 speak 函数中的 API 调用
// script.js - 修复 speak 函数
async function speak(text) {
    try {
        if (!text || typeof text !== 'string') {
            console.error('Speak function called with invalid text:', text);
            return;
        }

        // 停止当前可能在播放的任何音频
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        synth.cancel();

        const selectedVoiceName = document.getElementById('voice-selector').value;

        if (selectedVoiceName === 'browser-default') {
            // 使用浏览器自带TTS
            if (synth.speaking) {
                setTimeout(() => speak(text), 100);
                return;
            }
            await waitForVoices();
            const utterThis = new SpeechSynthesisUtterance(text);
            utterThis.lang = 'en-GB';
            const britishVoice = voices.find(voice => voice.lang === 'en-GB') || voices.find(voice => voice.lang.startsWith('en-'));
            if (britishVoice) {
                utterThis.voice = britishVoice;
            }
            synth.speak(utterThis);
        } else {
            // 使用 MiniMax TTS - 增强错误处理
            const voiceId = MINI_MAX_VOICE_MAP[selectedVoiceName];

            if (!voiceId) {
                console.error(`Custom voice "${selectedVoiceName}" not found in map.`);
                alert(`自定义音色 "${selectedVoiceName}" 查找失败，已切换到默认语音。`);
                speakWithDefaultVoice(text);
                return;
            }

            console.log('Using custom voice:', selectedVoiceName, '->', voiceId, 'for text:', text);
            
            try {
                const response = await fetch('/api/text_to_speech', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        text: text, 
                        voice_id: voiceId 
                    })
                });

                // 检查响应内容类型
                const contentType = response.headers.get('content-type');
                console.log('Response content-type:', contentType);

                if (response.ok && contentType && contentType.includes('audio')) {
                    // 成功获取音频
                    const audioBlob = await response.blob();
                    console.log('Audio blob type:', audioBlob.type, 'size:', audioBlob.size);
                    
                    if (audioBlob.size > 0) {
                        const audioUrl = URL.createObjectURL(audioBlob);
                        currentAudio = new Audio(audioUrl);
                        
                        // 添加错误监听
                        currentAudio.onerror = (e) => {
                            console.error('Audio element error:', e);
                            throw new Error('Audio playback failed');
                        };
                        
                        await currentAudio.play();
                        console.log('Audio playback started successfully');
                    } else {
                        throw new Error('Empty audio blob received');
                    }
                } else {
                    // 获取错误信息
                    let errorData;
                    try {
                        errorData = await response.json();
                    } catch (e) {
                        errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
                    }
                    
                    console.error('TTS API error:', errorData);
                    throw new Error(errorData.details || errorData.error || `TTS failed with status ${response.status}`);
                }
            } catch (apiError) {
                console.warn('Custom TTS failed, falling back to default voice:', apiError);
                
                // 用户友好的错误提示
                if (apiError.message.includes('MINIMAX_API_KEY')) {
                    alert('TTS服务配置错误：请检查API密钥设置');
                } else if (apiError.message.includes('TTS service')) {
                    alert('TTS服务暂时不可用，已切换到默认语音');
                } else {
                    alert('自定义语音生成失败，已切换到默认语音');
                }
                
                // 降级到浏览器默认语音
                speakWithDefaultVoice(text);
            }
        }
    } catch (e) {
        console.error('All TTS methods failed:', e);
        // 最终降级方案
        speakWithDefaultVoice(text);
    }
}

// 确保降级函数存在
function speakWithDefaultVoice(text) {
    if (synth.speaking) {
        synth.cancel();
    }
    const utterThis = new SpeechSynthesisUtterance(text);
    utterThis.lang = 'en-GB';
    
    // 尝试找到英式英语语音
    const britishVoice = voices.find(voice => 
        voice.lang === 'en-GB' || voice.name.toLowerCase().includes('british')
    );
    if (britishVoice) {
        utterThis.voice = britishVoice;
    }
    
    synth.speak(utterThis);
}







// 添加降级函数
function speakWithDefaultVoice(text) {
    if (synth.speaking) {
        synth.cancel();
    }
    
    const utterThis = new SpeechSynthesisUtterance(text);
    utterThis.lang = 'en-GB';
    synth.speak(utterThis);
}


function startSpeechRecognition(micIcon, targetInput) {
    if (!recognition) {
        alert("抱歉，您的浏览器不支持语音识别。请尝试使用最新版的Chrome或Edge。");
        return;
    }
    if (isRecognizing) {
        console.log("Speech recognition is already active.");
        return;
    }

    isRecognizing = true;
    micIcon.classList.add('recording');
    targetInput.value = '正在聆听...';

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        targetInput.value = transcript;
    };
    recognition.onspeechend = () => {
        recognition.stop();
    };
    recognition.onend = () => {
        micIcon.classList.remove('recording');
        if (targetInput.value === '正在聆听...') {
            targetInput.value = '';
        }
        isRecognizing = false;
    };
    recognition.onerror = (event) => {
        console.error("语音识别错误:", event.error);
        if (event.error === 'not-allowed') {
            targetInput.value = '麦克风权限被禁用，请检查浏览器设置。';
            alert('您需要允许网页访问您的麦克风才能使用语音识别功能。\n\n请点击地址栏左侧的图标（通常是一个锁），然后在弹出的菜单中允许麦克风访问，最后刷新页面重试。');
        } else {
            targetInput.value = '识别失败，请重试。';
        }
        isRecognizing = false;
    };
    recognition.start();
}


// API 调用函数
async function analyzeSentence(sentence) {
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sentence: sentence
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || '分析失败');
        }
        
        return data;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

// --- 事件监听器 ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('show-analyzer-btn').addEventListener('click', showAnalyzer);
    document.getElementById('show-favorites-btn').addEventListener('click', showFavorites);
    document.getElementById('analyze-btn').addEventListener('click', handleAnalysis);
    document.body.addEventListener('click', handleBodyClick);
    document.getElementById('select-all-checkbox').addEventListener('change', handleSelectAll);
    
    // 收藏页搜索功能
    const searchInput = document.getElementById('favorites-search');
    searchInput.addEventListener('input', handleFavoriteSearch);
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleFavoriteSearch({ target: e.target });
    });
    const searchIcon = document.querySelector('.search-icon');
    if (searchIcon) {
        searchIcon.style.cursor = 'pointer';
        searchIcon.addEventListener('click', () => handleFavoriteSearch({ target: searchInput }));
    }

    // 收藏页筛选功能
    const reviewFilter = document.getElementById('review-filter');
    if (reviewFilter) {
        reviewFilter.addEventListener('change', () => { 
            currentPage = 1; 
            renderFavoritesList(getFilteredFavorites()); 
        });
    }

    // 复习按钮
    document.getElementById('start-review-btn').addEventListener('click', startReviewSession);
    document.getElementById('start-review-btn-main').addEventListener('click', startReviewSession);
    document.getElementById('batch-export-btn').addEventListener('click', handleBatchExport);
    
    // --- "回到顶部"按钮逻辑 ---
    const backToTopBtn = document.getElementById('back-to-top-btn');
    const scrollHandler = () => {
        if (window.scrollY > 300 || document.documentElement.scrollTop > 300) {
            backToTopBtn.classList.add('show');
        } else {
            backToTopBtn.classList.remove('show');
        }
    };
    
    window.addEventListener('scroll', scrollHandler);

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    showAnalyzer();
});

function handleFavoriteSearch(event) {
    currentSearchTerm = (event.target.value || '').toLowerCase();
    currentPage = 1;
    renderFavoritesList(getFilteredFavorites());
}

// 使中文文本可编辑
document.body.addEventListener('click', function(event) {
    if (event.target.classList.contains('edit-icon')) {
        makeEditable(event.target);
    }
});

function makeEditable(icon) {
    const path = icon.dataset.path;
    const textSpan = icon.previousElementSibling; // 与editable-text紧邻
    if (!textSpan || !currentAnalysisData) return;

    const currentText = textSpan.textContent;
    const parent = textSpan.parentElement;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'edit-input';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '保存';
    saveBtn.className = 'save-btn';

    const container = document.createElement('div');
    container.className = 'edit-container';
    container.appendChild(input);
    container.appendChild(saveBtn);

    icon.style.display = 'none';
    textSpan.style.display = 'none';
    parent.insertBefore(container, textSpan.nextSibling);

    saveBtn.onclick = function() {
        const newText = input.value;

        const keys = path.split('.');
        let obj = currentAnalysisData;
        for (let i = 0; i < keys.length - 1; i++) {
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = newText;

        textSpan.textContent = newText;
        parent.removeChild(container);
        icon.style.display = '';
        textSpan.style.display = '';

        const favorites = JSON.parse(localStorage.getItem('sentenceFavorites')) || [];
        const favoritedItem = favorites.find(item => item.original_sentence === currentAnalysisData.original_sentence);
        if (favoritedItem) {
            let favObj = favoritedItem;
            for (let i = 0; i < keys.length - 1; i++) {
                favObj = favObj[keys[i]];
            }
            favObj[keys[keys.length - 1]] = newText;
            localStorage.setItem('sentenceFavorites', JSON.stringify(favorites));
        }
    };
}

function handleBodyClick(event) {
    // Speaker Icon
    if (event.target.classList.contains('speaker-icon')) {
        speak(event.target.dataset.text);
    }

    // Mic Icon for review
    if (event.target.classList.contains('review-mic-icon')) {
        const input = event.target.nextElementSibling;
        if (input && input.classList.contains('user-transcription')) {
            startSpeechRecognition(event.target, input);
        }
    }

    // Check Button for review
    if (event.target.classList.contains('check-btn')) {
        const correct = event.target.dataset.correct;
        const sent = event.target.dataset.sent;
        const rowkey = event.target.dataset.rowkey;
        const interactionArea = event.target.parentElement;
        const userInput = interactionArea.querySelector('.user-transcription').value;
        const diffResult = interactionArea.nextElementSibling;

        if (diffResult && diffResult.classList.contains('diff-result')) {
            compareSentences(userInput, correct, diffResult);
            markProgress(sent, rowkey);
        }
    }
}


async function handleAnalysis() {
    const sentence = document.getElementById('sentence-input').value.trim();
    if (!sentence) {
        alert('请输入一个英文句子！');
        return;
    }
    
    const loadingDiv = document.getElementById('loading');
    const resultsContainer = document.getElementById('results-container');
    const analyzeBtn = document.getElementById('analyze-btn');
    
    const headerFavBtn = document.getElementById('header-favorite-btn');
    const headerExportBtn = document.getElementById('header-export-btn');
    headerFavBtn.disabled = true;
    headerFavBtn.innerHTML = '<i class="fas fa-star"></i> 收藏';
    headerFavBtn.classList.remove('favorited');
    headerExportBtn.disabled = true;

    loadingDiv.classList.remove('hidden');
    resultsContainer.innerHTML = '';
    document.getElementById('footer-actions').classList.add('hidden');
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '分析中...';

    try {
        const data = await analyzeSentence(sentence);
        displayResults(data);
    } catch (error) {
        console.error('分析失败:', error);
        alert('分析失败：' + error.message);
    } finally {
        loadingDiv.classList.add('hidden');
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = '立即分析';
    }
}

function displayResults(data) {
    const container = document.getElementById('results-container');
    container.innerHTML = '';
    currentAnalysisData = data;

    // 分析成功后显示音色选择器
    document.getElementById('voice-selector-container').classList.remove('hidden');

    const addSpeaker = (text) => `${text} <span class="speaker-icon" data-text="${text.replace(/"/g, '&quot;')}">🔊</span>`;
    const addEditable = (text, path) => `
        <span class="editable-text" data-path="${path}">${text}</span>
        <i class="fas fa-pencil-alt edit-icon" data-path="${path}"></i>
    `;

    container.innerHTML += `<div class="card"><h2 class="card-title">句型与语法分析</h2><div class="pattern-analysis"><p><strong>句型公式:</strong></p><p class="formula">${data.patternAnalysis.formula}</p><p><strong>语法点:</strong></p><p>${data.patternAnalysis.grammarPoint}</p></div></div>`;
    
    let keyPhrasesHtml = data.keyPhrases.map((phrase, i) => `<div class="grid-item cn">${addEditable(phrase.cn, `keyPhrases.${i}.cn`)}</div><div class="grid-item en">${addSpeaker(phrase.en)}</div>`).join('');
    container.innerHTML += `<div class="card"><h2 class="card-title">重要词组提取</h2><div class="two-column-grid">${keyPhrasesHtml}</div></div>`;
    
    let scenariosHtml = Object.entries(data.scenarioSentences).map(([title, sentences]) => `<div class="scenario-group"><h3 class="scenario-title">${title}</h3>${sentences.map((s, j) => `<div class="two-column-grid"><div class="grid-item cn">${addEditable(s.cn, `scenarioSentences.${title}.${j}.cn`)}</div><div class="grid-item en">${addSpeaker(s.en)}</div></div>`).join('')}</div>`).join('');
    container.innerHTML += `<div class="card"><h2 class="card-title">不同场景高频表达</h2>${scenariosHtml}</div>`;
    
    let transformationsHtml = data.transformations.map((t, i) => `
        <div class="two-column-grid transformation-item">
            <div class="grid-item cn">
                <span class="type">${t.type}:</span>
                ${addEditable(t.cn, `transformations.${i}.cn`)}
            </div>
            <div class="grid-item en">${addSpeaker(t.en)}</div>
        </div>
    `).join('');
    container.innerHTML += `<div class="card"><h2 class="card-title">句型转换</h2>${transformationsHtml}</div>`;

    const footerActions = document.getElementById('footer-actions');
    footerActions.classList.remove('hidden');

    const favoriteBtn = document.getElementById('footer-favorite-btn');
    const exportBtn = document.getElementById('footer-export-btn');
    const headerFavBtn2 = document.getElementById('header-favorite-btn');
    const headerExportBtn2 = document.getElementById('header-export-btn');

    const isFavorited = (JSON.parse(localStorage.getItem('sentenceFavorites')) || []).some(item => item.original_sentence === data.original_sentence);

    const applyFavState = (btn, fav) => {
        if (!btn) return;
        if (fav) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-check"></i> 已收藏';
            btn.classList.add('favorited');
        } else {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-star"></i> 收藏';
            btn.classList.remove('favorited');
        }
    };

    applyFavState(favoriteBtn, isFavorited);
    applyFavState(headerFavBtn2, isFavorited);
    
    const bindFav = (btn) => {
        if (!btn) return;
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        if (!isFavorited) {
            newBtn.addEventListener('click', () => handleAddToFavorites(currentAnalysisData));
        }
    };
    bindFav(favoriteBtn);
    bindFav(headerFavBtn2);

    const bindExport = (btn) => {
        if (!btn) return;
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.disabled = false;
        newBtn.addEventListener('click', () => handleExportToExcel(currentAnalysisData));
    };
    bindExport(exportBtn);
    bindExport(headerExportBtn2);
}

function handleBatchExport() {
    const selectedIndexes = Array.from(document.querySelectorAll('.review-checkbox:checked'))
        .map(cb => parseInt(cb.dataset.index));

    if (selectedIndexes.length === 0) {
        alert('请至少选择一个句子进行导出！');
        return;
    }

    const allFavorites = JSON.parse(localStorage.getItem('sentenceFavorites')) || [];
    const itemsToExport = selectedIndexes.map(index => allFavorites[index]).filter(Boolean);

    const workbook = XLSX.utils.book_new();

    itemsToExport.forEach(data => {
        const exportData = [];
        exportData.push(['项目', '中文', '英文']);
        exportData.push(['原句', '', data.original_sentence]);
        exportData.push(['句型公式', data.patternAnalysis.formula, '']);
        exportData.push(['语法点', data.patternAnalysis.grammarPoint, '']);
        exportData.push([]);
        exportData.push(['重要词组']);
        data.keyPhrases.forEach(phrase => exportData.push(['', phrase.cn, phrase.en]));
        exportData.push([]);
        exportData.push(['不同场景高频表达']);
        Object.entries(data.scenarioSentences).forEach(([title, sentences]) => {
            exportData.push(['', title, '']);
            sentences.forEach(s => exportData.push(['', s.cn, s.en]));
        });
        exportData.push([]);
        exportData.push(['句型转换']);
        data.transformations.forEach(t => exportData.push([t.type, t.cn, t.en]));
        
        const worksheet = XLSX.utils.aoa_to_sheet(exportData);
        worksheet['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 40 }];
        
        // 清理句子以用作表名
        const sheetName = data.original_sentence.replace(/[\\/*?[\]:]/g, "").slice(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    XLSX.writeFile(workbook, '批量导出-句子分析.xlsx');
}


function handleExportToExcel(data) {
    const exportData = [];
    exportData.push(['项目', '中文', '英文']);
    exportData.push(['原句', '', data.original_sentence]);
    exportData.push(['句型公式', data.patternAnalysis.formula, '']);
    exportData.push(['语法点', data.patternAnalysis.grammarPoint, '']);
    exportData.push([]);
    exportData.push(['重要词组']);
    data.keyPhrases.forEach(phrase => exportData.push(['', phrase.cn, phrase.en]));
    exportData.push([]);
    exportData.push(['不同场景高频表达']);
    Object.entries(data.scenarioSentences).forEach(([title, sentences]) => {
        exportData.push(['', title, '']);
        sentences.forEach(s => exportData.push(['', s.cn, s.en]));
    });
    exportData.push([]);
    exportData.push(['句型转换']);
    data.transformations.forEach(t => exportData.push([t.type, t.cn, t.en]));
    const worksheet = XLSX.utils.aoa_to_sheet(exportData);
    worksheet['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 40 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '句子分析');
    XLSX.writeFile(workbook, `句子分析-${data.original_sentence.slice(0, 10)}.xlsx`);
}

function handleAddToFavorites(analysisData) {
    try {
        const existingFavorites = JSON.parse(localStorage.getItem('sentenceFavorites')) || [];
        const sentence = analysisData.original_sentence;
        if (existingFavorites.some(item => item.original_sentence === sentence)) {
            alert('这个句子已经收藏过了！');
            return;
        }
        const itemToSave = JSON.parse(JSON.stringify(analysisData));
        itemToSave._meta = { favoritedAt: Date.now(), reviewCount: 0 };
        existingFavorites.unshift(itemToSave);
        localStorage.setItem('sentenceFavorites', JSON.stringify(existingFavorites));
        alert(`句子 "${sentence}" 已成功添加到收藏夹！`);
        
        const favoriteBtn = document.getElementById('footer-favorite-btn');
        const headerFavBtn = document.getElementById('header-favorite-btn');
        [favoriteBtn, headerFavBtn].forEach(btn => {
            if (!btn) return;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-check"></i> 已收藏';
            btn.classList.add('favorited');
        });
    } catch (error) {
        console.error("添加到收藏夹时发生错误:", error);
        alert("收藏失败，请检查浏览器控制台获取更多信息。");
    }
}

function showAnalyzer() {
    document.getElementById('analyzer-section').classList.remove('hidden');
    document.getElementById('favorites-section').classList.add('hidden');
    document.getElementById('show-analyzer-btn').classList.add('active');
    document.getElementById('show-favorites-btn').classList.remove('active');
}

function showFavorites() {
    document.getElementById('analyzer-section').classList.add('hidden');
    document.getElementById('favorites-section').classList.remove('hidden');
    document.getElementById('show-analyzer-btn').classList.remove('active');
    document.getElementById('show-favorites-btn').classList.add('active');
    currentPage = 1;
    document.getElementById('favorites-search').value = '';
    currentSearchTerm = '';
    renderFavoritesList(getFilteredFavorites());
}

function renderFavoritesList(favoritesToShow) {
    let favorites = favoritesToShow || JSON.parse(localStorage.getItem('sentenceFavorites')) || [];
    const container = document.getElementById('favorites-list-container');
    const controlsHeader = document.getElementById('review-controls-header');
    document.getElementById('review-area').innerHTML = '';

    favorites = favorites.slice().sort((a, b) => {
        const ar = (a._meta && a._meta.reviewCount) ? a._meta.reviewCount : 0;
        const br = (b._meta && b._meta.reviewCount) ? b._meta.reviewCount : 0;
        if (ar !== br) return ar - br;
        const at = (a._meta && a._meta.favoritedAt) ? a._meta.favoritedAt : 0;
        const bt = (b._meta && b._meta.favoritedAt) ? b._meta.favoritedAt : 0;
        return bt - at;
    });

    if (favorites.length === 0) {
        const searchTerm = document.getElementById('favorites-search').value;
        container.innerHTML = `<div class="card"><p>${searchTerm ? '没有找到匹配的收藏结果。' : '您的收藏夹是空的，快去分析并收藏句子吧！'}</p></div>`;
        controlsHeader.classList.add('hidden');
        document.getElementById('pagination-controls').innerHTML = '';
        return;
    }

    controlsHeader.classList.remove('hidden');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedItems = favorites.slice(startIndex, startIndex + itemsPerPage);

    const fullList = JSON.parse(localStorage.getItem('sentenceFavorites')) || [];
    container.innerHTML = paginatedItems.map((item) => {
        const originalIndex = fullList.findIndex(fav => fav.original_sentence === item.original_sentence);
        const count = (item._meta && item._meta.reviewCount) ? item._meta.reviewCount : 0;
        return `
        <div class="favorite-item card">
            <div class="favorite-item-main">
                <input type="checkbox" class="review-checkbox" data-index="${originalIndex}">
                <div class="favorite-item-content">
                    <p class="favorite-sentence">${item.original_sentence}</p>
                    <span class="review-count">复习 ${count} 次</span>
                </div>
            </div>
            <div class="favorite-item-controls">
                <button class="delete-fav-btn" data-index="${originalIndex}">删除</button>
            </div>
        </div>
    `}).join('');
    
    container.querySelectorAll('.delete-fav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteFavorite(parseInt(e.target.dataset.index)));
    });
    
    container.querySelectorAll('.review-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', updateReviewButtonsState);
    });

    renderPaginationControls(favorites.length);
    document.getElementById('select-all-checkbox').checked = false;
    updateReviewButtonsState(); // Set initial button state
}

function updateReviewButtonsState() {
    const selectedCount = document.querySelectorAll('#favorites-list-container .review-checkbox:checked').length;
    const isAnySelected = selectedCount > 0;
    document.getElementById('start-review-btn').disabled = !isAnySelected;
    document.getElementById('start-review-btn-main').disabled = !isAnySelected;
}

function renderPaginationControls(totalItems) {
    const paginationContainer = document.getElementById('pagination-controls');
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    paginationContainer.innerHTML = '';

    if (totalPages <= 1) return;

    const createButton = (text, page, isDisabled = false) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.disabled = isDisabled;
        button.addEventListener('click', () => changePage(page));
        return button;
    };

    paginationContainer.appendChild(createButton('首页', 1, currentPage === 1));
    paginationContainer.appendChild(createButton('上一页', currentPage - 1, currentPage === 1));
    
    const pageInfoContainer = document.createElement('div');
    pageInfoContainer.className = 'page-info-container';
    
    const pageInfo = document.createElement('span');
    pageInfo.id = 'page-info';
    pageInfo.textContent = `第 ${currentPage} / ${totalPages} 页`;

    const pageInput = document.createElement('input');
    pageInput.type = 'number';
    pageInput.id = 'page-input';
    pageInput.min = 1;
    pageInput.max = totalPages;
    pageInput.placeholder = `页码`;
    pageInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            const page = parseInt(e.target.value);
            if (page >= 1 && page <= totalPages) {
                changePage(page);
            } else {
                alert(`请输入 1 到 ${totalPages} 之间的有效页码。`);
            }
        }
    });

    pageInfoContainer.append(pageInfo, pageInput);
    paginationContainer.append(pageInfoContainer);

    paginationContainer.appendChild(createButton('下一页', currentPage + 1, currentPage === totalPages));
    paginationContainer.appendChild(createButton('尾页', totalPages, currentPage === totalPages));
}

function changePage(newPage) {
    if (newPage < 1 || newPage > Math.ceil((getFilteredFavorites().length || 0) / itemsPerPage)) {
        return;
    }
    currentPage = newPage;
    renderFavoritesList(getFilteredFavorites());
}

function deleteFavorite(indexToDelete) {
    if (!confirm("确定要删除这个收藏吗？")) return;
    let favorites = JSON.parse(localStorage.getItem('sentenceFavorites')) || [];
    favorites.splice(indexToDelete, 1);
    localStorage.setItem('sentenceFavorites', JSON.stringify(favorites));

    const totalPages = Math.ceil(getFilteredFavorites().length / itemsPerPage);
    if (currentPage > totalPages) {
        currentPage = totalPages > 0 ? totalPages : 1;
    }
    renderFavoritesList(getFilteredFavorites());
}

function handleSelectAll(event) {
    const isChecked = event.target.checked;
    document.querySelectorAll('#favorites-list-container .review-checkbox').forEach(checkbox => {
        checkbox.checked = isChecked;
    });
    updateReviewButtonsState();
}

function compareSentences(userInput, correctSentence, resultContainer) {
    const process = (str) => str.toLowerCase().replace(/[.,?!]/g, '');
    const diff = Diff.diffWords(process(correctSentence), process(userInput));
    let html = '';
    diff.forEach((part) => {
        const className = part.added ? 'diff-added' : part.removed ? 'diff-removed' : 'diff-correct';
        html += `<span class="${className}">${part.value}</span>`;
    });

    const speakerIconHtml = `<span class="speaker-icon" data-text="${correctSentence.replace(/"/g, '&quot;')}">🔊</span>`;
    resultContainer.innerHTML = `
        <div class="comparison-result">您的回答对比：${html}</div>
        <div class="correct-answer">正确答案: ${correctSentence} ${speakerIconHtml}</div>
    `;
}

function initReviewTargets(items) {
    const progress = JSON.parse(localStorage.getItem('reviewProgress') || '{}');
    items.forEach(item => {
        const total = item.keyPhrases.length + Object.values(item.scenarioSentences).flat().length + item.transformations.length;
        if (!progress[item.original_sentence]) {
            progress[item.original_sentence] = { total, done: [] };
        } else {
            progress[item.original_sentence].total = total;
        }
    });
    localStorage.setItem('reviewProgress', JSON.stringify(progress));
}

function markProgress(originalSentence, rowKey) {
    const progress = JSON.parse(localStorage.getItem('reviewProgress') || '{}');
    if (!progress[originalSentence]) return;
    const done = new Set(progress[originalSentence].done || []);
    done.add(rowKey);
    progress[originalSentence].done = Array.from(done);
    localStorage.setItem('reviewProgress', JSON.stringify(progress));

    if (done.size >= (progress[originalSentence].total || 0)) {
        const favorites = JSON.parse(localStorage.getItem('sentenceFavorites')) || [];
        const idx = favorites.findIndex(f => f.original_sentence === originalSentence);
        if (idx !== -1) {
            favorites[idx]._meta = favorites[idx]._meta || { favoritedAt: Date.now(), reviewCount: 0 };
            favorites[idx]._meta.reviewCount = (favorites[idx]._meta.reviewCount || 0) + 1;
            localStorage.setItem('sentenceFavorites', JSON.stringify(favorites));
        }
        progress[originalSentence].done = [];
        localStorage.setItem('reviewProgress', JSON.stringify(progress));
        alert(`已完成一句的全部复习：${originalSentence}`);
    }
}

function startReviewSession() {
    const selectedIndexes = Array.from(document.querySelectorAll('.review-checkbox:checked')).map(cb => parseInt(cb.dataset.index));
    if (selectedIndexes.length === 0) {
        alert('请至少选择一个句子进行复习！');
        return;
    }
    const allFavorites = JSON.parse(localStorage.getItem('sentenceFavorites')) || [];
    const itemsToReview = selectedIndexes.map(index => allFavorites[index]).filter(Boolean);

    initReviewTargets(itemsToReview);

    document.getElementById('favorites-list-container').classList.add('hidden');
    document.getElementById('review-controls-header').classList.add('hidden');
    document.getElementById('pagination-controls').classList.add('hidden');
    displayReviewItems(itemsToReview);
}

function displayReviewItems(items) {
    const reviewArea = document.getElementById('review-area');
    const createReviewRow = (cnText, enText, type = '', originalSentence) => {
        const safeEnText = enText.replace(/"/g, '&quot;');
        const typeSpan = type ? `<span class="type">${type}:</span>` : '';
        const rowKey = safeEnText;
        return `
            <div class="two-column-grid transformation-item">
                <div class="grid-item cn">
                    ${typeSpan}
                    <span class="cn-text">${cnText}</span>
                </div>
                <div class="grid-item en">
                    <div class="review-interaction-area">
                        <span class="review-mic-icon">🎤</span>
                        <input type="text" class="user-transcription" placeholder="点击麦克风，说出英文翻译...">
                        <button class="check-btn" data-correct="${safeEnText}" data-sent="${originalSentence}" data-rowkey="${rowKey}">检查</button>
                    </div>
                    <div class="diff-result"></div>
                </div>
            </div>
        `;
    };

    const reviewHtml = items.map(data => `
        <div class="card">
            <h2 class="card-title">复习: ${data.patternAnalysis.formula}</h2>
            
            <h3 class="scenario-title">重要词组提取</h3>
            ${data.keyPhrases.map(p => createReviewRow(p.cn, p.en, '', data.original_sentence)).join('')}
            
            <h3 class="scenario-title" style="margin-top: 20px;">不同场景高频表达</h3>
            ${Object.entries(data.scenarioSentences).map(([_, sents]) => sents.map(s => createReviewRow(s.cn, s.en, '', data.original_sentence)).join('')).join('')}

            <h3 class="scenario-title" style="margin-top: 20px;">句型转换</h3>
            ${data.transformations.map(t => createReviewRow(t.cn, t.en, t.type, data.original_sentence)).join('')}
        </div>
    `).join('');

    const controlCard = `
        <div class="card review-result">
            <button onclick="exitReviewMode()">返回收藏列表</button>
        </div>
    `;

    reviewArea.innerHTML = controlCard + reviewHtml;
}

function exitReviewMode() {
    document.getElementById('favorites-list-container').classList.remove('hidden');
    document.getElementById('review-controls-header').classList.remove('hidden');
    document.getElementById('pagination-controls').classList.remove('hidden');
    document.getElementById('review-area').innerHTML = '';
    renderFavoritesList();
}

function getFilteredFavorites() {
    let favorites = JSON.parse(localStorage.getItem('sentenceFavorites')) || [];

    if (currentSearchTerm) {
        const term = currentSearchTerm.toLowerCase();
        favorites = favorites.filter(item => {
            if (item.original_sentence.toLowerCase().includes(term)) return true;
            if (item.patternAnalysis.formula.toLowerCase().includes(term)) return true;
            if (item.keyPhrases.some(p => p.cn.toLowerCase().includes(term) || p.en.toLowerCase().includes(term))) return true;
            if (Object.values(item.scenarioSentences).flat().some(s => s.cn.toLowerCase().includes(term) || s.en.toLowerCase().includes(term))) return true;
            if (item.transformations.some(t => t.cn.toLowerCase().includes(term) || t.en.toLowerCase().includes(term))) return true;
            return false;
        });
    }

    const filterVal = document.getElementById('review-filter').value;
    if (filterVal !== 'all') {
        favorites = favorites.filter(item => {
            const count = (item._meta && item._meta.reviewCount) ? item._meta.reviewCount : 0;
            if (filterVal === '0') return count === 0;
            if (filterVal === '1') return count === 1;
            if (filterVal === '2') return count === 2;
            if (filterVal === '3+') return count >= 3;
            return false;
        });
    }

    favorites.sort((a, b) => {
        const ar = (a._meta && a._meta.reviewCount) ? a._meta.reviewCount : 0;
        const br = (b._meta && b._meta.reviewCount) ? b._meta.reviewCount : 0;
        if (ar !== br) return ar - br;
        const at = (a._meta && a._meta.favoritedAt) ? a._meta.favoritedAt : 0;
        const bt = (b._meta && b._meta.favoritedAt) ? b._meta.favoritedAt : 0;
        return bt - at;
    });

    return favorites;
}