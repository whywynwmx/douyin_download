import React from 'react';
import Downloader from './components/Downloader';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>抖音无水印视频下载</h1>
        <p className="subtitle">基于 React & Go 构建</p>
      </header>
      <main>
        <Downloader />
      </main>
      <footer>
        <p>在浏览器中打开 `F:\\new\\douyin\\web\\index.html` 文件</p>
      </footer>
    </div>
  );
}

export default App;
