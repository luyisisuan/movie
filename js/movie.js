// =============================================
//     电影收藏馆 - JavaScript v3.8
// 功能: 顶部固定下拉管理菜单(含导出/删除), 模态框操作, 自动获取详情,
//       按观影日期排序, 编辑时可选评分日期, 全选删除, CSV导入导出, 豆瓣搜索按钮
// 注释: 全部中文
// =============================================

// --- 全局变量与常量 ---
let currentPage = 1; // 当前页码
const moviesPerPage = 6; // 每页显示电影数量
const TMDB_POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500'; // TMDb 海报基础 URL (w500 尺寸)
const TMDB_API_KEY_STORAGE_KEY = 'tmdbApiKey'; // localStorage 中存储 API Key 的键名
const DEFAULT_POSTER_URL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9IiNFNkYyRkYiIHN0cm9rZT0iIzRhNGI2ZSIgc3Ryb2tlLXdpZHRoPSIxIj48cmVjdCB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHg9IjMiIHk9IjMiIHJ4PSIyIiByeT0iMiIgc3Ryb2tlPSIjOWVhNmJjIiBmaWxsPSIjMmEyYjQ1Ii8+PHBhdGggZD0iTTMgMTJsNi02IDYgNi0zIDMiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlPSIjOWVhNmJjIi8+PGNpcmNsZSBjeD0iOSIgY3k9IjkiIHI9IjEiIGZpbGw9IiM5ZWE2YmMiLz48dGV4dCB4PSI1MHUiIHk9IjcwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTZweCIgZmlsbD0iI2U2ZjJmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+'; // 默认海报 SVG

// --- 初始化与基础功能 ---
/**
 * 初始化本地存储，如果 'movies' 键不存在，则创建一个空数组字符串。
 */
function initStorage() {
    if (!localStorage.getItem('movies')) {
        localStorage.setItem('movies', JSON.stringify([]));
    }
}

// --- TMDb API 相关功能 ---
/**
 * 从本地存储获取 TMDb API Key。
 * @returns {string | null} API Key 字符串或 null。
 */
function getTmdbApiKey() {
    return localStorage.getItem(TMDB_API_KEY_STORAGE_KEY);
}

/**
 * 保存用户在设置模态框中输入的 TMDb API Key 到本地存储。
 */
function saveTmdbApiKey() {
    const input = document.getElementById('modalTmdbApiKey'); // 获取模态框内的输入元素
    const key = input.value.trim();
    if (key) {
        if (/^[a-z0-9]{32}$/i.test(key)) { // 简单验证32位字母数字格式
            localStorage.setItem(TMDB_API_KEY_STORAGE_KEY, key);
            alert('API Key 已保存。'); // 中文提示
            input.placeholder = "API Key 已保存 (如需更改请重新输入)"; // 更新占位符提示
        } else {
            alert('API Key 格式错误 (应为32位字母或数字)。'); // 中文提示
        }
    } else {
        localStorage.removeItem(TMDB_API_KEY_STORAGE_KEY); // 清除 Key
        input.placeholder = "粘贴你的 TMDb API Key 并保存"; // 恢复默认占位符
        alert('API Key 已清除。自动获取详情功能将停用。'); // 中文提示
    }
}

/**
 * 使用电影标题从 TMDb 获取电影详情 (海报, 导演, 年份, 国家)。
 * @param {string} title - 要搜索的电影标题。
 * @returns {Promise<{posterUrl: string|null, director: string|null, year: number|null, country: string|null}>} 包含详情的对象，失败则值为 null。
 */
async function fetchMovieDetailsFromTmdb(title) {
    const apiKey = getTmdbApiKey();
    const result = { posterUrl: null, director: null, year: null, country: null };
    if (!apiKey || !title) {
        console.warn('获取 TMDb 详情失败：缺少 API Key 或电影标题。');
        return result;
    }

    // 1. 搜索电影以获取 TMDb ID
    const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(title)}&language=zh-CN&include_adult=false`;
    let movieId = null;
    try {
        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) throw new Error(`TMDb 搜索 API 错误 (${searchRes.status})`);
        const searchData = await searchRes.json();
        if (!searchData.results?.length) {
            console.log(`未能为 "${title}" 找到 TMDb 匹配项。`);
            return result;
        }
        movieId = searchData.results[0].id; // 获取第一个匹配结果的 ID
    } catch (err) {
        console.error(`TMDb 搜索 "${title}" 时出错:`, err);
        return result;
    }

    // 2. 使用 ID 获取电影详情和演职员信息
    if (movieId) {
        const detailsUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${apiKey}&language=zh-CN&append_to_response=credits`; // 同时请求演职员信息
        try {
            const detailsRes = await fetch(detailsUrl);
            if (!detailsRes.ok) throw new Error(`TMDb 详情 API 错误 (${detailsRes.status})`);
            const d = await detailsRes.json(); // 电影详情数据

            if (d.poster_path) result.posterUrl = TMDB_POSTER_BASE_URL + d.poster_path; // 构建海报 URL
            if (d.release_date) result.year = parseInt(d.release_date.substring(0, 4)) || null; // 提取年份
            // 提取国家/地区 (优先中国/美国，否则取第一个)
            if (d.production_countries?.length > 0) {
                const country = d.production_countries.find(c => c.iso_3166_1 === 'CN') || d.production_countries.find(c => c.iso_3166_1 === 'US') || d.production_countries[0];
                result.country = country?.name || null;
            }
            // 提取导演 (从演职员列表筛选)
            if (d.credits?.crew) {
                const directors = d.credits.crew.filter(c => c.job === 'Director');
                if (directors.length > 0) result.director = directors.map(dir => dir.name).join(', '); // 拼接多个导演
            }
        } catch (err) {
            console.error(`获取 TMDb 详情 (ID: ${movieId}) 时出错:`, err);
        }
    }
    console.log(`为 "${title}" 获取到的 TMDb 详情:`, result);
    return result;
}

