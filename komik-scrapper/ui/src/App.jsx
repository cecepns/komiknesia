import { useState, useRef, useEffect } from 'react';
import './index.css';

function App() {
  const [source, setSource] = useState('apkomik');
  const [urlOrSlug, setUrlOrSlug] = useState('');
  
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [mangaDetail, setMangaDetail] = useState(null);
  
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [selectionMode, setSelectionMode] = useState('all');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  
  const [mode, setMode] = useState('single'); // 'single' | 'bulk'
  const [bulkInput, setBulkInput] = useState('');
  const [bulkSelectionMode, setBulkSelectionMode] = useState('all'); // 'all' | 'latest'
  const [syncPerChapter, setSyncPerChapter] = useState(false);
  
  const [bulkType, setBulkType] = useState('manual'); // 'manual' | 'list'
  const [listPageUrl, setListPageUrl] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [fetchedMangaList, setFetchedMangaList] = useState([]);
  const [selectedMangas, setSelectedMangas] = useState([]);
  
  const logEndRef = useRef(null);

  const fetchPreview = async () => {
    if (!urlOrSlug.trim()) return;
    setLoadingPreview(true);
    setMangaDetail(null);
    setLogs([]);
    
    try {
      const res = await fetch(`http://localhost:4000/api/preview?source=${source}&urlOrSlug=${encodeURIComponent(urlOrSlug)}`);
      const data = await res.json();
      if (res.ok) {
        setMangaDetail(data.mangaDetail);
        setSelectedChapters(data.mangaDetail.chapters);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert(`Gagal menghubungi lokal server: ${error.message}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const runScrapeProcess = (sourceVal, detail, chapters) => {
    return new Promise((resolve, reject) => {
      const chaptersParam = encodeURIComponent(JSON.stringify(chapters));
      let baseUrl;
      try {
        baseUrl = new URL(detail.url).origin;
      } catch (e) {
        baseUrl = sourceVal === 'apkomik' ? 'https://01.apkomik.com' : 'https://v6.kiryuu.to';
      }
      
      const url = `http://localhost:4000/api/process?source=${sourceVal}&slug=${detail.slug}&baseUrl=${encodeURIComponent(baseUrl)}&chapters=${chaptersParam}&syncPerChapter=${syncPerChapter}`;
      
      const eventSource = new EventSource(url);
      
      eventSource.addEventListener('log', (e) => {
        const data = JSON.parse(e.data);
        setLogs(prev => [...prev, { type: 'normal', text: `  → ${data.message}` }]);
      });
      
      eventSource.addEventListener('error', (e) => {
        const data = JSON.parse(e.data);
        setLogs(prev => [...prev, { type: 'error', text: `  ❌ ${data.message}` }]);
        eventSource.close();
        reject(new Error(data.message));
      });

      eventSource.addEventListener('done', (e) => {
        const data = JSON.parse(e.data);
        eventSource.close();
        if (data.success) {
          setLogs(prev => [...prev, { type: 'success', text: `  ✅ ${detail.title} selesai!` }]);
          resolve();
        } else {
          setLogs(prev => [...prev, { type: 'error', text: `  ❌ Gagal: ${data.error}` }]);
          reject(new Error(data.error));
        }
      });
    });
  };

  const startScraping = async () => {
    if (!mangaDetail || selectedChapters.length === 0) return;
    
    setIsProcessing(true);
    setLogs([{ type: 'info', text: `🚀 Memulai proses scraping untuk ${selectedChapters.length} chapter...` }]);
    
    let hasError = false;
    for (let i = 0; i < selectedChapters.length; i++) {
      const ch = selectedChapters[i];
      setLogs(prev => [...prev, { type: 'info', text: `\n[Chapter ${i+1}/${selectedChapters.length}] Memproses ${ch.title}...` }]);
      try {
        await runScrapeProcess(source, mangaDetail, [ch]);
        
        if (i < selectedChapters.length - 1) {
          setLogs(prev => [...prev, { type: 'normal', text: `Menunggu 2 detik sebelum chapter berikutnya...` }]);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (err) {
        setLogs(prev => [...prev, { type: 'error', text: `❌ Gagal memproses chapter ${ch.title}: ${err.message}` }]);
        hasError = true;
      }
    }
    
    if (hasError) {
      setLogs(prev => [...prev, { type: 'error', text: '\n⚠️ Proses selesai dengan beberapa error.' }]);
    } else {
      setLogs(prev => [...prev, { type: 'success', text: '\n✅ Selesai! Semua data berhasil diupload dan disinkronisasi.' }]);
    }
    setIsProcessing(false);
  };
  const fetchMangaList = async () => {
    if (!listPageUrl.trim()) return;
    setLoadingList(true);
    setFetchedMangaList([]);
    setSelectedMangas([]);
    setLogs([]);

    try {
      const res = await fetch(`http://localhost:4000/api/list-manga?source=${source}&url=${encodeURIComponent(listPageUrl)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setFetchedMangaList(data.list);
        setSelectedMangas(data.list); // Default select all
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert(`Gagal mengambil daftar manga: ${error.message}`);
    } finally {
      setLoadingList(false);
    }
  };

  const toggleMangaSelection = (manga) => {
    setSelectedMangas(prev => {
      const exists = prev.find(m => m.slug === manga.slug);
      if (exists) return prev.filter(m => m.slug !== manga.slug);
      return [...prev, manga];
    });
  };

  const runBulkScraping = async () => {
    const targets = bulkType === 'manual' 
      ? bulkInput.split('\n').map(t => t.trim()).filter(Boolean)
      : selectedMangas.map(m => m.url || m.slug);
      
    if (targets.length === 0) return;

    setIsProcessing(true);
    setLogs([{ type: 'info', text: `🚀 Memulai bulk scraping untuk ${targets.length} manga...` }]);

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      setLogs(prev => [...prev, { type: 'info', text: `\n[${i + 1}/${targets.length}] Memproses: ${target}` }]);

      try {
        setLogs(prev => [...prev, { type: 'normal', text: `  Mengambil preview...` }]);
        const previewRes = await fetch(`http://localhost:4000/api/preview?source=${source}&urlOrSlug=${encodeURIComponent(target)}`);
        const previewData = await previewRes.json();
        
        if (!previewRes.ok) {
          throw new Error(previewData.error || 'Gagal mengambil preview');
        }

        const detail = previewData.mangaDetail;
        setLogs(prev => [...prev, { type: 'normal', text: `  Preview didapatkan: "${detail.title}" (${detail.chapters.length} chapter)` }]);

        let chaptersToScrape = [];
        if (bulkSelectionMode === 'all') {
          chaptersToScrape = detail.chapters;
        } else {
          chaptersToScrape = detail.chapters.length > 0 ? [detail.chapters[0]] : [];
        }

        if (chaptersToScrape.length === 0) {
          setLogs(prev => [...prev, { type: 'error', text: `  ⚠️ Tidak ada chapter ditemukan untuk manga ini.` }]);
          continue;
        }

        setLogs(prev => [...prev, { type: 'normal', text: `  Memulai scrape untuk ${chaptersToScrape.length} chapter...` }]);
        
        for (let j = 0; j < chaptersToScrape.length; j++) {
          const ch = chaptersToScrape[j];
          setLogs(prev => [...prev, { type: 'info', text: `  → [Chapter ${j+1}/${chaptersToScrape.length}] Memproses ${ch.title}...` }]);
          try {
            await runScrapeProcess(source, detail, [ch]);
            
            if (j < chaptersToScrape.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (chErr) {
            setLogs(prev => [...prev, { type: 'error', text: `  ❌ Gagal memproses chapter ${ch.title}: ${chErr.message}` }]);
          }
        }

      } catch (err) {
        setLogs(prev => [...prev, { type: 'error', text: `  ❌ Gagal memproses ${target}: ${err.message}` }]);
      }
    }

    setLogs(prev => [...prev, { type: 'success', text: '\n🎉 Semua bulk scraping selesai!' }]);
    setIsProcessing(false);
  };

  const handleSelectionMode = (mode) => {
    setSelectionMode(mode);
    if (!mangaDetail) return;
    
    if (mode === 'all') {
      setSelectedChapters(mangaDetail.chapters);
    } else if (mode === 'latest') {
      setSelectedChapters(mangaDetail.chapters.length > 0 ? [mangaDetail.chapters[0]] : []);
    } else {
      setSelectedChapters([]);
    }
  };

  const toggleChapter = (chapter) => {
    setSelectedChapters(prev => {
      const exists = prev.find(c => c.slug === chapter.slug);
      if (exists) return prev.filter(c => c.slug !== chapter.slug);
      return [...prev, chapter];
    });
  };

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div className="glass-panel">
      <h1>Komik Scrapper</h1>

      <div className="tabs">
        <button 
          className={`tab-btn ${mode === 'single' ? 'active' : ''}`} 
          onClick={() => !isProcessing && setMode('single')}
          disabled={isProcessing}
        >
          Single Manga
        </button>
        <button 
          className={`tab-btn ${mode === 'bulk' ? 'active' : ''}`} 
          onClick={() => !isProcessing && setMode('bulk')}
          disabled={isProcessing}
        >
          Bulk Manga (Multiple)
        </button>
      </div>
      
      <div className="form-group">
        <label>Sumber Website</label>
        <select value={source} onChange={(e) => setSource(e.target.value)} disabled={isProcessing}>
          <option value="apkomik">Apkomik (01.apkomik.com)</option>
          <option value="kiryuu">Kiryuu (v6.kiryuu.to)</option>
        </select>
      </div>

      {mode === 'single' ? (
        <>
          <div className="form-group">
            <label>Manga URL atau Slug</label>
            <input 
              type="text" 
              placeholder="https://... atau slug-komik"
              value={urlOrSlug}
              onChange={(e) => setUrlOrSlug(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <button onClick={fetchPreview} disabled={loadingPreview || isProcessing || !urlOrSlug}>
            {loadingPreview ? <><span className="loader"></span> Mengambil Data...</> : 'Preview Manga'}
          </button>

          {mangaDetail && (
            <div className="preview-card">
              {mangaDetail.coverImage ? (
                <img src={mangaDetail.coverImage} alt={mangaDetail.title} />
              ) : (
                <div style={{width: 150, height: 225, background: '#30363d', borderRadius: 8}}></div>
              )}
              <div className="preview-info">
                <h2>{mangaDetail.title}</h2>
                <p><strong>Total Chapter:</strong> {mangaDetail.chapters.length}</p>
                <p><strong>Tipe:</strong> {mangaDetail.contentType}</p>
                <p>{mangaDetail.synopsis || 'Tidak ada sinopsis'}</p>
              </div>
            </div>
          )}

          {mangaDetail && (
            <div className="chapter-selection">
              <div className="form-group">
                <label>Pilih Chapter ({selectedChapters.length} terpilih)</label>
                <select value={selectionMode} onChange={(e) => handleSelectionMode(e.target.value)} disabled={isProcessing}>
                  <option value="all">Semua Chapter</option>
                  <option value="latest">Hanya Chapter Terbaru (1)</option>
                  <option value="manual">Pilih Manual</option>
                </select>
              </div>

              {selectionMode === 'manual' && (
                <>
                  <div style={{ marginBottom: '0.8rem', display: 'flex', gap: '0.5rem' }}>
                    <button 
                      type="button" 
                      className="tab-btn" 
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', width: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}
                      onClick={() => setSelectedChapters(mangaDetail.chapters)}
                      disabled={isProcessing}
                    >
                      Pilih Semua
                    </button>
                    <button 
                      type="button" 
                      className="tab-btn" 
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', width: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}
                      onClick={() => setSelectedChapters([])}
                      disabled={isProcessing}
                    >
                      Hapus Semua
                    </button>
                  </div>
                  <div className="chapter-list">
                    {mangaDetail.chapters.map(ch => (
                      <label key={ch.slug} className="chapter-item">
                        <input 
                          type="checkbox" 
                          checked={!!selectedChapters.find(c => c.slug === ch.slug)}
                          onChange={() => toggleChapter(ch)}
                          disabled={isProcessing}
                          style={{width: 'auto', margin: 0}}
                        />
                        {ch.title}
                      </label>
                    ))}
                  </div>
                </>
              )}

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem', marginBottom: '1.25rem' }}>
                <input 
                  type="checkbox" 
                  id="syncPerChapterSingle"
                  checked={syncPerChapter}
                  onChange={(e) => setSyncPerChapter(e.target.checked)}
                  disabled={isProcessing}
                  style={{ width: 'auto', margin: 0 }}
                />
                <label htmlFor="syncPerChapterSingle" style={{ cursor: 'pointer', fontSize: '0.95rem', color: '#c9d1d9' }}>
                  Kirim ke API per chapter (dengan jeda 2 detik)
                </label>
              </div>

              <div style={{marginTop: '1.5rem'}}>
                <button 
                  onClick={startScraping} 
                  disabled={isProcessing || selectedChapters.length === 0}
                  style={{ background: 'var(--success)' }}
                >
                  {isProcessing ? <><span className="loader" style={{borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff'}}></span> Sedang Memproses...</> : `Start Scraping & Upload (${selectedChapters.length} Chapter)`}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="form-group">
            <label>Metode Input Bulk</label>
            <select value={bulkType} onChange={(e) => setBulkType(e.target.value)} disabled={isProcessing}>
              <option value="manual">Manual Input (Slug/URL per Baris)</option>
              <option value="list">Scrape Halaman Daftar Manga (Manga List Page)</option>
            </select>
          </div>

          {bulkType === 'manual' ? (
            <div className="form-group">
              <label>Daftar Manga URL atau Slug (satu per baris)</label>
              <textarea
                placeholder="https://01.apkomik.com/manga/slug-komik-1&#10;https://01.apkomik.com/manga/slug-komik-2&#10;slug-komik-3"
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                disabled={isProcessing}
              />
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>URL Halaman Daftar Manga</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    placeholder="Contoh: https://01.apkomik.com/manga-terbaru/ atau https://v6.kiryuu.to/manga/?order=latest"
                    value={listPageUrl}
                    onChange={(e) => setListPageUrl(e.target.value)}
                    disabled={isProcessing || loadingList}
                  />
                  <button 
                    type="button" 
                    onClick={fetchMangaList} 
                    disabled={loadingList || isProcessing || !listPageUrl.trim()}
                    style={{ width: 'auto', whiteSpace: 'nowrap' }}
                  >
                    {loadingList ? 'Mengambil...' : 'Ambil Daftar'}
                  </button>
                </div>
              </div>

              {fetchedMangaList.length > 0 && (
                <div className="chapter-selection" style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
                  <label>Pilih Manga ({selectedMangas.length} terpilih)</label>
                  <div style={{ marginBottom: '0.8rem', display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button 
                      type="button" 
                      className="tab-btn" 
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', width: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}
                      onClick={() => setSelectedMangas(fetchedMangaList)}
                      disabled={isProcessing}
                    >
                      Pilih Semua
                    </button>
                    <button 
                      type="button" 
                      className="tab-btn" 
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', width: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}
                      onClick={() => setSelectedMangas([])}
                      disabled={isProcessing}
                    >
                      Hapus Semua
                    </button>
                  </div>
                  <div className="chapter-list" style={{ maxHeight: '250px' }}>
                    {fetchedMangaList.map(m => (
                      <label key={m.slug} className="chapter-item">
                        <input 
                          type="checkbox" 
                          checked={!!selectedMangas.find(x => x.slug === m.slug)}
                          onChange={() => toggleMangaSelection(m)}
                          disabled={isProcessing}
                          style={{ width: 'auto', margin: 0 }}
                        />
                        {m.title} <span style={{ color: '#8b949e', fontSize: '0.8rem', marginLeft: '0.5rem' }}>({m.slug})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="form-group">
            <label>Mode Chapter</label>
            <select value={bulkSelectionMode} onChange={(e) => setBulkSelectionMode(e.target.value)} disabled={isProcessing}>
              <option value="all">Semua Chapter</option>
              <option value="latest">Hanya Chapter Terbaru (1)</option>
            </select>
          </div>

          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem', marginBottom: '1.25rem' }}>
            <input 
              type="checkbox" 
              id="syncPerChapterBulk"
              checked={syncPerChapter}
              onChange={(e) => setSyncPerChapter(e.target.checked)}
              disabled={isProcessing}
              style={{ width: 'auto', margin: 0 }}
            />
            <label htmlFor="syncPerChapterBulk" style={{ cursor: 'pointer', fontSize: '0.95rem', color: '#c9d1d9' }}>
              Kirim ke API per chapter (dengan jeda 2 detik)
            </label>
          </div>

          <div style={{marginTop: '1.5rem'}}>
            <button 
              onClick={runBulkScraping} 
              disabled={
                isProcessing || 
                (bulkType === 'manual' && !bulkInput.trim()) || 
                (bulkType === 'list' && selectedMangas.length === 0)
              }
              style={{ background: 'var(--success)' }}
            >
              {isProcessing ? <><span className="loader" style={{borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff'}}></span> Sedang Memproses Bulk...</> : 'Start Bulk Scraping & Upload'}
            </button>
          </div>
        </>
      )}

      {logs.length > 0 && (
        <div className="terminal-log">
          {logs.map((log, idx) => (
            <p key={idx} className={log.type}>{log.text}</p>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}

export default App;
