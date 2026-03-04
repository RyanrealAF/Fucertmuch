import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, Play, Pause, Download, Music, Drum, Guitar, User, Loader2 } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

const App = () => {
  const [file, setFile] = useState(null);
  const [stems, setStems] = useState('2');
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, completed, failed
  const [progress, setProgress] = useState(0);
  const [resultFiles, setResultFiles] = useState([]);

  useEffect(() => {
    let interval;
    if (status === 'processing' && jobId) {
      interval = setInterval(async () => {
        try {
          const response = await axios.get(`${API_BASE_URL}/status/${jobId}`);
          const { status: jobStatus, progress: jobProgress, files } = response.data;

          if (jobStatus === 'completed') {
            setStatus('completed');
            setResultFiles(files);
            clearInterval(interval);
          } else if (jobStatus === 'failed') {
            setStatus('failed');
            clearInterval(interval);
          } else {
            setProgress(jobProgress);
          }
        } catch (error) {
          console.error('Error fetching status:', error);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [status, jobId]);

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('stems', stems);

    setStatus('uploading');
    try {
      const response = await axios.post(`${API_BASE_URL}/upload`, formData);
      setJobId(response.data.job_id);
      setStatus('processing');
    } catch (error) {
      console.error('Upload failed:', error);
      setStatus('failed');
    }
  };

  const getStemIcon = (filename) => {
    const name = filename.toLowerCase();
    if (name.includes('vocals')) return <User className="w-6 h-6" />;
    if (name.includes('drums')) return <Drum className="w-6 h-6" />;
    if (name.includes('bass')) return <Guitar className="w-6 h-6" />;
    return <Music className="w-6 h-6" />;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-8">
      <header className="mb-12 text-center">
        <h1 className="text-5xl font-extrabold tracking-tighter bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent mb-2">
          SonicSplits
        </h1>
        <p className="text-slate-400">Professional Audio Stem Separation powered by AI</p>
      </header>

      <main className="w-full max-w-2xl bg-slate-900/50 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
        {status === 'idle' && (
          <div className="space-y-6">
            <div className="border-2 border-dashed border-slate-700 rounded-xl p-12 text-center hover:border-purple-500/50 transition-colors">
              <input
                type="file"
                id="audio-upload"
                className="hidden"
                accept="audio/*"
                onChange={handleFileChange}
              />
              <label htmlFor="audio-upload" className="cursor-pointer flex flex-col items-center">
                <Upload className="w-12 h-12 text-slate-500 mb-4" />
                <span className="text-lg font-medium text-slate-300">
                  {file ? file.name : "Choose audio file or drag & drop"}
                </span>
                <span className="text-sm text-slate-500 mt-2">MP3, WAV, FLAC (max 50MB)</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setStems('2')}
                className={`p-4 rounded-xl border-2 transition-all ${stems === '2' ? 'border-purple-600 bg-purple-600/10' : 'border-slate-800 bg-slate-800/50'}`}
              >
                <div className="font-bold">2 Stems</div>
                <div className="text-xs text-slate-400">Vocals + Backing</div>
              </button>
              <button
                onClick={() => setStems('4')}
                className={`p-4 rounded-xl border-2 transition-all ${stems === '4' ? 'border-purple-600 bg-purple-600/10' : 'border-slate-800 bg-slate-800/50'}`}
              >
                <div className="font-bold">4 Stems</div>
                <div className="text-xs text-slate-400">Vocals, Drums, Bass, Other</div>
              </button>
            </div>

            <button
              disabled={!file}
              onClick={handleUpload}
              className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl font-bold transition-colors shadow-lg shadow-purple-900/20"
            >
              Start Separation
            </button>
          </div>
        )}

        {(status === 'uploading' || status === 'processing') && (
          <div className="flex flex-col items-center py-12 space-y-6">
            <Loader2 className="w-16 h-16 text-purple-500 animate-spin" />
            <div className="text-center">
              <h3 className="text-xl font-bold">
                {status === 'uploading' ? 'Uploading...' : 'Splitting Audio...'}
              </h3>
              <p className="text-slate-500 text-sm mt-1">This may take a minute depending on file length.</p>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5">
              <div
                className="bg-purple-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {status === 'completed' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Separation Complete
            </h3>
            <div className="space-y-3">
              {resultFiles.map((url, idx) => (
                <div key={idx} className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  <div className="p-2 bg-slate-700 rounded-lg">
                    {getStemIcon(url)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium capitalize">{url.split('/').pop().split('.')[0]}</div>
                    <audio src={`${API_BASE_URL}${url}`} controls className="h-8 w-full mt-2" />
                  </div>
                  <a
                    href={`${API_BASE_URL}${url}`}
                    download
                    className="p-2 hover:text-purple-400 transition-colors"
                  >
                    <Download className="w-6 h-6" />
                  </a>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setStatus('idle');
                setFile(null);
                setResultFiles([]);
              }}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-colors mt-4"
            >
              Process Another File
            </button>
          </div>
        )}

        {status === 'failed' && (
          <div className="text-center py-12">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold">Separation Failed</h3>
            <p className="text-slate-400 mt-2">There was an error processing your file. Please try again.</p>
            <button
              onClick={() => setStatus('idle')}
              className="mt-6 px-8 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl"
            >
              Try Again
            </button>
          </div>
        )}
      </main>

      <footer className="mt-auto pt-12 text-slate-600 text-sm">
        &copy; 2024 SonicSplits AI. All rights reserved.
      </footer>
    </div>
  );
};

export default App;
