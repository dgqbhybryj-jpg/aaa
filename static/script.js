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
    document.getElementById('favorites-search').addEventListener('input', handleFavoriteSearch);
    
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
    } else if (event.target.classList.contains('edit-icon')) {
        makeEditable(event.target);
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
    document.getElementById('footer-actions').classList.add('hidden'); // 分析开始时隐藏底部按钮
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
    
    // 分析结束后，显示底部的操作按钮
    const footerActions = document.getElementById('footer-actions');
    footerActions.classList.remove('hidden');

    const favoriteBtn = document.getElementById('footer-favorite-btn');
    const exportBtn = document.getElementById('footer-export-btn');

    const isFavorited = (JSON.parse(localStorage.getItem('sentenceFavorites')) || []).some(item => item.original_sentence === data.original_sentence);

    if (isFavorited) {
        favoriteBtn.disabled = true;
        favoriteBtn.innerHTML = '<i class="fas fa-check"></i> 已收藏';
        favoriteBtn.classList.add('favorited');
    } else {
        favoriteBtn.disabled = false;
        favoriteBtn.innerHTML = '<i class="fas fa-star"></i> 收藏';
        favoriteBtn.classList.remove('favorited');
    }
    
    // 移除旧的监听器并添加新的，以避免重复绑定
    const newFavBtn = favoriteBtn.cloneNode(true);
    favoriteBtn.parentNode.replaceChild(newFavBtn, favoriteBtn);
    newFavBtn.addEventListener('click', () => handleAddToFavorites(data));

    // 为导出按钮绑定事件
    const newExportBtn = exportBtn.cloneNode(true);
    exportBtn.parentNode.replaceChild(newExportBtn, exportBtn);
    newExportBtn.addEventListener('click', () => handleExportToExcel(data));
}

function handleExportToExcel(data) {
    // 1. 创建数据数组
    const exportData = [];
    exportData.push(['项目', '中文', '英文']); // 添加表头

    // 2. 添加基本信息
    exportData.push(['原句', '', data.original_sentence]);
    exportData.push(['句型公式', data.patternAnalysis.formula, '']);
    exportData.push(['语法点', data.patternAnalysis.grammarPoint, '']);

    // 3. 添加重要词组
    exportData.push([]); // 添加一个空行作为分隔
    exportData.push(['重要词组']);
    data.keyPhrases.forEach(phrase => {
        exportData.push(['', phrase.cn, phrase.en]);
    });

    // 4. 添加不同场景高频表达
    exportData.push([]);
    exportData.push(['不同场景高频表达']);
    Object.entries(data.scenarioSentences).forEach(([title, sentences]) => {
        exportData.push(['', title, '']); // 场景标题
        sentences.forEach(s => {
            exportData.push(['', s.cn, s.en]);
        });
    });

    // 5. 添加句型转换
    exportData.push([]);
    exportData.push(['句型转换']);
    data.transformations.forEach(t => {
        exportData.push([t.type, t.cn, t.en]);
    });

    // 6. 使用 SheetJS 生成 Excel
    const worksheet = XLSX.utils.aoa_to_sheet(exportData);
    
    // 设置列宽
    worksheet['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 40 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '句子分析');

    // 7. 下载文件
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
        existingFavorites.unshift(analysisData); // 使用 unshift 将新项目添加到数组开头
        localStorage.setItem('sentenceFavorites', JSON.stringify(existingFavorites));
        alert(`句子 "${sentence}" 已成功添加到收藏夹！`);
        
        // 更新底部收藏按钮的状态
        const favoriteBtn = document.getElementById('footer-favorite-btn');
        favoriteBtn.disabled = true;
        favoriteBtn.innerHTML = '<i class="fas fa-check"></i> 已收藏';
        favoriteBtn.classList.add('favorited');
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
    document.getElementById('favorites-search').value = ''; // 清空搜索框
    renderFavoritesList();
}

function renderFavoritesList(favoritesToShow) {
    const favorites = favoritesToShow || JSON.parse(localStorage.getItem('sentenceFavorites')) || [];
    const container = document.getElementById('favorites-list-container');
    const controlsHeader = document.getElementById('review-controls-header');
    document.getElementById('review-area').innerHTML = '';

    if (favorites.length === 0) {
        const searchTerm = document.getElementById('favorites-search').value;
        if (searchTerm) {
            container.innerHTML = '<div class="card"><p>没有找到匹配的收藏结果。</p></div>';
        } else {
            container.innerHTML = '<div class="card"><p>您的收藏夹是空的，快去分析并收藏句子吧！</p></div>';
        }
        controlsHeader.classList.add('hidden');
        document.getElementById('pagination-controls').innerHTML = '';
        return;
    }

    controlsHeader.classList.remove('hidden');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = favorites.slice(startIndex, endIndex);

    container.innerHTML = paginatedItems.map((item) => {
        // 找到当前项在完整列表中的原始索引
        const originalIndex = allFavorites.findIndex(fav => fav.original_sentence === item.original_sentence);
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
    // 重新执行搜索以渲染正确的页面
    const searchTerm = document.getElementById('favorites-search').value;
    handleFavoriteSearch({ target: { value: searchTerm } });
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
    
    // 删除后重新渲染当前搜索结果
    const searchTerm = document.getElementById('favorites-search').value;
    handleFavoriteSearch({ target: { value: searchTerm } });
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

function handleFavoriteSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const allFavorites = JSON.parse(localStorage.getItem('sentenceFavorites')) || [];
    
    if (!searchTerm) {
        renderFavoritesList(allFavorites);
        return;
    }

    const filteredFavorites = allFavorites.filter(item => {
        // 搜索原始句子
        if (item.original_sentence.toLowerCase().includes(searchTerm)) return true;
        // 搜索句型公式
        if (item.patternAnalysis.formula.toLowerCase().includes(searchTerm)) return true;
        // 搜索重要词组
        if (item.keyPhrases.some(p => p.cn.toLowerCase().includes(searchTerm) || p.en.toLowerCase().includes(searchTerm))) return true;
        // 搜索场景例句
        if (Object.values(item.scenarioSentences).flat().some(s => s.cn.toLowerCase().includes(searchTerm) || s.en.toLowerCase().includes(searchTerm))) return true;
        // 搜索句型转换
        if (item.transformations.some(t => t.cn.toLowerCase().includes(searchTerm) || t.en.toLowerCase().includes(searchTerm))) return true;
        
        return false;
    });

    currentPage = 1;
    renderFavoritesList(filteredFavorites);
}