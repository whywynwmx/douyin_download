# Agent Instructions for Douyin Downloader (React Version)

This document provides instructions for AI agents working on this project, which now uses a React frontend.

## Project Structure

The project is divided into three main parts:

1.  **`go/`**: The Go backend application.
    -   `main.go`: The main application logic, which includes an HTTP server.
    -   This backend exposes an API to analyze Douyin URLs.

2.  **`python/`**: A Python script for downloading (ancillary).

3.  **`web/`**: The React-based web frontend.
    -   **`package.json`**: Defines project scripts and dependencies.
    -   **`vite.config.js`**: Configuration for the Vite build tool.
    -   **`index.html`**: The HTML entry point for the React app.
    -   **`src/`**: Contains all the React source code.
        -   `main.jsx`: The main entry point that renders the `App` component.
        -   `App.jsx`: The root component, responsible for the main layout.
        -   `components/`: A directory for reusable React components.
            -   `Downloader.jsx`: The core UI component for input, analysis, and displaying results.
            -   `Spinner.jsx`: A loading indicator component.

## Web Frontend Development (`web/`)

### Core Principles

-   **Component-Based Architecture**: All UI and logic are encapsulated within components.
-   **State Management**: Use React hooks (`useState`, `useEffect`) for managing component state (e.g., loading, error, API results).
-   **Styling**: CSS modules or standard CSS files (`Component.css`) are used for styling. The design should be modern and responsive.

### API Interaction

The API call logic is primarily located in `src/components/Downloader.jsx`.

-   **Backend URL**: `http://localhost:8080`
-   **API Endpoint**: `/api/analyze`
-   **Method**: `POST`
-   **Request Body (JSON)**:
    ```json
    {
      "url": "<douyin_share_link>"
    }
    ```
-   **Response Body (JSON)**:
    ```json
    {
      "title": "Video Title",
      "description": "Video Description",
      "video_url": "<direct_video_url>"
    }
    ```

### Development Workflow

1.  Navigate to the `web` directory.
2.  Run `npm install` to get all dependencies.
3.  Run `npm run dev` to start the Vite development server.
4.  Modify components in the `src` directory. Vite's Hot Module Replacement (HMR) will automatically update the view in the browser.