/**
 * 尝试为收藏中所有缺少详情 (海报/导演/年份/国家) 的电影批量获取信息。
 * 通过设置模态框中的按钮触发。
 */
async function fetchAllMissingDetails() {
    if (!getTmdbApiKey()) { alert('请先在设置中输入并保存 TMDb API Key。'); openModal('settingsModal'); return; } // 提示并打开设置
    let movies = JSON.parse(localStorage.getItem('movies') || '[]');
    const moviesToUpdate = movies.filter(m => (!m.coverUrl || m.coverUrl === DEFAULT_POSTER_URL) || !m.director || !m.year || !m.country); // 筛选需要更新的电影
    if (moviesToUpdate.length === 0) { alert('所有电影详情似乎都完整。'); return; } // 如果没有需要更新的

    // 获取模态框内的按钮并更新状态
    const fetchButton = document.querySelector('#settingsModal button[onclick="fetchAllMissingDetails()"]');
    const originalButtonContent = fetchButton.innerHTML;
    fetchButton.disabled = true;
    const updateProgressText = (processed, total) => `<svg class="spinner" viewBox="0 0 24 24"><path d="M12 6v2a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z"/></svg> 获取中 (${processed}/${total})...`;
    fetchButton.innerHTML = updateProgressText(0, moviesToUpdate.length);

    let counts = { movies: 0, poster: 0, director: 0, year: 0, country: 0 }; // 计数器
    const batchSize = 8, delayBetweenBatches = 1200; // 分批处理参数

    for (let i = 0; i < moviesToUpdate.length; i += batchSize) { // 循环处理每一批
        const batch = moviesToUpdate.slice(i, i + batchSize);
        console.log(`正在处理批次 ${Math.floor(i / batchSize) + 1}...`);
        fetchButton.innerHTML = updateProgressText(i, moviesToUpdate.length); // 更新按钮文本

        // 并发请求当前批次
        const promises = batch.map(async (movie) => {
            let movieUpdated = false;
            try {
                // 仅当确实缺少信息时才发起请求
                if ((!movie.coverUrl || movie.coverUrl === DEFAULT_POSTER_URL) || !movie.director || !movie.year || !movie.country) {
                    const details = await fetchMovieDetailsFromTmdb(movie.title);
                    const movieIndex = movies.findIndex(m => m.id === movie.id); // 在原数组中找到索引
                    if (movieIndex !== -1) {
                        let posterUpd=0, directorUpd=0, yearUpd=0, countryUpd=0;
                        // 仅更新原本为空的字段
                        if (details.posterUrl && (!movies[movieIndex].coverUrl || movies[movieIndex].coverUrl === DEFAULT_POSTER_URL)) { movies[movieIndex].coverUrl = details.posterUrl; posterUpd=1; }
                        if (details.director && !movies[movieIndex].director) { movies[movieIndex].director = details.director; directorUpd=1; }
                        if (details.year && !movies[movieIndex].year) { movies[movieIndex].year = details.year; yearUpd=1; }
                        if (details.country && !movies[movieIndex].country) { movies[movieIndex].country = details.country; countryUpd=1; }
                        // 更新计数
                        if (posterUpd||directorUpd||yearUpd||cUd) movieUpdated = true;
                        if (posterUpd) counts.poster++; if (directorUpd) counts.director++; if (yearUpd) counts.year++; if (countryUpd) counts.country++;
                    }
                }
            } catch (err) { console.error(`获取 "${movie.title}" 详情时出错:`, err); }
            if (movieUpdated) counts.movies++;
        });

        await Promise.allSettled(promises); // 等待批次完成
        if (i + batchSize < moviesToUpdate.length) await new Promise(res => setTimeout(res, delayBetweenBatches)); // 批次间延迟
    }

    localStorage.setItem('movies', JSON.stringify(movies)); // 保存更新后的数组
    renderMovies(); // 重新渲染列表
    fetchButton.disabled = false; fetchButton.innerHTML = originalButtonContent; // 恢复按钮
    alert(`批量获取完成！\n共 ${counts.movies} 部电影信息被更新。\n(海报:${counts.poster}, 导演:${counts.director}, 年份:${counts.year}, 国家:${counts.country})`);
    // 可选：自动关闭设置模态框
    // closeModal('settingsModal');
}


