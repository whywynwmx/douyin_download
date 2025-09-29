package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// Headers to simulate a mobile browser
var headers = map[string]string{
	"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/121.0.2277.107 Version/17.0 Mobile/15E148 Safari/604.1",
}

// Structs for parsing the JSON from the script tag
type RouterData struct {
	LoaderData map[string]PageData `json:"loaderData"`
}

type PageData struct {
	VideoInfoRes VideoInfoRes `json:"videoInfoRes"`
}

type VideoInfoRes struct {
	ItemList []Item `json:"item_list"`
}

type Item struct {
	Desc  string `json:"desc"`
	Video Video  `json:"video"`
}

type Video struct {
	PlayAddr PlayAddr `json:"play_addr"`
}

type PlayAddr struct {
	URLList []string `json:"url_list"`
}

// Request body for the API
type ShareLinkRequest struct {
	ShareLink string `json:"share_link"`
}

// getDouyinDownloadLink contains the core logic to get the download link
func getDouyinDownloadLink(shareText string) (map[string]string, error) {
	// 1. Extract the short URL from the share text
	re := regexp.MustCompile(`http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*(),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+`)
	shortURL := re.FindString(shareText)
	if shortURL == "" {
		return nil, fmt.Errorf("no valid share URL found in the text")
	}

	// 2. Make a request to the short URL to get the redirect URL
	client := &http.Client{
		// Do not follow redirects automatically, so we can capture the location header
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	req, _ := http.NewRequest("GET", shortURL, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to request short URL: %w", err)
	}
	defer resp.Body.Close()

	redirectURL := resp.Header.Get("Location")
	if redirectURL == "" {
		return nil, fmt.Errorf("could not find redirect location")
	}

	// 3. Get the video ID from the redirect URL
	urlParts := strings.Split(strings.Split(redirectURL, "?")[0], "/")
	videoID := urlParts[len(urlParts)-1]
	if videoID == "" {
		// Fallback for different URL structures
		reVideoID := regexp.MustCompile(`/video/(\d+)`)
		matches := reVideoID.FindStringSubmatch(redirectURL)
		if len(matches) > 1 {
			videoID = matches[1]
		} else {
			return nil, fmt.Errorf("could not extract video ID from URL: %s", redirectURL)
		}
	}

	// 4. Make a request to the final URL to get the page HTML
	pageURL := fmt.Sprintf("https://www.iesdouyin.com/share/video/%s", videoID)
	req, _ = http.NewRequest("GET", pageURL, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to request page URL: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read page content: %w", err)
	}

	// 5. Find the _ROUTER_DATA_ JSON object in the HTML
	reJSON := regexp.MustCompile(`window\._ROUTER_DATA\s*=\s*(.*?)</script>`)
	jsonMatch := reJSON.FindSubmatch(body)
	if len(jsonMatch) < 2 {
		return nil, fmt.Errorf("could not find _ROUTER_DATA_ in HTML")
	}

	// 6. Parse the JSON
	var routerData RouterData
	// The JSON might be nested inside another object, so we try to find the start
	jsonStr := string(jsonMatch[1])
	if idx := strings.Index(jsonStr, "{\"app\":"); idx != -1 {
		jsonStr = jsonStr[idx:]
	}

	if err := json.Unmarshal([]byte(jsonStr), &routerData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON: %w", err)
	}

	// 7. Extract the video info from the parsed data
	var originalVideoInfo VideoInfoRes
	found := false
	for _, pageData := range routerData.LoaderData {
		if len(pageData.VideoInfoRes.ItemList) > 0 {
			originalVideoInfo = pageData.VideoInfoRes
			found = true
			break
		}
	}

	if !found || len(originalVideoInfo.ItemList) == 0 {
		return nil, fmt.Errorf("could not parse video information from JSON data")
	}

	item := originalVideoInfo.ItemList[0]
	if len(item.Video.PlayAddr.URLList) == 0 {
		return nil, fmt.Errorf("no video URL found in the parsed data")
	}

	// 8. Construct the no-watermark URL and get the title
	videoURL := strings.Replace(item.Video.PlayAddr.URLList[0], "playwm", "play", 1)
	title := item.Desc
	if title == "" {
		title = fmt.Sprintf("douyin_%s", videoID)
	}

	// Clean title
	reInvalidChars := regexp.MustCompile(`[\/:*?"<>|]`) // Corrected escaping for "
	title = reInvalidChars.ReplaceAllString(title, "_")

	return map[string]string{
		"url":      videoURL,
		"title":    title,
		"video_id": videoID,
	}, nil
}

func main() {
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Range"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           86400,
	}))

	r.POST("/api/v1/douyin", func(c *gin.Context) {
		var req ShareLinkRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
		}

		videoInfo, err := getDouyinDownloadLink(req.ShareLink)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status": "error",
				"error":  err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":       "success",
			"video_id":     videoInfo["video_id"],
			"title":        videoInfo["title"],
			"download_url": videoInfo["url"],
		})
	})

	// Video proxy endpoint to handle 403 issues
	r.GET("/api/v1/douyin/proxy", func(c *gin.Context) {
		videoURL := c.Query("url")
		if videoURL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Missing URL parameter"})
			return
		}

		// Create request to the video URL with appropriate headers
		req, err := http.NewRequest("GET", videoURL, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
			return
		}

		// Set headers to simulate mobile browser
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		req.Header.Set("Referer", "https://www.douyin.com/")
		req.Header.Set("Origin", "https://www.douyin.com")
		req.Header.Set("Accept", "*/*")
		req.Header.Set("Range", c.GetHeader("Range"))

		// Make the request
		client := &http.Client{CheckRedirect: func(req *http.Request, via []*http.Request) error {
			// Allow redirects and copy headers
			for k, v := range via[0].Header {
				req.Header[k] = v
			}
			return nil
		}}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch video"})
			return
		}
		defer resp.Body.Close()

		// Set CORS headers
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Range")

		// Copy essential headers from the response
		c.Header("Content-Type", resp.Header.Get("Content-Type"))
		c.Header("Content-Length", resp.Header.Get("Content-Length"))
		c.Header("Accept-Ranges", resp.Header.Get("Accept-Ranges"))
		c.Header("Content-Range", resp.Header.Get("Content-Range"))
		c.Header("Cache-Control", "public, max-age=3600")

		// Stream the video content
		c.Status(resp.StatusCode)
		io.Copy(c.Writer, resp.Body)
	})

	fmt.Println("Server is running on http://localhost:8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
