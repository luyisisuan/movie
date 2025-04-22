// =============================================
//     电影收藏馆 - JavaScript v3.12 (性能优化 v1)
// 功能: 详情弹窗, 简化卡片, 类型筛选, 搜索, 排序, TMDb 获取, CSV, 中文界面
// 优化: 减少 localStorage 解析, 使用 DocumentFragment 优化渲染
// =============================================

// --- 全局变量与常量 ---
let currentPage = 1; // 当前页码
const moviesPerPage = 6; // 每页显示电影数量
const TMDB_POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500'; // TMDb 海报基础 URL
const TMDB_API_KEY_STORAGE_KEY = 'tmdbApiKey'; // localStorage 存储键名
const DEFAULT_POSTER_URL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9IiNFNkYyRkYiIHN0cm9rZT0iIzRhNGI2ZSIgc3Ryb2tlLXdpZHRoPSIxIj48cmVjdCB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHg9IjMiIHk9IjMiIHJ4PSIyIiByeT0iMiIgc3Ryb2tlPSIjOWVhNmJjIiBmaWxsPSIjMmEyYjQ1Ii8+PHBhdGggZD0iTTMgMTJsNi02IDYgNi0zIDMiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlPSIjOWVhNmJjIi8+PGNpcmNsZSBjeD0iOSIgY3k9IjkiIHI9IjEiIGZpbGw9IiM5ZWE2YmMiLz48dGV4dCB4PSI1MHUiIHk9IjcwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTZweCIgZmlsbD0iI2U2ZjJmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+'; // 默认海报

// 筛选与排序状态
let currentSearchTerm = ''; // 当前搜索词
let currentSortOrder = 'ratingDate_desc'; // 当前排序方式
let currentGenreFilter = ''; // 当前类型筛选

// --- 初始化与基础功能 ---
function initStorage() {
    if (!localStorage.getItem('movies')) {
        localStorage.setItem('movies', JSON.stringify([]));
    }
}

// --- TMDb API 相关功能 ---
function getTmdbApiKey() {
    return localStorage.getItem(TMDB_API_KEY_STORAGE_KEY);
}

function saveTmdbApiKey() {
    const input = document.getElementById('modalTmdbApiKey');
    const key = input.value.trim();
    if (key) {
        // Relaxed validation: allow any non-empty key, TMDb API will validate it
        // if (/^[a-z0-9]{32}$/i.test(key)) { // Original stricter validation
        localStorage.setItem(TMDB_API_KEY_STORAGE_KEY, key);
        alert('API 密钥已保存。');
        input.placeholder = "密钥已保存 (输入新密钥覆盖)";
        // } else {
        //     alert('密钥格式错误 (应为32位字母或数字)。');
        // }
    } else {
        localStorage.removeItem(TMDB_API_KEY_STORAGE_KEY);
        input.placeholder = "在此处粘贴密钥并保存";
        alert('API 密钥已清除。获取详情功能将停用。');
    }
}

async function fetchMovieDetailsFromTmdb(title) {
    const apiKey = getTmdbApiKey();
    const result = { posterUrl: null, director: null, year: null, country: null, genres: [], overview: null };
    if (!apiKey || !title) {
        console.warn('获取 TMDb 详情失败：缺少 API 密钥或标题。');
        return result;
    }
    // Prioritize Chinese results, but allow fallback if title is specific enough
    const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(title)}&language=zh-CN,en-US&include_adult=false`;
    let movieId = null;

    try {
        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) throw new Error(`TMDb 搜索 API 错误 (${searchRes.status})`);
        const searchData = await searchRes.json();

        if (!searchData.results?.length) {
            console.log(`未能为 "${title}" 找到 TMDb 匹配项。`);
            return result;
        }
        // Basic matching logic (first result) - could be improved with year matching etc. if needed
        movieId = searchData.results[0].id;

    } catch (err) {
        console.error(`TMDb 搜索 "${title}" 时出错:`, err);
        return result;
    }

    if (movieId) {
        const detailsUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${apiKey}&language=zh-CN,en-US&append_to_response=credits,release_dates`;
        try {
            const detailsRes = await fetch(detailsUrl);
            if (!detailsRes.ok) throw new Error(`TMDb 详情 API 错误 (${detailsRes.status})`);
            const d = await detailsRes.json();

            if (d.poster_path) result.posterUrl = TMDB_POSTER_BASE_URL + d.poster_path;

            // Year: Prioritize official release date in primary regions if available
            let releaseYear = null;
            if (d.release_dates?.results) {
                 const usRelease = d.release_dates.results.find(r => r.iso_3166_1 === 'US');
                 const cnRelease = d.release_dates.results.find(r => r.iso_3166_1 === 'CN');
                 const releaseInfo = usRelease || cnRelease || d.release_dates.results[0];
                 if(releaseInfo?.release_dates?.length > 0) {
                     const officialRelease = releaseInfo.release_dates.find(rd => rd.type === 3); // Type 3 is often theatrical
                     if (officialRelease?.release_date) {
                         releaseYear = parseInt(officialRelease.release_date.substring(0, 4));
                     } else if (releaseInfo.release_dates[0]?.release_date) {
                          releaseYear = parseInt(releaseInfo.release_dates[0].release_date.substring(0, 4));
                     }
                 }
            }
            // Fallback to general release_date if specific region data unavailable or empty
             if (!releaseYear && d.release_date) {
                 releaseYear = parseInt(d.release_date.substring(0, 4));
             }
             result.year = releaseYear || null;


            if (d.production_countries?.length > 0) {
                // Prefer specific common countries, then first listed
                const country = d.production_countries.find(c => c.iso_3166_1 === 'CN') ||
                                d.production_countries.find(c => c.iso_3166_1 === 'US') ||
                                d.production_countries.find(c => c.iso_3166_1 === 'JP') ||
                                d.production_countries.find(c => c.iso_3166_1 === 'KR') ||
                                d.production_countries.find(c => c.iso_3166_1 === 'GB') ||
                                d.production_countries[0];
                result.country = country?.name || null;
            }

            if (d.credits?.crew) {
                const directors = d.credits.crew.filter(c => c.job === 'Director');
                if (directors.length > 0) result.director = directors.map(dir => dir.name).join(', ');
            }
            if (d.genres?.length > 0) result.genres = d.genres.map(g => g.name);
            if (d.overview) result.overview = d.overview;

        } catch (err) {
            console.error(`获取 TMDb 详情 (ID: ${movieId}) 时出错:`, err);
        }
    }
    // console.log(`为 "${title}" 获取到的 TMDb 详情:`, result); // Reduced logging noise
    return result;
}

