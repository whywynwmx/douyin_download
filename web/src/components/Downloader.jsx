import React, { useState } from 'react';
import Spinner from './Spinner';
import './Downloader.css';

function Downloader() {
    const [shareUrl, setShareUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    const handleAnalyze = async () => {
        if (!shareUrl) {
            setError('请输入分享链接');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
                        const response = await fetch('http://localhost:8080/api/v1/douyin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ share_link: shareUrl }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP 错误! 状态: ${response.status}`);
            }

                        if (data.download_url) {
                setResult(data);
            } else {
                throw new Error(data.message || '分析失败，未返回视频地址');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getDownloadFilename = () => {
        if (!result || !result.title) return 'douyin_video.mp4';
        return result.title.replace(/[\\/\\:*?"<>|]/g, '') + '.mp4';
    };

    return (
        <div className="downloader-container">
            <div className="input-wrapper">
                <input
                    type="text"
                    value={shareUrl}
                    onChange={(e) => setShareUrl(e.target.value)}
                    placeholder="粘贴抖音分享链接..."
                    className="url-input"
                    disabled={loading}
                />
                <button onClick={handleAnalyze} disabled={loading} className="analyze-button">
                    {loading ? '分析中...' : '分析'}
                </button>
            </div>

            {loading && <Spinner />}

            {error && <div className="error-message">{error}</div>}

            {result && (
                <div className="result-wrapper animate-fade-in">
                    <h2 className="video-title">{result.title}</h2>
                    <div className="video-container">
                        <video src={result.download_url} controls className="video-player"></video>
                    </div>
                    <a href={result.download_url} download={getDownloadFilename()} className="download-link">
                        下载视频
                    </a>
                </div>
            )}
        </div>
    );
}

export default Downloader;