// --- CSV 处理 ---
/**
 * 解析 CSV 文本内容为电影对象数组。
 * @param {string} csvText - CSV 文件内容字符串。
 * @returns {Array<object>} - 解析后的电影对象数组。
 * @throws {Error} - 如果 CSV 格式无效或缺少必需列。
 */
function parseCSV(csvText) {
    const rows = csvText.split('\n').filter(Boolean); // 按行分割并过滤空行
    if (rows.length < 2) throw new Error("CSV 文件内容无效，至少需要表头和一行数据。");

    // 解析表头，移除首尾引号和空格
    const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    console.log("解析到的 CSV 表头:", headers);

    // 检查必需的表头是否存在
    const requiredHeaders = ['电影/电视剧/番组', '观影日期'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
        throw new Error(`CSV 文件缺少必要的列：'${missingHeaders.join("', '")}'`);
    }

    // 创建表头到索引的映射
    const headerIndex = Object.fromEntries(headers.map((h, i) => [h, i]));
    const getColumnValue = (columns, headerName) => { // 安全获取列值的辅助函数
        const index = headerIndex[headerName];
        return index !== undefined && index < columns.length ? columns[index] : '';
    };

    // 解析数据行
    return rows.slice(1).map((row, rowIndex) => {
        // 简单的 CSV 行解析 (可能需要对复杂引号内逗号等情况加强处理)
        const columns = []; let currentVal = ''; let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"' && (i === 0 || row[i - 1] !== '\\')) {
                if (inQuotes && i + 1 < row.length && row[i + 1] === '"') { currentVal += '"'; i++; }
                else { inQuotes = !inQuotes; }
            } else if (char === ',' && !inQuotes) { columns.push(currentVal.trim()); currentVal = ''; }
            else { currentVal += char; }
        }
        columns.push(currentVal.trim());
        const cleanedColumns = columns.map(col => col.replace(/^"(.*)"$/, '$1').trim()); // 移除字段首尾引号

        // 构建电影对象
        const movie = {
            title: getColumnValue(cleanedColumns, '电影/电视剧/番组'),
            ratingDate: getColumnValue(cleanedColumns, '观影日期'),
            rating: parseFloat(getColumnValue(cleanedColumns, '个人评分')) || null,
            review: getColumnValue(cleanedColumns, '我的短评'),
            year: parseInt((getColumnValue(cleanedColumns, '上映年份') || '').match(/^\d{4}/)?.[0]) || null,
            country: getColumnValue(cleanedColumns, '制片国家'),
            link: getColumnValue(cleanedColumns, '条目链接'),
            director: getColumnValue(cleanedColumns, '导演'),
            coverUrl: getColumnValue(cleanedColumns, '海报URL')
        };

        // 行数据校验
        if (!movie.title || !movie.ratingDate || isNaN(new Date(movie.ratingDate).getTime())) {
            console.warn(`跳过 CSV 行 ${rowIndex + 2}: 缺少标题/观影日期或日期格式无效。`);
            return null;
        }
        return { id: Date.now() + Math.random(), ...movie, createdAt: new Date().toISOString() };
    }).filter(Boolean); // 过滤掉校验失败的行
}

/**
 * 处理 CSV 文件导入操作。
 */