async function fetchAllMissingDetails() {
    if (!getTmdbApiKey()) { alert('请先在设置中输入并保存 TMDb API 密钥。'); openModal('settingsModal'); return; }
    let movies = JSON.parse(localStorage.getItem('movies') || '[]');
    const moviesToUpdate = movies.filter(m =>
        (!m.coverUrl || m.coverUrl === DEFAULT_POSTER_URL) || !m.director || !m.year || !m.country ||
        !m.genres || m.genres.length === 0 || !m.overview
    );
    if (moviesToUpdate.length === 0) { alert('所有片段数据似乎已完整。'); return; }

    const fetchButton = document.querySelector('#settingsModal button[onclick="fetchAllMissingDetails()"]');
    const originalButtonContent = fetchButton.innerHTML;
    fetchButton.disabled = true;
    const updateProgressText = (processed, total) => `<svg class="spinner" viewBox="0 0 24 24"><path d="M12 6v2a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z"/></svg> 获取中 (${processed}/${total})...`;
    fetchButton.innerHTML = updateProgressText(0, moviesToUpdate.length);

    let counts = { movies: 0, poster: 0, director: 0, year: 0, country: 0, genres: 0, overview: 0 };
    const batchSize = 5; // Reduced batch size for potentially better rate limit handling
    const delayBetweenBatches = 1500; // Increased delay

    let processedCount = 0;

    for (let i = 0; i < moviesToUpdate.length; i += batchSize) {
        const batch = moviesToUpdate.slice(i, i + batchSize);
        console.log(`正在处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(moviesToUpdate.length/batchSize)}...`);

        const promises = batch.map(async (movie) => {
            let movieUpdated = false;
            try {
                // Check again inside map in case data arrived between filter and fetch start
                const needsUpdate = (!movie.coverUrl || movie.coverUrl === DEFAULT_POSTER_URL) || !movie.director || !movie.year || !movie.country || !movie.genres || movie.genres.length === 0 || !movie.overview;
                if (needsUpdate) {
                    const details = await fetchMovieDetailsFromTmdb(movie.title);
                    // Find index *after* potentially fetching, as `movies` array is shared reference
                    const movieIndex = movies.findIndex(m => m.id === movie.id);
                    if (movieIndex !== -1) {
                        let pU=0, dU=0, yU=0, cU=0, gU=0, oU=0; // Update flags
                        if (details.posterUrl && (!movies[movieIndex].coverUrl || movies[movieIndex].coverUrl === DEFAULT_POSTER_URL)) { movies[movieIndex].coverUrl = details.posterUrl; pU=1; }
                        if (details.director && !movies[movieIndex].director) { movies[movieIndex].director = details.director; dU=1; }
                        if (details.year !== null && movies[movieIndex].year === null) { movies[movieIndex].year = details.year; yU=1; } // Allow updating null year
                        if (details.country && !movies[movieIndex].country) { movies[movieIndex].country = details.country; cU=1; }
                        if (details.genres && details.genres.length > 0 && (!movies[movieIndex].genres || movies[movieIndex].genres.length === 0)) { movies[movieIndex].genres = details.genres; gU=1; }
                        if (details.overview && !movies[movieIndex].overview) { movies[movieIndex].overview = details.overview; oU=1; }

                        if (pU||dU||yU||cU||gU||oU) {
                            movieUpdated = true;
                            movies[movieIndex].updatedAt = new Date().toISOString(); // Mark as updated
                        }
                        // Increment counts based on flags
                        if (pU) counts.poster++; if (dU) counts.director++; if (yU) counts.year++; if (cU) counts.country++; if (gU) counts.genres++; if (oU) counts.overview++;
                    }
                }
            } catch (err) { console.error(`处理 "${movie.title}" 详情时出错:`, err); }
            if (movieUpdated) counts.movies++;
            processedCount++; // Increment processed count regardless of update status
        });

        await Promise.allSettled(promises); // Wait for batch to complete (or fail)
        fetchButton.innerHTML = updateProgressText(processedCount, moviesToUpdate.length); // Update progress after each batch

        // Delay before next batch, unless it's the last one
        if (i + batchSize < moviesToUpdate.length) {
            await new Promise(res => setTimeout(res, delayBetweenBatches));
        }
    }

    localStorage.setItem('movies', JSON.stringify(movies));
    renderMovies(); // Re-render with updated data
    fetchButton.disabled = false; fetchButton.innerHTML = originalButtonContent;
    alert(`批量获取完成！\n处理了 ${moviesToUpdate.length} 条可能需要更新的片段。\n共 ${counts.movies} 条片段信息被更新或补充。\n(视觉快照:${counts.poster}, 信息源:${counts.director}, 纪年:${counts.year}, 地区:${counts.country}, 类型:${counts.genres}, 摘要:${counts.overview})`);
}


