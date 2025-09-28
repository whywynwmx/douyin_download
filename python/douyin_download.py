#!/usr/bin/env python3
"""
抖音无水印视频下载并提取文本的 MCP 服务器

该服务器提供以下功能：
1. 解析抖音分享链接获取无水印视频链接
2. 下载视频并提取音频
3. 从音频中提取文本内容
4. 自动清理中间文件
"""

import re
import json
import requests
import tempfile
from pathlib import Path
# import ffmpeg
from urllib import request
from http import HTTPStatus

# 请求头，模拟移动端访问
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/121.0.2277.107 Version/17.0 Mobile/15E148 Safari/604.1'
}

class DouyinProcessor:
    """抖音视频处理器"""
    
    def __init__(self):
        self.temp_dir = Path(tempfile.mkdtemp())
    
    def __del__(self):
        """清理临时目录"""
        import shutil
        if hasattr(self, 'temp_dir') and self.temp_dir.exists():
            shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def parse_share_url(self, share_text: str) -> dict:
        """从分享文本中提取无水印视频链接"""
        # 提取分享链接
        urls = re.findall(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', share_text)
        if not urls:
            raise ValueError("未找到有效的分享链接")
        
        share_url = urls[0]
        share_response = requests.get(share_url, headers=HEADERS)
        video_id = share_response.url.split("?")[0].strip("/").split("/")[-1]
        share_url = f'https://www.iesdouyin.com/share/video/{video_id}'
        
        # 获取视频页面内容
        response = requests.get(share_url, headers=HEADERS)
        response.raise_for_status()
        
        pattern = re.compile(
            pattern=r"window\._ROUTER_DATA\s*=\s*(.*?)</script>",
            flags=re.DOTALL,
        )
        find_res = pattern.search(response.text)

        if not find_res or not find_res.group(1):
            raise ValueError("从HTML中解析视频信息失败")

        # 解析JSON数据
        json_data = json.loads(find_res.group(1).strip())
        VIDEO_ID_PAGE_KEY = "video_(id)/page"
        NOTE_ID_PAGE_KEY = "note_(id)/page"
        
        if VIDEO_ID_PAGE_KEY in json_data["loaderData"]:
            original_video_info = json_data["loaderData"][VIDEO_ID_PAGE_KEY]["videoInfoRes"]
        elif NOTE_ID_PAGE_KEY in json_data["loaderData"]:
            original_video_info = json_data["loaderData"][NOTE_ID_PAGE_KEY]["videoInfoRes"]
        else:
            raise Exception("无法从JSON中解析视频或图集信息")

        data = original_video_info["item_list"][0]

        # 获取视频信息
        video_url = data["video"]["play_addr"]["url_list"][0].replace("playwm", "play")
        desc = data.get("desc", "").strip() or f"douyin_{video_id}"
        
        # 替换文件名中的非法字符
        desc = re.sub(r'[\\/:*?"<>|]', '_', desc)
        
        return {
            "url": video_url,
            "title": desc,
            "video_id": video_id
        }
    
    # async def download_video(self, video_info: dict, ctx: Context) -> Path:
    #     """异步下载视频到临时目录"""
    #     filename = f"{video_info['video_id']}.mp4"
    #     filepath = self.temp_dir / filename
        
    #     ctx.info(f"正在下载视频: {video_info['title']}")
        
    #     response = requests.get(video_info['url'], headers=HEADERS, stream=True)
    #     response.raise_for_status()
        
    #     # 获取文件大小
    #     total_size = int(response.headers.get('content-length', 0))
        
    #     # 异步下载文件，显示进度
    #     with open(filepath, 'wb') as f:
    #         downloaded = 0
    #         for chunk in response.iter_content(chunk_size=8192):
    #             if chunk:
    #                 f.write(chunk)
    #                 downloaded += len(chunk)
    #                 if total_size > 0:
    #                     progress = downloaded / total_size
    #                     await ctx.report_progress(downloaded, total_size)
        
    #     ctx.info(f"视频下载完成: {filepath}")
    #     return filepath
    
    # def extract_audio(self, video_path: Path) -> Path:
    #     """从视频文件中提取音频"""
    #     audio_path = video_path.with_suffix('.mp3')
        
    #     try:
    #         (
    #             ffmpeg
    #             .input(str(video_path))
    #             .output(str(audio_path), acodec='libmp3lame', q=0)
    #             .run(capture_stdout=True, capture_stderr=True, overwrite_output=True)
    #         )
    #         return audio_path
    #     except Exception as e:
    #         raise Exception(f"提取音频时出错: {str(e)}")
    
    # def extract_text_from_video_url(self, video_url: str) -> str:
    #     """从视频URL中提取文字（使用阿里云百炼API）"""
    #     try:
    #         # 发起异步转录任务
    #         task_response = dashscope.audio.asr.Transcription.async_call(
    #             model=self.model,
    #             file_urls=[video_url],
    #             language_hints=['zh', 'en']
    #         )
            
    #         # 等待转录完成
    #         transcription_response = dashscope.audio.asr.Transcription.wait(
    #             task=task_response.output.task_id
    #         )
            
    #         if transcription_response.status_code == HTTPStatus.OK:
    #             # 获取转录结果
    #             for transcription in transcription_response.output['results']:
    #                 url = transcription['transcription_url']
    #                 result = json.loads(request.urlopen(url).read().decode('utf8'))
                    
    #                 # 保存结果到临时文件
    #                 temp_json_path = self.temp_dir / 'transcription.json'
    #                 with open(temp_json_path, 'w') as f:
    #                     json.dump(result, f, indent=4, ensure_ascii=False)
                    
    #                 # 提取文本内容
    #                 if 'transcripts' in result and len(result['transcripts']) > 0:
    #                     return result['transcripts'][0]['text']
    #                 else:
    #                     return "未识别到文本内容"
                        
    #         else:
    #             raise Exception(f"转录失败: {transcription_response.output.message}")
                
    #     except Exception as e:
    #         raise Exception(f"提取文字时出错: {str(e)}")
    
    # def cleanup_files(self, *file_paths: Path):
    #     """清理指定的文件"""
    #     for file_path in file_paths:
    #         if file_path.exists():
    #             file_path.unlink()


def get_douyin_download_link(share_link: str) -> str:
    """
    获取抖音视频的无水印下载链接
    
    参数:
    - share_link: 抖音分享链接或包含链接的文本
    
    返回:
    - 包含下载链接和视频信息的JSON字符串
    """
    try:
        processor = DouyinProcessor()  # 获取下载链接不需要API密钥
        video_info = processor.parse_share_url(share_link)
        
        return json.dumps({
            "status": "success",
            "video_id": video_info["video_id"],
            "title": video_info["title"],
            "download_url": video_info["url"],
            "description": f"视频标题: {video_info['title']}",
            "usage_tip": "可以直接使用此链接下载无水印视频"
        }, ensure_ascii=False, indent=2)
        
    except Exception as e:
        return json.dumps({
            "status": "error",
            "error": f"获取下载链接失败: {str(e)}"
        }, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    share_link = "4.89 复制打开抖音一根螺丝钉有多重？他是人体螺丝钉，重若千钧。# 电... https://v.douyin.com/nvb__rnepn8/ M@W.ZM 03/11 pQk:/"
    print(get_douyin_download_link(share_link))