async function importCSV() {
    const fileInput = document.getElementById('modalFileInput'); // 获取模态框内的文件输入
    const fileNameSpan = document.getElementById('modalFileName'); // 获取模态框内的文件名显示元素
    if (!fileInput.files.length) { alert('请在弹窗中选择一个 CSV 文件。'); return; }

    // 获取模态框内的导入按钮并设置加载状态
    const importButton = document.querySelector('#importCsvModal button[onclick="importCSV()"]');
    const originalButtonContent = importButton.innerHTML;
    importButton.disabled = true;
    importButton.innerHTML = `<svg class="spinner" viewBox="0 0 24 24"><path d="M12 6v...z"/></svg> 导入中...`;

    const reader = new FileReader();
    reader.onload = async (e) => {
        let newMoviesCount = 0, skippedCount = 0, updatedDetailsCount = 0;
        try {
            const importedMovies = parseCSV(e.target.result); // 解析文件内容
            let existingMovies = JSON.parse(localStorage.getItem('movies') || '[]');
            const moviesToAdd = []; // 存储待添加（去重后）

            // 去重处理
            importedMovies.forEach(newMovie => {
                const isDuplicate = existingMovies.some(existing =>
                    existing.title === newMovie.title &&
                    (existing.year === newMovie.year || (!existing.year && !newMovie.year))
                );
                if (!isDuplicate) moviesToAdd.push(newMovie);
                else skippedCount++;
            });
            newMoviesCount = moviesToAdd.length;

            if (newMoviesCount > 0) {
                const apiKeyExists = !!getTmdbApiKey();
                alert(`找到 ${newMoviesCount} 部新电影${apiKeyExists ? '，将尝试获取缺失详情...' : '。未设置 API Key，不获取详情。'}`);

                // 为新电影获取详情
                const fetchPromises = moviesToAdd.map(async (movie) => {
                    let detailsUpdated = false;
                    if (apiKeyExists && (!movie.coverUrl || !movie.director || !movie.year || !movie.country)) {
                        const details = await fetchMovieDetailsFromTmdb(movie.title);
                        if (!movie.coverUrl && details.posterUrl) { movie.coverUrl = details.posterUrl; detailsUpdated = true; }
                        if (!movie.director && details.director) { movie.director = details.director; detailsUpdated = true; }
                        if (!movie.year && details.year) { movie.year = details.year; detailsUpdated = true; }
                        if (!movie.country && details.country) { movie.country = details.country; detailsUpdated = true; }
                    }
                    if (detailsUpdated) updatedDetailsCount++;
                    return movie;
                });
                const finalMoviesToAdd = await Promise.all(fetchPromises); // 等待所有获取完成

                // 保存到 localStorage
                localStorage.setItem('movies', JSON.stringify([...existingMovies, ...finalMoviesToAdd]));
                currentPage = 1;
                renderMovies(); // 重新渲染
                closeModal('importCsvModal'); // 成功后关闭导入模态框
                alert(`导入完成！\n成功导入 ${newMoviesCount} 部。\n${apiKeyExists ? `其中 ${updatedDetailsCount} 部成功获取/更新了详情。\n` : ''}${skippedCount > 0 ? `跳过 ${skippedCount} 部可能重复的电影。` : ''}`);
            } else {
                alert(`导入完成。未找到新的电影数据可添加。共处理 ${importedMovies.length} 行。`);
                closeModal('importCsvModal'); // 无新电影也关闭模态框
            }
        } catch (err) {
            console.error("导入 CSV 时出错:", err);
            alert('CSV 处理失败：' + err.message); // 显示错误给用户
        } finally {
            // 恢复 UI 状态
            fileInput.value = ''; // 清空文件选择
            fileNameSpan.textContent = '未选择文件';
            importButton.disabled = false;
            importButton.innerHTML = originalButtonContent;
        }
    };
    reader.onerror = (err) => {
        console.error("文件读取错误:", err); alert('读取文件失败，请重试。');
        // 恢复 UI 状态
        importButton.disabled = false; importButton.innerHTML = originalButtonContent;
    };
    reader.readAsText(fileInput.files[0], 'UTF-8'); // 指定 UTF-8 编码读取
}

/**
 * 转义用于 CSV 单元格的字符串值。
 */
function escapeCSVValue(v) {
    if (v == null) return ''; let s = String(v);
    if (/[",\n]/.test(s)) { s = s.replace(/"/g, '""'); s = `"${s}"`; } return s;
}

/**
 * 将所有电影数据导出为 CSV 文件。
 */
function exportCSV() {
    const movies = JSON.parse(localStorage.getItem('movies') || '[]');
    if (movies.length === 0) { alert('没有电影可以导出。'); return; }

    // 按观影日期排序
    movies.sort((a, b) => { const dA=a.ratingDate?new Date(a.ratingDate):0;const dB=b.ratingDate?new Date(b.ratingDate):0;if(isNaN(dA)&&!isNaN(dB))return 1;if(!isNaN(dA)&&isNaN(dB))return-1;if(isNaN(dA)&&isNaN(dB))return 0;return dB-dA; });

    // 定义导出的表头 (使用中文)
    const headers = ['电影/电视剧/番组', '个人评分', '观影日期', '我的短评', '上映年份', '制片国家', '条目链接', '导演', '海报URL', '内部ID', '添加日期', '最后修改日期'];

    // 准备数据行
    const rows = movies.map(m => [
        m.title, m.rating, m.ratingDate, m.review, m.year, m.country, m.link, m.director, m.coverUrl, m.id, m.createdAt, m.updatedAt
    ].map(escapeCSVValue).join(',')); // 转义并用逗号连接

    // 组合 CSV 字符串
    const csvString = [headers.join(','), ...rows].join('\n');
    // 创建 Blob 并下载
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' }); // 加 UTF-8 BOM
    const link = document.createElement('a');
    if (link.download === undefined) { alert('您的浏览器不支持自动下载。'); return; }
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `电影收藏_${timestamp}.csv`);
    link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url); // 释放资源
}


