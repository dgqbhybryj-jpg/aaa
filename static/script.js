// --- 全局变量和初始化 ---
const synth = window.speechSynthesis;
let voices = [];
let currentPage = 1;
const itemsPerPage = 5;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
} else {
    console.log("您的浏览器不支持语音识别功能。");
}

function populateVoiceList() {
    voices = synth.getVoices();
}
populateVoiceList();
if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = populateVoiceList;
}

// --- 核心功能 ---
function speak(text) {
    if (synth.speaking) return;
    if (text !== '') {
        const utterThis = new SpeechSynthesisUtterance(text);
        const britishVoice = voices.find(voice => voice.lang === 'en-GB') || voices.find(voice => voice.lang.startsWith('en-'));
        if (britishVoice) utterThis.voice = britishVoice;
        synth.speak(utterThis);
    }
}

function startSpeechRecognition(micIcon, targetInput) {
    if (!recognition) {
        alert("抱歉，您的浏览器不支持语音识别。请尝试使用最新版的Chrome或Edge。");
        return;
    }
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
    };
    recognition.onerror = (event) => {
        console.error("语音识别错误:", event.error);
        targetInput.value = '识别失败，请重试。';
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
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    showAnalyzer();
});

function handleBodyClick(event) {
    const target = event.target;
    if (target.classList.contains('speaker-icon')) {
        speak(target.dataset.text);
    } 
    else if (target.classList.contains('review-mic-icon')) {
        const interactionArea = target.closest('.review-interaction-area');
        const inputField = interactionArea.querySelector('.user-transcription');
        startSpeechRecognition(target, inputField);
    }
    else if (target.classList.contains('check-btn')) {
        const interactionArea = target.closest('.review-interaction-area');
        const inputField = interactionArea.querySelector('.user-transcription');
        const resultDiv = interactionArea.nextElementSibling;
        const correctSentence = target.dataset.correct;
        compareSentences(inputField.value, correctSentence, resultDiv);
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
    
    loadingDiv.classList.remove('hidden');
    resultsContainer.innerHTML = '';
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
        analyzeBtn.textContent = '分析句子';
    }
}

function displayResults(data) {
    const container = document.getElementById('results-container');
    container.innerHTML = '';
    const addSpeaker = (text) => `${text} <span class="speaker-icon" data-text="${text.replace(/"/g, '&quot;')}">🔊</span>`;
    
    container.innerHTML += `<div class="card"><h2 class="card-title">句型与语法分析</h2><div class="pattern-analysis"><p><strong>句型公式:</strong></p><p class="formula">${data.patternAnalysis.formula}</p><p><strong>语法点:</strong></p><p>${data.patternAnalysis.grammarPoint}</p></div></div>`;
    
    let keyPhrasesHtml = data.keyPhrases.map(phrase => `<div class="grid-item cn">${phrase.cn}</div><div class="grid-item en">${addSpeaker(phrase.en)}</div>`).join('');
    container.innerHTML += `<div class="card"><h2 class="card-title">重要词组提取</h2><div class="two-column-grid">${keyPhrasesHtml}</div></div>`;
    
    let scenariosHtml = Object.entries(data.scenarioSentences).map(([title, sentences]) => `<div class="scenario-group"><h3 class="scenario-title">${title}</h3>${sentences.map(s => `<div class="two-column-grid"><div class="grid-item cn">${s.cn}</div><div class="grid-item en">${addSpeaker(s.en)}</div></div>`).join('')}</div>`).join('');
    container.innerHTML += `<div class="card"><h2 class="card-title">不同场景高频表达</h2>${scenariosHtml}</div>`;
    
    let transformationsHtml = data.transformations.map(t => `
        <div class="two-column-grid transformation-item">
            <div class="grid-item cn">
                <span class="type">${t.type}:</span>
                <span class="cn-text">${t.cn}</span>
            </div>
            <div class="grid-item en">${addSpeaker(t.en)}</div>
        </div>
    `).join('');
    container.innerHTML += `<div class="card"><h2 class="card-title">句型转换</h2>${transformationsHtml}</div>`;
    
    const favoritesCard = `<div class="card" style="text-align: center;"><button id="favorites-btn">⭐ 添加到收藏夹</button></div>`;
    container.innerHTML += favoritesCard;
    document.getElementById('favorites-btn').addEventListener('click', () => handleAddToFavorites(data));
}