// --- CSV 处理 ---
function parseCSV(csvText) {
    const rows = csvText.trim().split('\n'); // Trim trailing newline
    if (rows.length < 2) throw new Error("无效CSV文件：至少需要表头和一行数据。");

    // More robust header parsing (handle quotes)
    const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').trim());
    console.log("解析到的 CSV 表头:", headers);
    const headerIndex = Object.fromEntries(headers.map((h, i) => [h.toLowerCase(), i])); // Use lowercase keys for matching

    const getColumnValue = (columns, possibleHeaders) => {
        for (const header of possibleHeaders) {
            const index = headerIndex[header.toLowerCase()];
            if (index !== undefined && index < columns.length && columns[index]) {
                return columns[index];
            }
        }
        return '';
    };

    return rows.slice(1).map((row, rowIndex) => {
        // Improved CSV row parsing to handle quoted fields with commas
        const columns = [];
        let currentVal = '';
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"') {
                 // Handle escaped quotes ("") inside quoted field
                 if (inQuotes && i + 1 < row.length && row[i + 1] === '"') {
                     currentVal += '"';
                     i++; // Skip the second quote
                 } else {
                     inQuotes = !inQuotes;
                 }
            } else if (char === ',' && !inQuotes) {
                columns.push(currentVal.trim());
                currentVal = '';
            } else {
                currentVal += char;
            }
        }
        columns.push(currentVal.trim()); // Add the last value

        // Clean values (remove surrounding quotes only if they exist)
        const cleanedColumns = columns.map(col => {
             if (col.startsWith('"') && col.endsWith('"')) {
                 return col.slice(1, -1).replace(/""/g, '"').trim();
             }
             return col.trim();
         });

        const movie = {
            id: Date.now() + Math.random(), // Generate ID immediately
            title: getColumnValue(cleanedColumns, ['片段标识符', '电影/电视剧/番组', 'title', 'name']),
            ratingDate: getColumnValue(cleanedColumns, ['访问日期', '观影日期', '打分日期', 'date', 'rated_date']),
            rating: parseFloat(getColumnValue(cleanedColumns, ['神经评分', '个人评分', 'rating', 'score'])) || null,
            review: getColumnValue(cleanedColumns, ['个人日志', '我的短评', 'review', 'comment']),
            year: parseInt((getColumnValue(cleanedColumns, ['发行纪年', '上映日期', 'year', 'release_date']) || '').match(/^\d{4}/)?.[0]) || null,
            country: getColumnValue(cleanedColumns, ['来源地区', '制片国家', 'country', 'region']),
            link: getColumnValue(cleanedColumns, ['数据接口', '条目链接', 'url', 'link']),
            director: getColumnValue(cleanedColumns, ['信息源', '导演', 'director']),
            coverUrl: getColumnValue(cleanedColumns, ['视觉快照URL', '海报URL', 'poster', 'cover_url']),
            genres: [], // Genres will be fetched, not imported from CSV
            overview: '', // Overview will be fetched
            createdAt: new Date().toISOString()
        };

        // Validate date (if provided)
        if (movie.ratingDate && isNaN(new Date(movie.ratingDate).getTime())) {
            console.warn(`跳过 CSV 行 ${rowIndex + 2}: 无效日期格式 (${movie.ratingDate})。请使用 YYYY-MM-DD。`);
            return null;
        }
        // Ensure title exists
        if (!movie.title) {
            console.warn(`跳过 CSV 行 ${rowIndex + 2}: 缺少有效的片段标识符 (标题)。`);
            return null;
        }

        // Convert empty string date to null
        if (movie.ratingDate === '') movie.ratingDate = null;

        return movie;
    }).filter(Boolean); // Filter out null entries from skipped rows
}

async function importCSV() {
    const fileInput = document.getElementById('modalFileInput');
    const fileNameSpan = document.getElementById('modalFileName');
    if (!fileInput.files.length) { alert('请选择一个 CSV 文件。'); return; }
    const importButton = document.querySelector('#importCsvModal button[onclick="importCSV()"]');
    const originalButtonContent = importButton.innerHTML;
    importButton.disabled = true; importButton.innerHTML = `<svg class="spinner" viewBox="0 0 24 24"><path d="M12 6v...z"/></svg> 注入中...`; // Ensure spinner SVG is complete or remove

    const reader = new FileReader();
    reader.onload = async (e) => {
        let newCount = 0, skipped = 0, updated = 0;
        try {
            const importedMovies = parseCSV(e.target.result);
            let existingMovies = JSON.parse(localStorage.getItem('movies') || '[]');
            const existingTitlesAndYears = new Set(existingMovies.map(ex => `${ex.title.toLowerCase()}::${ex.year || 'null'}`)); // Optimize duplicate check

            const toAdd = [];
            importedMovies.forEach(imp => {
                const uniqueKey = `${imp.title.toLowerCase()}::${imp.year || 'null'}`;
                // Check for duplicates based on title AND year (if year exists)
                const isDup = existingTitlesAndYears.has(uniqueKey);
                if (!isDup) {
                    toAdd.push(imp);
                    existingTitlesAndYears.add(uniqueKey); // Add to set to prevent importing duplicates from the same file
                } else {
                    skipped++;
                }
            });

            newCount = toAdd.length;
            if (newCount > 0) {
                const apiKey = getTmdbApiKey();
                console.log(`发现 ${newCount} 条新片段。${apiKey ? '尝试补全数据...' : '未配置密钥，跳过补全。'}`);
                // Process additions without blocking UI for too long if fetching details
                 if (apiKey) {
                     importButton.innerHTML = `<svg class="spinner" viewBox="0 0 24 24"><path d="M12 6v...z"/></svg> 补全数据(${updated}/${newCount})...`;
                     const batchSize = 5;
                     const delayBetweenBatches = 1500;
                     for (let i = 0; i < toAdd.length; i += batchSize) {
                         const batch = toAdd.slice(i, i + batchSize);
                         const promises = batch.map(async m => {
                            let upd = false;
                            // Only fetch if core details are missing
                            if (!m.coverUrl || !m.director || !m.year || !m.country || !m.genres.length || !m.overview) {
                                const d = await fetchMovieDetailsFromTmdb(m.title);
                                if (!m.coverUrl && d.posterUrl) { m.coverUrl = d.posterUrl; upd = true; }
                                if (!m.director && d.director) { m.director = d.director; upd = true; }
                                if (m.year === null && d.year !== null) { m.year = d.year; upd = true; } // Update null year
                                if (!m.country && d.country) { m.country = d.country; upd = true; }
                                if (!m.genres?.length && d.genres?.length) { m.genres = d.genres; upd = true; }
                                if (!m.overview && d.overview) { m.overview = d.overview; upd = true; }
                            }
                            if (upd) updated++;
                            importButton.innerHTML = `<svg class="spinner" viewBox="0 0 24 24"><path d="M12 6v...z"/></svg> 补全数据(${updated}/${newCount})...`;
                            return m;
                         });
                         await Promise.allSettled(promises);
                         if (i + batchSize < toAdd.length) await new Promise(res => setTimeout(res, delayBetweenBatches));
                     }
                 }

                // Add processed movies to existing ones
                const finalMovies = [...existingMovies, ...toAdd];
                localStorage.setItem('movies', JSON.stringify(finalMovies));
                currentPage = 1; // Reset to first page
                renderMovies();
                closeModal('importCsvModal');
                alert(`注入完成！\n成功植入 ${newCount} 条片段。\n${apiKey ? `其中 ${updated} 条数据已补全。\n` : ''}${skipped > 0 ? `跳过 ${skipped} 条可能重复的片段 (基于标题和年份)。` : ''}`);
            } else {
                alert(`注入完成。未发现新片段可植入 (检查了 ${importedMovies.length} 行)。${skipped > 0 ? ` 跳过 ${skipped} 条可能重复的片段 (基于标题和年份)。` : ''}`);
                closeModal('importCsvModal');
            }
        } catch (err) {
            console.error("导入 CSV 时出错:", err);
            alert('CSV 处理失败：' + err.message);
        }
        finally {
            fileInput.value = ''; // Clear file input
            fileNameSpan.textContent = '未选择文件';
            importButton.disabled = false;
            importButton.innerHTML = originalButtonContent;
        }
    };
    reader.onerror = (err) => {
        console.error("文件读取错误:", err);
        alert('读取文件失败。');
        importButton.disabled = false;
        importButton.innerHTML = originalButtonContent;
    };
    reader.readAsText(fileInput.files[0], 'UTF-8'); // Specify UTF-8 encoding
}