// --- 电影增删改查与渲染 ---
/**
 * 添加新电影（从模态框获取输入）。
 */
async function addMovie(e) {
    e.preventDefault();
    const addButton = document.querySelector('#addMovieBtnInModal'); // 定位模态框内的添加按钮
    const originalButtonContent = addButton.innerHTML;

    // 从模态框内的元素获取值
    const title = document.getElementById('modalTitle').value.trim();
    const rating = parseFloat(document.getElementById('modalRating').value) || null;
    const ratingDate = document.getElementById('modalRatingDate').value;
    const review = document.getElementById('modalReview').value.trim();

    // 校验必需字段
    if (!title) { alert('电影名称不能为空！'); return; }
    if (!ratingDate) { alert('观影日期不能为空！'); return; }
    if (isNaN(new Date(ratingDate).getTime())) { alert('观影日期格式无效！'); return; }

    // 设置按钮加载状态
    addButton.disabled = true;
    addButton.innerHTML = `<svg class="spinner" viewBox="0 0 24 24"><path d="M12 6v2a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z"/></svg> 处理中...`;

    let fetchedDetails = { posterUrl: null, director: null, year: null, country: null };
    try {
        // 尝试获取详情
        if (getTmdbApiKey()) {
            addButton.innerHTML = `<svg class="spinner" viewBox="0 0 24 24"><path d="M12 6v2a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z"/></svg> 获取详情...`;
            fetchedDetails = await fetchMovieDetailsFromTmdb(title);
        }

        // 构建电影对象
        const movie = {
            id: Date.now() + Math.random(), // 加一点随机性避免快速添加时 ID 重复
            title, rating, ratingDate, review,
            director: fetchedDetails.director || '',
            year: fetchedDetails.year || null,
            country: fetchedDetails.country || '',
            coverUrl: fetchedDetails.posterUrl || '',
            link: '', // 链接初始为空
            createdAt: new Date().toISOString()
        };

        // 保存并更新 UI
        const movies = JSON.parse(localStorage.getItem('movies') || '[]');
        movies.push(movie);
        localStorage.setItem('movies', JSON.stringify(movies));
        currentPage = 1; renderMovies(); // 渲染第一页
        document.getElementById('addMovieFormModal').reset(); // 重置模态框表单
        closeModal('addMovieModal'); // 关闭添加模态框
        alert('添加成功！');
    } catch (err) {
         console.error("添加电影时出错:", err);
         alert("添加电影时发生错误。");
    } finally {
        // 恢复按钮状态
        addButton.disabled = false;
        addButton.innerHTML = originalButtonContent;
    }
}

/**
 * 渲染电影列表及分页。
 */
function renderMovies() {
    let movies = JSON.parse(localStorage.getItem('movies') || '[]');
    const container = document.getElementById('movieList'); container.innerHTML = '';
    document.getElementById('movieCount').textContent = movies.length;

    // 1. 排序
    movies.sort((a, b) => { const dA=a.ratingDate?new Date(a.ratingDate):0;const dB=b.ratingDate?new Date(b.ratingDate):0;if(isNaN(dA)&&!isNaN(dB))return 1;if(!isNaN(dA)&&isNaN(dB))return-1;if(isNaN(dA)&&isNaN(dB))return 0;return dB-dA;});

    // 2. 分页逻辑
    const totalMovies = movies.length; const totalPages = Math.ceil(totalMovies / moviesPerPage);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages; else if (currentPage < 1) currentPage = 1;
    document.getElementById('currentPage').textContent = currentPage; document.getElementById('totalPages').textContent = totalPages > 0 ? totalPages : 1;
    document.getElementById('prevPage').disabled = currentPage === 1; document.getElementById('nextPage').disabled = currentPage === totalPages || totalMovies === 0;
    document.getElementById('jumpPage').max = totalPages > 0 ? totalPages : 1;
    document.getElementById('pagination').style.display = totalMovies > 0 ? 'flex' : 'none';

    // 3. 空列表处理
    if (totalMovies === 0) { container.innerHTML = '<p class="empty-message">这里空空如也，快添加你的第一部电影吧！</p>'; document.getElementById('selectAll').checked=false; checkSelectedMovies(); return; }

    // 4. 渲染卡片
    const startIndex = (currentPage - 1) * moviesPerPage; const endIndex = Math.min(startIndex + moviesPerPage, totalMovies);
    const currentPageMovies = movies.slice(startIndex, endIndex);
    currentPageMovies.forEach((m, index) => {
        const el = document.createElement('div'); el.className = 'movie-item'; el.style.animationDelay = `${0.05 + index * 0.03}s`;
        const rating = typeof m.rating === 'number' ? m.rating.toFixed(1) : null;
        const added = m.createdAt ? new Date(m.createdAt).toLocaleDateString('zh-CN',{year:'2-digit',month:'2-digit',day:'2-digit'}) : '?';
        const cover = m.coverUrl || DEFAULT_POSTER_URL;
        const createMetaItem = (iconPath, title, value) => value ? `<div class="meta-item" title="${title}: ${value}"><svg viewBox="0 0 24 24"><path d="${iconPath}"/></svg><span>${value}</span></div>` : '';
        const metaHTML = `${rating ? `<div class="movie-rating-display" title="个人评分 ${rating}"><svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg><span>${rating}</span></div>` : '<div class="movie-rating-display placeholder">未评分</div>'} ${createMetaItem("M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z", "上映年份", m.year)} ${createMetaItem("M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z", "导演", m.director)} ${createMetaItem("M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z", "国家/地区", m.country)} ${createMetaItem("M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z", "观影日期", m.ratingDate)}`;
        const linkBtn = m.link ? `<a href="${m.link}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-small" title="查看链接"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg> 链接</a>` : '';
        const editBtn = `<button class="btn btn-outline btn-small" onclick="editMovie('${m.id}')" title="编辑"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg> 编辑</button>`;
        const deleteBtn = `<button class="btn btn-outline btn-small" onclick="deleteMovie('${m.id}')" title="删除"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg> 删除</button>`;
        el.innerHTML = `<div class="checkbox-container"><input type="checkbox" class="movie-checkbox" data-id="${m.id}" title="选择"></div><div class="movie-item-poster"><img src="${cover}" alt="${m.title} 海报" loading="lazy" onerror="this.onerror=null; this.src='${DEFAULT_POSTER_URL}';"></div><div class="movie-item-content"><h3 class="movie-title" title="${m.title}">${m.title}</h3><div class="movie-details-grid">${metaHTML}</div>${m.review ? `<p class="movie-review" title="短评">${m.review}</p>` : ''}<div class="movie-actions"><small class="movie-date" title="添加日期">添加:${added}</small><div class="action-buttons"> ${linkBtn} ${editBtn} ${deleteBtn} </div></div></div>`;
        container.appendChild(el);
    });
    checkSelectedMovies(); // 更新全选和删除菜单项状态
}

