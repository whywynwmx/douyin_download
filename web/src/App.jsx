import React from 'react';
import Downloader from './components/Downloader';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>抖音无水印视频下载</h1>
        <p className="subtitle">复制粘贴抖音的分享链接，直接下载高清无水印原视频</p>
      </header>
      <main>
        <Downloader />
      </main>
      <footer>
      </footer>
    </div>
  );
}

export default App;