// Escape CSV value function
function escapeCSVValue(v) {
    if (v == null) return ''; // Handle null or undefined
    let s = String(v);
    // If the string contains a comma, newline, or double quote, enclose it in double quotes
    if (/[",\n]/.test(s)) {
        // Escape existing double quotes by doubling them
        s = s.replace(/"/g, '""');
        // Enclose the entire string in double quotes
        s = `"${s}"`;
    }
    return s;
}

function exportCSV() {
    let movies = JSON.parse(localStorage.getItem('movies') || '[]');
    if (movies.length === 0) { alert('无数据可导出。'); return; }

    // Use the currently applied sort order for export
    const sortedMovies = sortMovies([...movies], currentSortOrder); // Sort a copy

    const headers = ['片段标识符', '神经评分', '访问日期', '个人日志', '发行纪年', '来源地区', '数据接口', '信息源', '类型协议', '核心摘要', '视觉快照URL', '内部ID', '植入日期', '最后修改日期'];
    const rows = sortedMovies.map(m => [
        m.title,
        m.rating,
        m.ratingDate, // Already YYYY-MM-DD or null
        m.review,
        m.year,
        m.country,
        m.link,
        m.director,
        (m.genres || []).join('; '), // Join genres with semicolon
        m.overview,
        m.coverUrl,
        m.id, // Use the internal ID
        m.createdAt ? new Date(m.createdAt).toISOString() : '', // Format dates as ISO strings
        m.updatedAt ? new Date(m.updatedAt).toISOString() : ''
    ].map(escapeCSVValue).join(',')); // Escape each value and join with comma

    const csvString = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel compatibility

    // Create download link
    const link = document.createElement('a');
    if (link.download === undefined) {
        alert('浏览器不支持自动下载。');
        return;
    }
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    link.setAttribute('href', url);
    link.setAttribute('download', `意识档案库_${timestamp}_排序_${currentSortOrder}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean up
}


// --- 电影增删改查与渲染 ---

async function addMovie(e) {
    e.preventDefault(); // Prevent default form submission
    const addButton = document.querySelector('#addMovieBtnInModal');
    const originalButtonContent = addButton.innerHTML;
    const titleInput = document.getElementById('modalTitle');
    const ratingInput = document.getElementById('modalRating');
    const ratingDateInput = document.getElementById('modalRatingDate');
    const reviewInput = document.getElementById('modalReview');

    const title = titleInput.value.trim();
    const rating = parseFloat(ratingInput.value) || null; // Use null if not a valid number
    const ratingDate = ratingDateInput.value || null; // Use null if empty
    const review = reviewInput.value.trim();

    if (!title) { alert('片段标识符不能为空！'); return; }
    if (ratingDate && isNaN(new Date(ratingDate).getTime())) { alert('访问日期格式无效！请使用 YYYY-MM-DD 或留空。'); return; }
    if (rating !== null && (rating < 0 || rating > 10)) { alert('神经评分必须在 0 到 10 之间！'); return; } // Validate rating range

    addButton.disabled = true;
    addButton.innerHTML = `<svg class="spinner" viewBox="0 0 24 24"><path d="M12 6v2a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z"/></svg> 处理中...`;

    let details = { posterUrl: null, director: null, year: null, country: null, genres: [], overview: null };
    try {
        if (getTmdbApiKey()) {
            addButton.innerHTML = `<svg class="spinner" viewBox="0 0 24 24"><path d="M12 6v2a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z"/></svg> 获取数据...`;
            details = await fetchMovieDetailsFromTmdb(title);
        }

        const movie = {
            id: Date.now() + Math.random(), // Use timestamp + random for better uniqueness
            title,
            rating,
            ratingDate,
            review,
            director: details.director || '', // Default to empty string if null
            year: details.year || null, // Keep null if not found
            country: details.country || '',
            coverUrl: details.posterUrl || '', // Default to empty string, will use placeholder in render
            link: '', // Default empty link
            genres: details.genres || [],
            overview: details.overview || '',
            createdAt: new Date().toISOString()
        };

        const movies = JSON.parse(localStorage.getItem('movies') || '[]');
        movies.push(movie);
        localStorage.setItem('movies', JSON.stringify(movies));

        currentPage = 1; // Go to first page to show the new movie
        renderMovies();
        document.getElementById('addMovieFormModal').reset(); // Reset the form
        closeModal('addMovieModal');

    } catch (err) {
        console.error("添加电影时出错:", err);
        alert("添加片段时发生错误，请检查控制台获取更多信息。");
    } finally {
        addButton.disabled = false;
        addButton.innerHTML = originalButtonContent;
    }
}

function filterMovies(movies, term) {
    const lowerTerm = term.toLowerCase().trim();
    if (!lowerTerm) return movies;

    // Optimized filtering: check properties only if they exist
    return movies.filter(m =>
        (m.title && m.title.toLowerCase().includes(lowerTerm)) ||
        (m.director && m.director.toLowerCase().includes(lowerTerm)) ||
        (m.review && m.review.toLowerCase().includes(lowerTerm)) ||
        (m.year && String(m.year).includes(lowerTerm)) || // Year check is fine
        (m.genres && m.genres.some(g => g.toLowerCase().includes(lowerTerm))) ||
        (m.country && m.country.toLowerCase().includes(lowerTerm)) // Added country search
    );
}

function filterMoviesByGenre(movies, genre) {
    if (!genre) return movies;
    return movies.filter(m => m.genres && Array.isArray(m.genres) && m.genres.includes(genre));
}

function sortMovies(movies, sortOrder) {
    // Helper functions for robust sorting (handle null/undefined/NaN)
    const getDate = (d) => {
        if (!d) return 0; // Treat null/empty dates as oldest
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? 0 : dt.getTime();
    };
    const getNum = (n, desc = true) => {
        // Treat null/undefined ratings/years as lowest (-Infinity)
        // If ascending, nulls should come first. If descending, nulls should come last.
        const val = typeof n === 'number' && !isNaN(n) ? n : (desc ? -Infinity : Infinity);
        return val;
    };
    const getStr = (s) => (s || '').toLowerCase(); // Treat null/empty strings as empty

    // Use slice() to avoid modifying the original array if it's passed directly
    movies.sort((a, b) => {
        switch (sortOrder) {
            case 'ratingDate_desc': return getDate(b.ratingDate) - getDate(a.ratingDate);
            case 'ratingDate_asc': return getDate(a.ratingDate) - getDate(b.ratingDate);
            case 'rating_desc': return getNum(b.rating, true) - getNum(a.rating, true);
            case 'rating_asc': return getNum(a.rating, false) - getNum(b.rating, false);
            case 'title_asc': return getStr(a.title).localeCompare(getStr(b.title), 'zh-CN');
            case 'title_desc': return getStr(b.title).localeCompare(getStr(a.title), 'zh-CN');
            case 'year_desc': return getNum(b.year, true) - getNum(a.year, true);
            case 'year_asc': return getNum(a.year, false) - getNum(b.year, false);
             // Sort by creation timestamp (ISO string comparison works)
            case 'added_desc': return (b.createdAt || '0').localeCompare(a.createdAt || '0');
            case 'added_asc': return (a.createdAt || '0').localeCompare(b.createdAt || '0');
            default: return 0;
        }
    });
    return movies;
}

function populateGenreFilter() {
    // Get genres from the currently available movies in localStorage
    const movies = JSON.parse(localStorage.getItem('movies') || '[]');
    const genres = new Set();
    movies.forEach(m => {
        if (m.genres && Array.isArray(m.genres)) {
            m.genres.forEach(g => genres.add(g.trim())); // Trim whitespace from genres
        }
    });

    const select = document.getElementById('genreFilter');
    const prevVal = select.value; // Remember the previously selected value
    select.innerHTML = '<option value="">所有类型协议</option>'; // Reset options

    // Sort genres locale-aware (Chinese friendly)
    const sortedGenres = Array.from(genres).filter(Boolean).sort((a, b) => a.localeCompare(b, 'zh-CN'));

    sortedGenres.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.textContent = g;
        select.appendChild(opt);
    });

    // Restore previous selection if it still exists
    select.value = sortedGenres.includes(prevVal) ? prevVal : "";
    // Update global state (important if called outside renderMovies)
    currentGenreFilter = select.value;
}


function renderMovies() {
    // 1. Get and parse data ONCE
    const allMovies = JSON.parse(localStorage.getItem('movies') || '[]');
    const container = document.getElementById('movieList');
    const selectAllCheckbox = document.getElementById('selectAll');
    const movieCountSpan = document.getElementById('movieCount');
    const currentPageSpan = document.getElementById('currentPage');
    const totalPagesSpan = document.getElementById('totalPages');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const jumpPageInput = document.getElementById('jumpPage');
    const paginationDiv = document.getElementById('pagination');

    // Ensure filters/sort state are up-to-date (e.g., if called after an action)
    currentSearchTerm = document.getElementById('searchInput')?.value || '';
    currentSortOrder = document.getElementById('sortSelect')?.value || 'ratingDate_desc';
    currentGenreFilter = document.getElementById('genreFilter')?.value || '';

    // Update genre filter options before filtering
    populateGenreFilter();

    // 2. Filter and Sort Data
    const genreFiltered = filterMoviesByGenre(allMovies, currentGenreFilter);
    const searchFiltered = filterMovies(genreFiltered, currentSearchTerm);
    const sorted = sortMovies(searchFiltered, currentSortOrder); // sortMovies sorts in place

    // 3. Calculate Pagination
    const totalVisible = sorted.length;
    movieCountSpan.textContent = totalVisible;
    const totalPages = Math.ceil(totalVisible / moviesPerPage) || 1; // Ensure totalPages is at least 1

    // Adjust currentPage if it's out of bounds
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    currentPageSpan.textContent = currentPage;
    totalPagesSpan.textContent = totalPages;
    jumpPageInput.max = totalPages;
    jumpPageInput.value = ''; // Clear jump input

    // Enable/disable pagination buttons
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
    paginationDiv.style.display = totalVisible > 0 ? 'flex' : 'none'; // Hide pagination if no results

    // 4. Prepare items for the current page
    const start = (currentPage - 1) * moviesPerPage;
    const end = Math.min(start + moviesPerPage, totalVisible);
    const pageMovies = sorted.slice(start, end);

    // 5. Render using DocumentFragment for performance
    const fragment = document.createDocumentFragment();
    if (totalVisible === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-message';
        emptyMsg.textContent = (currentGenreFilter || currentSearchTerm)
            ? `未找到匹配当前筛选条件的片段。`
            : '档案库为空，请植入新的意识片段。';
        fragment.appendChild(emptyMsg);
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else {
        pageMovies.forEach((m, i) => {
            const el = document.createElement('div');
            el.className = 'movie-item';
            // Stagger animation slightly - useful for visual feedback on changes
            el.style.animationDelay = `${0.05 + (i % moviesPerPage) * 0.03}s`;
            el.dataset.movieId = m.id; // Use dataset for ID

            const rating = typeof m.rating === 'number' ? m.rating.toFixed(1) : null;
            const cover = m.coverUrl || DEFAULT_POSTER_URL; // Use default if no cover
            const date = m.ratingDate ? new Date(m.ratingDate).toLocaleDateString('sv-SE') : null; // YYYY-MM-DD

            // Use template literal for cleaner HTML structure
            el.innerHTML = `
                <div class="checkbox-container">
                    <input type="checkbox" class="movie-checkbox" data-id="${m.id}" title="选择此片段">
                </div>
                <div class="movie-item-poster">
                    <img src="${cover}" alt="${m.title || '片段'} 视觉快照" loading="lazy" onerror="this.onerror=null; this.src='${DEFAULT_POSTER_URL}';">
                </div>
                <div class="movie-item-content">
                    <h3 class="movie-title" title="${m.title || ''}">${m.title || '未命名片段'}</h3>
                    <div class="movie-card-meta">
                        ${rating !== null
                            ? `<span class="movie-card-rating" title="神经评分 ${rating}">
                                 <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                                 <span>${rating}</span>
                               </span>`
                            : '<span class="movie-card-rating placeholder">未评分</span>'
                        }
                        ${date ? `<span class="movie-card-date" title="访问日期">${date}</span>` : ''}
                    </div>
                </div>`;
            fragment.appendChild(el);
        });
    }

    // 6. Update DOM efficiently
    container.innerHTML = ''; // Clear previous content
    container.appendChild(fragment); // Append the fragment

    // 7. Update selection state after rendering
    checkSelectedMovies();
}


function showMovieDetails(movieId) {
    const movies = JSON.parse(localStorage.getItem('movies') || '[]');
    // Find movie by ID (ensure type consistency, although dataset.movieId should be string)
    const movie = movies.find(m => String(m.id) === String(movieId));

    if (!movie) {
        console.error("未找到 ID 为 " + movieId + " 的片段");
        alert("无法加载片段详情，请刷新页面重试。");
        return;
    }

    // --- Populate Modal Elements ---
    document.getElementById('detailTitle').textContent = movie.title || '未命名片段';
    document.getElementById('detailFullTitle').textContent = movie.title || '未命名片段'; // Set full title in info area
    const detailPoster = document.getElementById('detailPoster');
    detailPoster.src = movie.coverUrl || DEFAULT_POSTER_URL;
    detailPoster.alt = `${movie.title || ''} 视觉快照`;
    detailPoster.onerror = () => { // Add onerror handler for detail poster too
         detailPoster.onerror = null; // Prevent infinite loop
         detailPoster.src = DEFAULT_POSTER_URL;
    };


    const metaContainer = document.getElementById('detailMeta');
    metaContainer.innerHTML = '<label>核心参数:</label>'; // Reset content but keep label

    // Helper to create meta items (more readable)
    const createMetaItem = (iconPath, title, value) => {
        if (!value) return ''; // Don't create item if value is missing
        return `
            <div class="meta-item" title="${title}: ${value}">
                <svg viewBox="0 0 24 24"><path d="${iconPath}"/></svg>
                <span>${value}</span>
            </div>`;
    };

    // Icons paths (replace with your actual SVG paths or keep as is)
    const yearIcon = "M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z";
    const directorIcon = "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z";
    const countryIcon = "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z";
    const ratingIcon = "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";

    metaContainer.innerHTML += createMetaItem(yearIcon, "发行纪年", movie.year);
    metaContainer.innerHTML += createMetaItem(directorIcon, "信息源 (导演)", movie.director);
    metaContainer.innerHTML += createMetaItem(countryIcon, "来源地区", movie.country);

    // Rating
    const ratingContainer = document.getElementById('detailRating');
    if (typeof movie.rating === 'number') {
        ratingContainer.innerHTML = `<svg viewBox="0 0 24 24"><path d="${ratingIcon}"/></svg><span>${movie.rating.toFixed(1)}</span>`;
        ratingContainer.title = `神经评分: ${movie.rating.toFixed(1)}`;
    } else {
        ratingContainer.innerHTML = '<span class="placeholder" style="font-size: 1rem; font-style: italic;">未评分</span>';
        ratingContainer.title = ''; // Clear title if no rating
    }

    // Genres
    const genresContainer = document.getElementById('detailGenres');
    const genresSection = document.getElementById('detailGenresContainer'); // The whole block
    if (movie.genres && movie.genres.length > 0) {
        genresContainer.innerHTML = movie.genres.map(g => `<span>${g}</span>`).join('');
        genresSection.style.display = 'block'; // Show the block
    } else {
        genresContainer.innerHTML = '';
        genresSection.style.display = 'none'; // Hide the block if no genres
    }

    // Overview
    const overviewEl = document.getElementById('detailOverview');
    const overviewSection = document.getElementById('detailOverviewContainer');
    if (movie.overview) {
        overviewEl.textContent = movie.overview;
        overviewSection.style.display = 'block';
    } else {
        overviewEl.textContent = '';
        overviewSection.style.display = 'none';
    }

    // User Review and Date
    document.getElementById('detailUserReview').textContent = movie.review || '无个人日志。';
    const userRatingDateEl = document.getElementById('detailUserRatingDate');
    if (movie.ratingDate) {
         userRatingDateEl.textContent = `访问日期: ${new Date(movie.ratingDate).toLocaleDateString('sv-SE')}`; // YYYY-MM-DD
         userRatingDateEl.style.display = 'block';
    } else {
         userRatingDateEl.textContent = '';
         userRatingDateEl.style.display = 'none';
    }


    // Link
    const linkContainer = document.getElementById('detailLinkContainer');
    if (movie.link) {
        // Use a template literal for the button, ensure SVG path is correct
        const linkIcon = "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z";
        linkContainer.innerHTML = `
            <a href="${movie.link}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-small" title="打开链接: ${movie.link}">
                <svg viewBox="0 0 24 24" width="14" height="14"><path d="${linkIcon}"/></svg>
                访问接口
            </a>`;
        linkContainer.style.display = 'block';
    } else {
        linkContainer.innerHTML = '';
        linkContainer.style.display = 'none';
    }

    // Edit Button - Re-attach listener safely
    const editBtn = document.getElementById('editFromDetailBtn');
    const newEditBtn = editBtn.cloneNode(true); // Clone to remove old listeners
    editBtn.parentNode.replaceChild(newEditBtn, editBtn);
    newEditBtn.addEventListener('click', () => {
        closeModal('movieDetailModal');
        editMovie(movieId); // Pass the correct ID
    });

    openModal('movieDetailModal');
}


function deleteMovie(id) {
    // Confirm deletion
    if (!confirm(`确定要永久删除此意识片段吗？\nID: ${id}`)) {
        return;
    }
    let movies = JSON.parse(localStorage.getItem('movies') || '[]');
    const initialLength = movies.length;
    // Filter out the movie with the matching ID (ensure type comparison if needed)
    movies = movies.filter(m => String(m.id) !== String(id));

    // Check if a movie was actually removed
    if (movies.length < initialLength) {
        localStorage.setItem('movies', JSON.stringify(movies));
        renderMovies(); // Re-render the list
        // Optionally, close detail modal if it was open for this movie
        // const detailModal = document.getElementById('movieDetailModal');
        // if(detailModal.classList.contains('active') && detailModal.dataset.showingId === String(id)) {
        //    closeModal('movieDetailModal');
        // }
    } else {
        console.warn(`删除失败：未找到 ID 为 ${id} 的片段。`);
        alert('删除失败，未找到目标片段。');
    }
}

function deleteSelectedMovies() {
    const selectedCheckboxes = document.querySelectorAll('#movieList .movie-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
        alert('请先在当前页选择要清除的片段。');
        return;
    }

    const idsToDelete = Array.from(selectedCheckboxes).map(cb => String(cb.dataset.id));
    const count = idsToDelete.length;

    if (!confirm(`确定要永久清除当前页选中的 ${count} 条片段吗？`)) {
        return;
    }

    let movies = JSON.parse(localStorage.getItem('movies') || '[]');
    const initialLength = movies.length;
    // Filter out movies whose IDs are in the deletion list
    movies = movies.filter(m => !idsToDelete.includes(String(m.id)));

    if (movies.length < initialLength) {
        localStorage.setItem('movies', JSON.stringify(movies));
        document.getElementById('selectAll').checked = false; // Uncheck "select all"
        renderMovies(); // Re-render the list
        console.log(`成功删除了 ${initialLength - movies.length} 条片段。`);
    } else {
        console.warn('尝试删除选中片段，但似乎没有匹配项被移除。');
        // No alert needed here as the confirmation was passed.
    }
}


function editMovie(id) {
    const movies = JSON.parse(localStorage.getItem('movies') || '[]');
    const movie = movies.find(m => String(m.id) === String(id));
    if (!movie) {
        alert('无法编辑：未找到片段信息。');
        return;
    }

    // Populate the edit form modal
    document.getElementById('editMovieId').value = movie.id;
    document.getElementById('editTitle').value = movie.title || '';
    document.getElementById('editDirector').value = movie.director || '';
    document.getElementById('editYear').value = movie.year || '';
    document.getElementById('editRating').value = typeof movie.rating === 'number' ? movie.rating : ''; // Handle null rating
    document.getElementById('editRatingDate').value = movie.ratingDate || ''; // Already YYYY-MM-DD or empty
    document.getElementById('editCountry').value = movie.country || '';
    document.getElementById('editLink').value = movie.link || '';
    document.getElementById('editCoverUrl').value = movie.coverUrl || '';
    document.getElementById('editReview').value = movie.review || '';

    openModal('editMovieModal');
}

function saveMovieEdit() {
    const id = document.getElementById('editMovieId').value;
    if (!id) return; // Should not happen if modal opened correctly

    const movies = JSON.parse(localStorage.getItem('movies') || '[]');
    const index = movies.findIndex(m => String(m.id) === String(id));

    if (index === -1) {
        alert('更新失败，未找到要编辑的片段。');
        closeModal('editMovieModal');
        return;
    }

    // Get values from form
    const title = document.getElementById('editTitle').value.trim();
    const director = document.getElementById('editDirector').value.trim();
    const year = parseInt(document.getElementById('editYear').value) || null; // Use null if not a valid year
    const rating = parseFloat(document.getElementById('editRating').value) || null; // Use null if not valid number
    const ratingDateInput = document.getElementById('editRatingDate').value;
    const country = document.getElementById('editCountry').value.trim();
    const link = document.getElementById('editLink').value.trim();
    const coverUrl = document.getElementById('editCoverUrl').value.trim();
    const review = document.getElementById('editReview').value.trim();

    // Validate inputs
    if (!title) { alert('片段标识符不能为空！'); return; }
    if (ratingDateInput && isNaN(new Date(ratingDateInput).getTime())) { alert('访问日期格式无效！请使用 YYYY-MM-DD 或留空。'); return; }
    if (year && (year < 1880 || year > 2099)) { alert('发行纪年无效！'); return; }
    if (rating !== null && (rating < 0 || rating > 10)) { alert('神经评分必须在 0 到 10 之间！'); return; }

    const ratingDate = ratingDateInput || null; // Store as null if empty

    // Update the movie object in the array
    movies[index] = {
        ...movies[index], // Preserve original ID and createdAt
        title,
        director,
        year,
        rating,
        ratingDate,
        country,
        link,
        coverUrl,
        review,
        updatedAt: new Date().toISOString() // Add/Update modification timestamp
    };

    // Save back to localStorage
    localStorage.setItem('movies', JSON.stringify(movies));

    closeModal('editMovieModal');
    renderMovies(); // Re-render to show changes
}


// --- 模态框与下拉菜单控制 ---
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        // Prevent background scrolling when modal is open
        document.body.style.overflow = 'hidden';
    } else {
        console.error(`尝试打开模态框失败：未找到 ID: "${id}"`);
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
        // Restore background scrolling only if NO other modals are active
        // Check if any modal overlay still has the 'active' class
        const anyModalActive = document.querySelector('.modal-overlay.active');
        if (!anyModalActive) {
            document.body.style.overflow = '';
        }
    }
     // Reset forms within closed modals (optional, but good practice)
     const form = modal?.querySelector('form');
     if (form) {
         form.reset();
     }
     // Clear file input name if closing import modal
     if (id === 'importCsvModal') {
         document.getElementById('modalFileName').textContent = '未选择文件';
     }
     // Reset API key placeholder if needed (though saving handles this better)
}

// Dropdown Menu Logic
let isDropdownOpen = false;
const manageMenuBtn = document.getElementById('manageMenuBtn');
const manageMenuDropdown = document.getElementById('manageMenuDropdown');

function toggleDropdown() {
    isDropdownOpen = !isDropdownOpen;
    manageMenuDropdown.classList.toggle('active', isDropdownOpen); // Use second arg for clarity
    manageMenuBtn.setAttribute('aria-expanded', isDropdownOpen);
}

function closeDropdown() {
    if (isDropdownOpen) {
        isDropdownOpen = false;
        manageMenuDropdown.classList.remove('active');
        manageMenuBtn.setAttribute('aria-expanded', isDropdownOpen);
    }
}

// --- UI & 分页 ---
function goToNextPage() {
    // Recalculate total pages based on current filters before incrementing
    const allMovies = JSON.parse(localStorage.getItem('movies') || '[]');
    const genreFiltered = filterMoviesByGenre(allMovies, currentGenreFilter);
    const searchFiltered = filterMovies(genreFiltered, currentSearchTerm);
    const totalVisible = searchFiltered.length;
    const totalPages = Math.ceil(totalVisible / moviesPerPage) || 1;

    if (currentPage < totalPages) {
        currentPage++;
        renderMovies();
        // Scroll to top of list section smoothly
        document.getElementById('my-collection-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function goToPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderMovies();
        document.getElementById('my-collection-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function jumpToPage() {
    const input = document.getElementById('jumpPage');
    const pageNum = parseInt(input.value);

    // Recalculate total pages based on current filters for validation
    const allMovies = JSON.parse(localStorage.getItem('movies') || '[]');
    const genreFiltered = filterMoviesByGenre(allMovies, currentGenreFilter);
    const searchFiltered = filterMovies(genreFiltered, currentSearchTerm);
    const totalVisible = searchFiltered.length;
    const totalPages = Math.ceil(totalVisible / moviesPerPage) || 1;

    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        currentPage = pageNum;
        renderMovies();
        input.value = ''; // Clear input after jump
        document.getElementById('my-collection-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        alert(`请输入 1 到 ${totalPages} 之间的页码！`);
        input.value = ''; // Clear invalid input
    }
}

function handleSelectAll() {
    const isChecked = document.getElementById('selectAll').checked;
    const checkboxes = document.querySelectorAll('#movieList .movie-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
    });
    checkSelectedMovies(); // Update delete button state
}

function checkSelectedMovies() {
    const selectedCheckboxes = document.querySelectorAll('#movieList .movie-checkbox:checked');
    const allCheckboxesOnPage = document.querySelectorAll('#movieList .movie-checkbox');
    const deleteMenuItem = document.getElementById('deleteSelectedMenuItem');
    const selectAllCheckbox = document.getElementById('selectAll');

    const selectedCount = selectedCheckboxes.length;
    const totalOnPage = allCheckboxesOnPage.length;

    // Enable/disable delete button
    if (deleteMenuItem) {
        deleteMenuItem.classList.toggle('dropdown-item-disabled', selectedCount === 0);
        // Make it focusable only when enabled (accessibility)
        deleteMenuItem.tabIndex = (selectedCount === 0) ? -1 : 0;
    }

    // Update "Select All" checkbox state (checked, indeterminate, or unchecked)
    if (selectAllCheckbox) {
        if (totalOnPage === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
            selectAllCheckbox.disabled = true; // Disable if no items on page
        } else {
            selectAllCheckbox.disabled = false; // Enable if items exist
            selectAllCheckbox.checked = selectedCount === totalOnPage;
            selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalOnPage;
        }
    }
}

function searchDoubanFromModal() {
    const titleInput = document.getElementById('modalTitle');
    const title = titleInput.value.trim();
    if (!title) {
        alert('请先输入片段标识符。');
        return;
    }
    const url = `https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(title)}`;
    window.open(url, '_blank', 'noopener,noreferrer'); // Add security attributes
}


// --- Initialization ---
function init() {
    initStorage(); // Ensure 'movies' key exists in localStorage

    // --- Event Listeners Setup ---
    document.getElementById('nextPage')?.addEventListener('click', goToNextPage);
    document.getElementById('prevPage')?.addEventListener('click', goToPrevPage);
    document.getElementById('selectAll')?.addEventListener('change', handleSelectAll);
    // Use 'input' for instant feedback on search
    document.getElementById('searchInput')?.addEventListener('input', () => { currentPage = 1; renderMovies(); });
    document.getElementById('sortSelect')?.addEventListener('change', () => { currentPage = 1; renderMovies(); });
    document.getElementById('genreFilter')?.addEventListener('change', () => { currentPage = 1; renderMovies(); });
    // Jump page on button click (already handled by onclick) or Enter key in input
    document.getElementById('jumpPage')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') jumpToPage(); });

    // Event delegation for movie list clicks (details and checkbox)
    document.getElementById('movieList')?.addEventListener('click', (e) => {
        const movieItem = e.target.closest('.movie-item');
        if (!movieItem) return; // Click was not inside a movie item

        const isCheckbox = e.target.classList.contains('movie-checkbox');
        const isCheckboxContainer = e.target.closest('.checkbox-container');

        if (isCheckbox) {
            // Checkbox itself was clicked
            checkSelectedMovies(); // Update selection state immediately
        } else if (isCheckboxContainer) {
            // Clicked the area around the checkbox, toggle the checkbox
            const checkbox = isCheckboxContainer.querySelector('.movie-checkbox');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                // Manually trigger change event if needed, or just update state
                checkSelectedMovies();
            }
        } else {
            // Clicked anywhere else on the item, show details
            const movieId = movieItem.dataset.movieId;
            if (movieId) {
                showMovieDetails(movieId);
            }
        }
    });

    // Global listeners
    document.addEventListener('keydown', (e) => {
        // Close modals or dropdown on Escape key
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal-overlay.active');
            if (activeModal) {
                closeModal(activeModal.id);
            } else if (isDropdownOpen) {
                closeDropdown();
            }
        }
    });

    // Click outside modal/dropdown to close
    document.body.addEventListener('click', (e) => {
        // Close modal if clicking on the overlay itself
        if (e.target.classList.contains('modal-overlay')) {
            closeModal(e.target.id);
        }
        // Close dropdown if clicking outside the button and the menu
        if (isDropdownOpen && manageMenuBtn && manageMenuDropdown &&
            !manageMenuBtn.contains(e.target) && !manageMenuDropdown.contains(e.target)) {
            closeDropdown();
        }
    });

    // Update file name display on file selection
    document.getElementById('modalFileInput')?.addEventListener('change', (e) => {
        document.getElementById('modalFileName').textContent = e.target.files[0]?.name || '未选择文件';
    });

    // Dropdown toggle button
    manageMenuBtn?.addEventListener('click', toggleDropdown);

    // --- Initial UI Setup ---
    // Display current date in footer
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    // Set API key input placeholder based on storage
    if (getTmdbApiKey()) {
        document.getElementById('modalTmdbApiKey').placeholder = "密钥已保存 (输入新密钥覆盖)";
    }
     // Set initial sort order display
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) sortSelect.value = currentSortOrder;


    // --- Initial Render ---
    renderMovies();
}

// --- Run Initialization ---
// Use DOMContentLoaded to ensure the DOM is ready before running scripts
document.addEventListener('DOMContentLoaded', init);