/**
 * 删除指定 ID 的电影。
 */
function deleteMovie(id) {
    if (!confirm('确定要删除这部电影吗？')) return;
    let movies = JSON.parse(localStorage.getItem('movies') || '[]');
    const len = movies.length; movies = movies.filter(m => String(m.id) !== String(id));
    if (movies.length < len) {
        localStorage.setItem('movies', JSON.stringify(movies));
        const pages = Math.ceil(movies.length / moviesPerPage); if (currentPage > pages) currentPage = pages > 0 ? pages : 1;
        renderMovies(); alert('已删除。');
    } else { alert('未找到要删除的电影。'); }
}

/**
 * 删除所有选中的电影（或全部电影，如果“全选”被勾选）。
 */
function deleteSelectedMovies() {
    const allChecked = document.getElementById('selectAll').checked;
    const selectedBoxes = document.querySelectorAll('.movie-checkbox:checked');
    let movies = JSON.parse(localStorage.getItem('movies') || '[]');
    const totalCount = movies.length;

    if (allChecked && totalCount > 0) {
        if (!confirm(`确定要删除全部 ${totalCount} 部电影吗？此操作不可撤销！`)) return;
        localStorage.setItem('movies', '[]'); currentPage = 1; alert(`已删除全部 ${totalCount} 部电影。`);
    } else if (selectedBoxes.length > 0) {
        const idsToDelete = Array.from(selectedBoxes).map(cb => String(cb.dataset.id));
        const countToDelete = idsToDelete.length;
        if (!confirm(`确定要删除选中的 ${countToDelete} 部电影吗？`)) return;
        movies = movies.filter(m => !idsToDelete.includes(String(m.id)));
        localStorage.setItem('movies', JSON.stringify(movies));
        const pages = Math.ceil(movies.length / moviesPerPage); if (currentPage > pages) currentPage = pages > 0 ? pages : 1;
        alert(`已删除 ${countToDelete} 部电影。`);
    } else {
        alert('请先选择要删除的电影，或勾选“全选”。'); return;
    }
    document.getElementById('selectAll').checked = false; renderMovies();
}

/**
 * 打开编辑模态框并填充数据。
 */
function editMovie(id) {
    const movies = JSON.parse(localStorage.getItem('movies'));
    const movie = movies.find(m => String(m.id) === String(id));
    if (!movie) { alert('未找到电影信息。'); return; }
    document.getElementById('editMovieId').value = movie.id;
    document.getElementById('editTitle').value = movie.title || '';
    document.getElementById('editDirector').value = movie.director || '';
    document.getElementById('editYear').value = movie.year || '';
    document.getElementById('editRating').value = movie.rating || '';
    document.getElementById('editRatingDate').value = movie.ratingDate || '';
    document.getElementById('editCountry').value = movie.country || '';
    document.getElementById('editLink').value = movie.link || '';
    document.getElementById('editCoverUrl').value = movie.coverUrl || '';
    document.getElementById('editReview').value = movie.review || '';
    openModal('editMovieModal'); // 使用通用函数打开模态框
}

