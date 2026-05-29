# Rendered Markdown Blog Editor

A lightweight, offline blog editor with real-time markdown preview.

## Why I Built This

I built this application because I needed a way to write blog posts reliably when I have no internet connection. I found myself relying on external packages and online tools just to preview how my markdown files would look. 

This editor solves that problem. It runs entirely on your local machine and provides a real-time preview of your text while you type. You get immediate, quick results without relying on an active internet connection or complicated external dependencies.

## Features

- **Offline First**: Runs completely on your local machine using a lightweight Node.js server.
- **Real-Time Preview**: Instantly see your markdown or plain text rendered exactly as you type.
- **File-Based Storage**: No complicated databases. All posts are saved directly to your disk as standard `.md` files.
- **Auto-Save**: Focus on writing; the application automatically saves your progress.
- **Import and Export**: Easily upload existing `.md` files to edit them, and download your drafts locally.
- **Public Blog View**: A clean, distraction-free reading interface for all posts you mark as published.

## Attachments

Place your images, GIFs and videos inside the `attachments/` folder at the project root.
Then reference them in your markdown like this:

> ![image name](/attachments/filename.jpg)

## How to Run This Project

You need to have Node.js installed on your computer to run this application.

1. Open your terminal.
2. Navigate to the project directory:
```bash
   cd Rendered-Markdown
```
3. Install the required dependencies:
```bash
   npm install
```
4. Start the server:
```bash
   node index.js
```
5. Open your web browser and go to:
   `http://localhost:3000`

To view your published posts, navigate to `http://localhost:3000/blog.html`

> **Note:** The server runs on port `3000` by default. To change it, update line 1 of `index.js` to any port that is not already in use.


## Folder Structure

- `index.js` - Entry point, starts the server.
- `src/server/server.js` - The local Node.js backend.
- `src/client/js/app.js` - Frontend logic for the editor.
- `src/client/style/index.css` - Styling for the application.
- `src/client/views/index.html` - Main editor interface.
- `src/client/views/blog.html` - Public reading view interface.
- `posts/` - Directory where all your markdown blog files are saved.
- `uploads/` - Temporary directory used when importing files.
- `attachments/` - Pictures, gifs and all other attachments that you will use in the blogs.