function handleAddToFavorites(analysisData) {
    try {
        const existingFavorites = JSON.parse(localStorage.getItem('sentenceFavorites')) || [];
        const sentence = analysisData.original_sentence;
        if (existingFavorites.some(item => item.original_sentence === sentence)) {
            alert('这个句子已经收藏过了！');
            const favoritesBtn = document.getElementById('favorites-btn');
            if(favoritesBtn) {
                favoritesBtn.disabled = true;
                favoritesBtn.textContent = '已收藏';
            }
            return;
        }
        existingFavorites.push(analysisData);
        localStorage.setItem('sentenceFavorites', JSON.stringify(existingFavorites));
        alert(`句子 "${sentence}" 已成功添加到收藏夹！`);
        const favoritesBtn = document.getElementById('favorites-btn');
        if (favoritesBtn) {
            favoritesBtn.disabled = true;
            favoritesBtn.textContent = '已收藏';
        }
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
    renderFavoritesList();
}

function renderFavoritesList() {
    const favorites = JSON.parse(localStorage.getItem('sentenceFavorites')) || [];
    const container = document.getElementById('favorites-list-container');
    const controlsHeader = document.getElementById('review-controls-header');
    document.getElementById('review-area').innerHTML = '';

    if (favorites.length === 0) {
        container.innerHTML = '<div class="card"><p>您的收藏夹是空的，快去分析并收藏句子吧！</p></div>';
        controlsHeader.classList.add('hidden');
        document.getElementById('pagination-controls').innerHTML = '';
        return;
    }

    controlsHeader.classList.remove('hidden');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = favorites.slice(startIndex, endIndex);

    container.innerHTML = paginatedItems.map((item, index) => {
        const originalIndex = startIndex + index;
        return `
        <div class="favorite-item card">
            <div style="display: flex; align-items: center;">
                <input type="checkbox" class="review-checkbox" data-index="${originalIndex}">
                <span class="favorite-item-title">${item.patternAnalysis.formula}</span>
            </div>
            <div class="favorite-item-controls">
                <button class="delete-fav-btn" data-index="${originalIndex}">删除</button>
            </div>
        </div>
    `}).join('');
    
    container.querySelectorAll('.delete-fav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteFavorite(parseInt(e.target.dataset.index)));
    });

    document.getElementById('start-review-btn').onclick = startReviewSession;
    renderPaginationControls(favorites.length);
    document.getElementById('select-all-checkbox').checked = false;
}

function renderPaginationControls(totalItems) {
    const paginationContainer = document.getElementById('pagination-controls');
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    paginationContainer.innerHTML = '';

    if (totalPages <= 1) return;

    const prevButton = document.createElement('button');
    prevButton.textContent = '上一页';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => changePage(currentPage - 1));
    
    const pageInfo = document.createElement('span');
    pageInfo.id = 'page-info';
    pageInfo.textContent = `第 ${currentPage} / ${totalPages} 页`;

    const nextButton = document.createElement('button');
    nextButton.textContent = '下一页';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => changePage(currentPage + 1));

    paginationContainer.append(prevButton, pageInfo, nextButton);
}

function changePage(newPage) {
    currentPage = newPage;
    renderFavoritesList();
}

function deleteFavorite(indexToDelete) {
    if (!confirm("确定要删除这个收藏吗？")) return;
    let favorites = JSON.parse(localStorage.getItem('sentenceFavorites')) || [];
    favorites.splice(indexToDelete, 1);
    localStorage.setItem('sentenceFavorites', JSON.stringify(favorites));

    const totalPages = Math.ceil(favorites.length / itemsPerPage);
    if (currentPage > totalPages) {
        currentPage = totalPages > 0 ? totalPages : 1;
    }
    
    renderFavoritesList();
}

function handleSelectAll(event) {
    const isChecked = event.target.checked;
    document.querySelectorAll('#favorites-list-container .review-checkbox').forEach(checkbox => {
        checkbox.checked = isChecked;
    });
}

function compareSentences(userInput, correctSentence, resultContainer) {
    const process = (str) => str.toLowerCase().replace(/[.,?!]/g, '');
    
    const diff = Diff.diffWords(process(correctSentence), process(userInput));
    let html = '';
    
    diff.forEach((part) => {
        const className = part.added ? 'diff-added' :
                        part.removed ? 'diff-removed' : 'diff-correct';
        html += `<span class="${className}">${part.value}</span>`;
    });
    
    resultContainer.innerHTML = `您的回答对比：${html}`;
}

function startReviewSession() {
    const selectedIndexes = Array.from(document.querySelectorAll('.review-checkbox:checked')).map(cb => parseInt(cb.dataset.index));
    if (selectedIndexes.length === 0) {
        alert('请至少选择一个句子进行复习！');
        return;
    }
    const allFavorites = JSON.parse(localStorage.getItem('sentenceFavorites')) || [];
    const itemsToReview = selectedIndexes.map(index => allFavorites[index]);
    document.getElementById('favorites-list-container').classList.add('hidden');
    document.getElementById('review-controls-header').classList.add('hidden');
    document.getElementById('pagination-controls').classList.add('hidden');
    displayReviewItems(itemsToReview);
}

function displayReviewItems(items) {
    const reviewArea = document.getElementById('review-area');
    const createReviewRow = (cnText, enText, type = '') => {
        const safeEnText = enText.replace(/"/g, '&quot;');
        const typeSpan = type ? `<span class="type">${type}:</span>` : '';
        
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
                        <button class="check-btn" data-correct="${safeEnText}">检查</button>
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
            ${data.keyPhrases.map(p => createReviewRow(p.cn, p.en)).join('')}
            
            <h3 class="scenario-title" style="margin-top: 20px;">不同场景高频表达</h3>
            ${Object.entries(data.scenarioSentences).map(([_, sents]) => sents.map(s => createReviewRow(s.cn, s.en)).join('')).join('')}

            <h3 class="scenario-title" style="margin-top: 20px;">句型转换</h3>
            ${data.transformations.map(t => createReviewRow(t.cn, t.en, t.type)).join('')}
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