/**
 * 关闭编辑模态框。
 */
function closeEditModal() {
    closeModal('editMovieModal'); // 使用通用函数关闭
}

/**
 * 保存编辑模态框中的修改。
 */
function saveMovieEdit() {
    const movieId = document.getElementById('editMovieId').value;
    if (!movieId) return;
    const movies = JSON.parse(localStorage.getItem('movies'));
    const movieIndex = movies.findIndex(m => String(m.id) === String(movieId));
    if (movieIndex === -1) { alert('更新失败，未找到电影。'); closeModal('editMovieModal'); return; }

    const updatedTitle = document.getElementById('editTitle').value.trim();
    const newRatingDateInput = document.getElementById('editRatingDate').value;
    let ratingDateToSave = movies[movieIndex].ratingDate; // 默认保留原日期

    if (!updatedTitle) { alert('电影名称不能为空！'); return; }
    if (newRatingDateInput) { // 如果用户输入了日期
        if (isNaN(new Date(newRatingDateInput).getTime())) { // 校验格式
            alert('输入的观影日期格式无效！请使用 YYYY-MM-DD 格式，或留空以保留原日期。'); return;
        }
        ratingDateToSave = newRatingDateInput; // 格式有效，使用新日期
    } // 如果输入为空，则 ratingDateToSave 保持原值

    // 更新电影对象
    movies[movieIndex] = { ...movies[movieIndex],
        title: updatedTitle, director:document.getElementById('editDirector').value.trim(),
        year:parseInt(document.getElementById('editYear').value)||null, rating:parseFloat(document.getElementById('editRating').value)||null,
        ratingDate: ratingDateToSave, // 保存最终决定的日期
        country:document.getElementById('editCountry').value.trim(), link:document.getElementById('editLink').value.trim(),
        coverUrl:document.getElementById('editCoverUrl').value.trim(), review:document.getElementById('editReview').value.trim(),
        updatedAt:new Date().toISOString() };
    localStorage.setItem('movies',JSON.stringify(movies));
    closeModal('editMovieModal'); renderMovies(); alert('更新成功！');
}


// --- 模态框与下拉菜单控制 ---
/**
 * 打开指定 ID 的模态框。
 * @param {string} modalId - 模态框元素的 ID。
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active'); // 添加 active 类以显示
        document.body.style.overflow = 'hidden'; // 禁止背景滚动
    } else { console.error(`未找到 ID 为 "${modalId}" 的模态框。`); }
}
/**
 * 关闭指定 ID 的模态框。
 * @param {string} modalId - 模态框元素的 ID。
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active'); // 移除 active 类以隐藏
        // 检查是否还有其他模态框处于活动状态，如果没有，则恢复背景滚动
        if (!document.querySelector('.modal-overlay.active')) {
            document.body.style.overflow = '';
        }
    }
}

let isDropdownOpen = false; // 标记下拉菜单是否打开
const manageMenuBtn = document.getElementById('manageMenuBtn');       // 管理按钮
const manageMenuDropdown = document.getElementById('manageMenuDropdown'); // 下拉菜单

/**
 * 切换管理下拉菜单的显示/隐藏状态。
 */
function toggleDropdown() {
    isDropdownOpen = !isDropdownOpen;
    manageMenuDropdown.classList.toggle('active'); // 切换 active 类
    manageMenuBtn.setAttribute('aria-expanded', isDropdownOpen); // 更新 ARIA 属性
}
/**
 * 关闭管理下拉菜单。
 */
function closeDropdown() {
    if (isDropdownOpen) { // 仅在菜单打开时执行
        isDropdownOpen = false;
        manageMenuDropdown.classList.remove('active');
        manageMenuBtn.setAttribute('aria-expanded', isDropdownOpen);
    }
}

// --- UI & 分页 ---
/**
 * 应用电影卡片入场动画。
 */
function animateCards() { const cards=document.querySelectorAll('.movie-item'); cards.forEach((c,i)=>{c.style.opacity='0';c.style.transform='translateY(10px)';requestAnimationFrame(()=>{c.style.transition=`all 0.3s ease-out ${i*0.03}s`;c.style.opacity='1';c.style.transform='translateY(0)';});}); }
/**
 * 跳转到下一页。
 */
function goToNextPage() { const pages=Math.ceil(JSON.parse(localStorage.getItem('movies')||'[]').length/moviesPerPage); if(currentPage<pages){currentPage++;renderMovies();window.scrollTo({top:document.querySelector('#my-collection-section')?.offsetTop-20||0,behavior:'smooth'});} }
/**
 * 跳转到上一页。
 */
