const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');

module.exports = function(PORT) {

const app = express();
const POSTS_DIR = path.join(__dirname, '../../posts');

// Ensure posts directory exists
async function init() {
  try {
    await fs.mkdir(POSTS_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating posts directory:', err);
  }
}
init();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/views')));
app.use('/js', express.static(path.join(__dirname, '../client/js')));
app.use('/style', express.static(path.join(__dirname, '../client/style')));
app.use('/attachments', express.static(path.join(__dirname, '../../attachments')));

// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' });

// Helper: Parse custom .md format (JSON metadata on top, separated by "===")
function parsePostFile(filename, rawData) {
  const content = rawData.toString();
  const separator = '\n===\n';
  const sepIndex = content.indexOf(separator);
  
  if (sepIndex !== -1) {
    try {
      const metaStr = content.substring(0, sepIndex);
      const meta = JSON.parse(metaStr);
      return {
        ...meta,
        id: meta.id || filename.replace('.md', ''),
        content: content.substring(sepIndex + separator.length)
      };
    } catch (e) {
      // JSON parse failed, treat whole as content
    }
  }
  
  // Fallback for imported/plain .md files
  return {
    id: filename.replace('.md', ''),
    title: filename.replace('.md', ''),
    status: 'draft', // defaults to draft
    format: 'markdown',
    updatedAt: new Date().toISOString(),
    content: content
  };
}

// Helper: Serialize post to string
function serializePost(post) {
  const meta = {
    id: post.id,
    title: post.title,
    status: post.status,
    format: post.format,
    updatedAt: post.updatedAt
  };
  return JSON.stringify(meta, null, 2) + '\n===\n' + (post.content || '');
}

// API: Get all posts (metadata only, for sidebar)
app.get('/api/posts', async (req, res) => {
  try {
    const files = await fs.readdir(POSTS_DIR);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    
    const posts = [];
    for (const file of mdFiles) {
      const raw = await fs.readFile(path.join(POSTS_DIR, file), 'utf8');
      const post = parsePostFile(file, raw);
      // Remove content to save bandwidth for the list
      delete post.content;
      posts.push(post);
    }
    
    posts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get single post
app.get('/api/posts/:id', async (req, res) => {
  try {
    const filePath = path.join(POSTS_DIR, `${req.params.id}.md`);
    const raw = await fs.readFile(filePath, 'utf8');
    const post = parsePostFile(`${req.params.id}.md`, raw);
    res.json(post);
  } catch (err) {
    res.status(404).json({ error: 'Post not found' });
  }
});

// API: Create or update post
app.post('/api/posts', async (req, res) => {
  try {
    const post = req.body;
    if (!post.id) {
      post.id = Date.now().toString(); // simple ID generator
    }
    post.updatedAt = new Date().toISOString();
    
    const filePath = path.join(POSTS_DIR, `${post.id}.md`);
    const fileContent = serializePost(post);
    await fs.writeFile(filePath, fileContent, 'utf8');
    
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/posts/:id', async (req, res) => {
  try {
    const post = req.body;
    post.id = req.params.id; // ensure ID matches
    post.updatedAt = new Date().toISOString();
    
    const filePath = path.join(POSTS_DIR, `${post.id}.md`);
    const fileContent = serializePost(post);
    await fs.writeFile(filePath, fileContent, 'utf8');
    
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Delete post
app.delete('/api/posts/:id', async (req, res) => {
  try {
    const filePath = path.join(POSTS_DIR, `${req.params.id}.md`);
    await fs.unlink(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Import .md file
app.post('/api/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const raw = await fs.readFile(req.file.path, 'utf8');
    // We clean up the uploaded temp file
    await fs.unlink(req.file.path);
    
    // Generate an ID based on filename (removing .md)
    let baseName = req.file.originalname.replace(/\.md$/i, '');
    let newId = baseName.replace(/[^a-z0-9]/gi, '-').toLowerCase() || Date.now().toString();
    
    // Check if ID exists, append timestamp if so
    try {
      await fs.access(path.join(POSTS_DIR, `${newId}.md`));
      newId = `${newId}-${Date.now()}`;
    } catch (e) {
      // File doesn't exist, which is good
    }
    
    const post = parsePostFile(`${newId}.md`, raw);
    post.id = newId;
    post.title = baseName;
    
    const filePath = path.join(POSTS_DIR, `${post.id}.md`);
    await fs.writeFile(filePath, serializePost(post), 'utf8');
    
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Export .md file
app.get('/api/export/:id', async (req, res) => {
  try {
    const filePath = path.join(POSTS_DIR, `${req.params.id}.md`);
    const raw = await fs.readFile(filePath, 'utf8');
    
    // We should probably strip the JSON metadata for a clean export, 
    // or keep it so they can re-import it perfectly. 
    // Usually users want clean markdown. Let's send clean markdown.
    const post = parsePostFile(`${req.params.id}.md`, raw);
    
    res.setHeader('Content-Disposition', `attachment; filename="${post.title || post.id}.md"`);
    res.setHeader('Content-Type', 'text/markdown');
    res.send(post.content);
  } catch (err) {
    res.status(404).json({ error: 'Post not found' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

};