function goToPrevPage() { if(currentPage>1){currentPage--;renderMovies();window.scrollTo({top:document.querySelector('#my-collection-section')?.offsetTop-20||0,behavior:'smooth'});} }
/**
 * 跳转到指定页码。
 */
function jumpToPage() { const input=document.getElementById('jumpPage');const num=parseInt(input.value);const pages=Math.ceil(JSON.parse(localStorage.getItem('movies')||'[]').length/moviesPerPage); if(!isNaN(num)&&num>=1&&num<=pages){currentPage=num;renderMovies();input.value='';window.scrollTo({top:document.querySelector('#my-collection-section')?.offsetTop-20||0,behavior:'smooth'});}else{alert(`请输入 1 到 ${pages} 之间的页码！`);input.value='';}}
/**
 * 处理“全选”复选框的变化。
 */
function handleSelectAll() { const chk=document.getElementById('selectAll').checked; document.querySelectorAll('.movie-checkbox').forEach(c=>c.checked=chk); checkSelectedMovies(); }
/**
 * 检查选中状态，更新“全选”和“删除选中”菜单项。
 */
function checkSelectedMovies() {
    const selectedCheckboxes = document.querySelectorAll('.movie-checkbox:checked');
    const totalCheckboxes = document.querySelectorAll('.movie-checkbox');
    const deleteMenuItem = document.getElementById('deleteSelectedMenuItem'); // 获取菜单项
    const selectedCount = selectedCheckboxes.length;
    const totalCount = totalCheckboxes.length;

    // 更新“删除选中”菜单项的禁用状态
    if (deleteMenuItem) {
        if (selectedCount > 0) {
            deleteMenuItem.classList.remove('dropdown-item-disabled'); // 启用
        } else {
            deleteMenuItem.classList.add('dropdown-item-disabled'); // 禁用
        }
    }
    // 更新“全选”复选框的状态
    document.getElementById('selectAll').checked = totalCount > 0 && selectedCount === totalCount;
}
/**
 * 从添加电影模态框打开豆瓣搜索。
 */
function searchDoubanFromModal() {
    const titleInput = document.getElementById('modalTitle'); // 获取模态框内的标题输入
    const title = titleInput.value.trim();
    if (!title) { alert('请先在模态框中输入电影名称。'); return; }
    window.open(`https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(title)}`, '_blank');
}

// --- 初始化 ---
/**
 * 页面加载完成后执行的初始化函数。
 */
function init() {
    initStorage(); // 初始化存储
    renderMovies(); // 渲染初始列表
    animateCards(); // 应用初始动画

    // --- 绑定事件监听器 ---
    document.getElementById('nextPage')?.addEventListener('click', goToNextPage);
    document.getElementById('prevPage')?.addEventListener('click', goToPrevPage);
    document.getElementById('selectAll')?.addEventListener('change', handleSelectAll);
    // 删除选中按钮现在是菜单项，点击事件在 HTML 的 onclick 中处理

    // 监听电影列表区域的 change 事件（用于复选框）
    document.getElementById('movieList')?.addEventListener('change', (e) => {
        if (e.target.matches('.movie-checkbox')) {
            checkSelectedMovies(); // 更新选中状态
        }
    });
    // 监听键盘事件 (ESC 关闭模态框或下拉菜单)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal-overlay.active');
            if (activeModal) {
                closeModal(activeModal.id); // 如果有活动的模态框，关闭它
            } else {
                closeDropdown(); // 否则关闭下拉菜单
            }
        }
    });
    // 监听 body 点击事件（关闭模态框背景、关闭下拉菜单）
    document.body.addEventListener('click', (e) => {
        // 点击模态框背景关闭
        if (e.target.classList.contains('modal-overlay')) {
            closeModal(e.target.id);
        }
        // 点击下拉菜单外部区域关闭菜单
        if (manageMenuBtn && manageMenuDropdown && !manageMenuBtn.contains(e.target) && !manageMenuDropdown.contains(e.target)) {
            closeDropdown();
        }
    });
    // 监听导入模态框中的文件选择
    document.getElementById('modalFileInput')?.addEventListener('change', (e) => {
        document.getElementById('modalFileName').textContent = e.target.files[0]?.name || '未选择文件';
    });
    // 监听管理菜单按钮点击
    manageMenuBtn?.addEventListener('click', toggleDropdown);

    // --- 初始化 UI 状态 ---
    // 设置页脚日期
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    // 检查并更新设置模态框中 API Key 输入框的占位符
    if (getTmdbApiKey()) {
        document.getElementById('modalTmdbApiKey').placeholder = "API Key 已保存";
    }
    // 初始检查选中状态（特别是删除菜单项的禁用状态）
    checkSelectedMovies();
}

// 页面加载完成后执行初始化
document。addEventListener('DOMContentLoaded', init);
