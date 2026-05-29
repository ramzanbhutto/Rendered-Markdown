/* ---- API Service ---- */
class ApiService {
  async getPosts() {
    const res = await fetch('/api/posts');
    return res.json();
  }

  async getPost(id) {
    const res = await fetch(`/api/posts/${id}`);
    if (!res.ok) throw new Error('Post not found');
    return res.json();
  }

  async createPost(data) {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }

  async updatePost(id, data) {
    const res = await fetch(`/api/posts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }

  async deletePost(id) {
    await fetch(`/api/posts/${id}`, { method: 'DELETE' });
  }

  async importFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/import', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  }
}

/* ---- UI Layer: BlogApp ---- */
class BlogApp {
  constructor() {
    this.api = new ApiService();
    this.posts = [];
    this.currentPostId = null;
    this.autoSaveTimer = null;
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.previewVisible = true;
    this.isDirty = false;
    this.ACTIVE_KEY = 'inkwell_active_post_id';

    this.cacheElements();
    this.configureMarked();
    this.bindEvents();
    this.init();
  }

  async init() {
    await this.fetchPosts();
    const activeId = localStorage.getItem(this.ACTIVE_KEY);
    if (activeId && this.posts.find(p => p.id === activeId)) {
      await this.selectPost(activeId);
    } else if (this.posts.length > 0) {
      await this.selectPost(this.posts[0].id);
    } else {
      this.showEmptyState();
    }
  }

  async fetchPosts() {
    try {
      this.posts = await this.api.getPosts();
      this.renderPostList();
    } catch (e) {
      this.toast('Failed to load posts', 'error');
    }
  }

  /* ---- Element Cache ---- */
  cacheElements() {
    this.els = {
      sidebar: document.getElementById('sidebar'),
      sidebarOverlay: document.getElementById('sidebar-overlay'),
      postList: document.getElementById('post-list'),
      postCount: document.getElementById('post-count'),
      searchInput: document.getElementById('search-input'),
      filterBtns: document.querySelectorAll('.filter-btn'),
      btnNewPost: document.getElementById('btn-new-post'),
      btnEmptyNew: document.getElementById('btn-empty-new'),
      btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
      btnPreviewToggle: document.getElementById('btn-preview-toggle'),
      btnPublish: document.getElementById('btn-publish'),
      btnImport: document.getElementById('btn-import-post'),
      fileImport: document.getElementById('file-import'),
      btnExport: document.getElementById('btn-export-post'),
      topbar: document.getElementById('topbar'),
      statusBadge: document.getElementById('post-status-badge'),
      autoSaveIndicator: document.getElementById('auto-save-indicator'),
      formatBtns: document.querySelectorAll('.format-btn'),
      editorArea: document.getElementById('editor-area'),
      editorPanel: document.getElementById('editor-panel'),
      previewPanel: document.getElementById('preview-panel'),
      panelDivider: document.getElementById('panel-divider'),
      titleInput: document.getElementById('post-title'),
      contentInput: document.getElementById('post-content'),
      previewContent: document.getElementById('preview-content'),
      wordCount: document.getElementById('word-count'),
      charCount: document.getElementById('char-count'),
      readTime: document.getElementById('read-time'),
      emptyState: document.getElementById('empty-state'),
      deleteDialog: document.getElementById('delete-dialog'),
      deleteMessage: document.getElementById('delete-dialog-message'),
      btnCancelDelete: document.getElementById('btn-cancel-delete'),
      btnConfirmDelete: document.getElementById('btn-confirm-delete'),
      toastContainer: document.getElementById('toast-container'),
    };
  }

  /* ---- Configure Marked.js ---- */
  configureMarked() {
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: true,
        gfm: true,
        highlight: (code, lang) => {
          if (typeof hljs !== 'undefined') {
            if (lang && hljs.getLanguage(lang)) {
              try { return hljs.highlight(code, { language: lang }).value; } catch {}
            }
            try { return hljs.highlightAuto(code).value; } catch {}
          }
          return code;
        },
      });
    }
  }

  /* ---- Event Binding ---- */
  bindEvents() {
    // New post
    this.els.btnNewPost.addEventListener('click', () => this.createNewPost());
    this.els.btnEmptyNew.addEventListener('click', () => this.createNewPost());

    // Save, publish
    this.els.btnPublish.addEventListener('click', () => this.togglePublish());

    // Import / Export
    this.els.btnImport.addEventListener('click', () => this.els.fileImport.click());
    this.els.fileImport.addEventListener('change', (e) => this.handleImport(e));
    this.els.btnExport.addEventListener('click', () => this.handleExport());

    // Sidebar toggle
    this.els.btnToggleSidebar.addEventListener('click', () => this.toggleSidebar());
    this.els.sidebarOverlay.addEventListener('click', () => this.closeSidebar());

    // Preview toggle
    this.els.btnPreviewToggle.addEventListener('click', () => this.togglePreview());

    // Search
    this.els.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderPostList();
    });

    // Filters
    this.els.filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.els.filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.renderPostList();
      });
    });

    // Format toggle
    this.els.formatBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        this.els.formatBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (this.currentPostId) {
          const post = this.posts.find(p => p.id === this.currentPostId);
          if (post) {
            post.format = btn.dataset.format;
            await this.api.updatePost(this.currentPostId, post);
            this.updatePreview();
          }
        }
      });
    });

    // Editor input
    this.els.titleInput.addEventListener('input', () => this.onEditorChange());
    this.els.contentInput.addEventListener('input', () => {
      this.onEditorChange();
      this.updateCounts();
    });

    // Tab key
    this.els.contentInput.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.target;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = start + 2;
        this.onEditorChange();
      }
    });

    // Delete dialog
    this.els.btnCancelDelete.addEventListener('click', () => {
      this.els.deleteDialog.close();
      this.postToDeleteId = null;
    });
    this.els.btnConfirmDelete.addEventListener('click', () => this.confirmDelete());

    // Global click for dropdowns
    document.addEventListener('click', (e) => {
      // Close all dropdowns
      if (!e.target.closest('.card-menu-btn')) {
        document.querySelectorAll('.card-menu-dropdown').forEach(d => d.classList.remove('show'));
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && e.key === 's') {
        e.preventDefault();
        this.saveCurrentPost(true);
      } else if (isMod && e.key === 'Enter') {
        e.preventDefault();
        this.togglePublish();
      } else if (isMod && e.key === 'n') {
        e.preventDefault();
        this.createNewPost();
      }
    });

    // Divider drag
    this.initDividerDrag();
  }

  initDividerDrag() {
    const divider = this.els.panelDivider;
    let startX, startY, startEditorWidth, startEditorHeight;

    const onMouseMove = (e) => {
      if (window.innerWidth <= 900) {
        // Vertical layout
        const dy = e.clientY - startY;
        const newHeight = startEditorHeight + dy;
        const areaHeight = this.els.editorArea.offsetHeight;
        const minH = 150;
        const maxH = areaHeight - 150;
        const clamped = Math.max(minH, Math.min(maxH, newHeight));
        this.els.editorPanel.style.flex = 'none';
        this.els.editorPanel.style.height = clamped + 'px';
        this.els.editorPanel.style.width = '100%';
        this.els.previewPanel.style.flex = '1';
      } else {
        // Horizontal layout
        const dx = e.clientX - startX;
        const newWidth = startEditorWidth + dx;
        const areaWidth = this.els.editorArea.offsetWidth;
        const minW = 280;
        const maxW = areaWidth - 280;
        const clamped = Math.max(minW, Math.min(maxW, newWidth));
        this.els.editorPanel.style.flex = 'none';
        this.els.editorPanel.style.width = clamped + 'px';
        this.els.editorPanel.style.height = '';
        this.els.previewPanel.style.flex = '1';
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    divider.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startY = e.clientY;
      startEditorWidth = this.els.editorPanel.offsetWidth;
      startEditorHeight = this.els.editorPanel.offsetHeight;
      document.body.style.cursor = window.innerWidth <= 900 ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  /* ---- Import / Export ---- */
  async handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const post = await this.api.importFile(file);
      this.toast('File imported successfully', 'success');
      await this.fetchPosts();
      await this.selectPost(post.id);
    } catch (err) {
      this.toast('Failed to import file', 'error');
    }
    e.target.value = ''; // reset
  }

  handleExport() {
    if (!this.currentPostId) return;
    window.location.href = `/api/export/${this.currentPostId}`;
  }

  /* ---- Post List Rendering ---- */
  renderPostList() {
    let filtered = this.posts;
    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(p => p.status === this.currentFilter);
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        (p.title && p.title.toLowerCase().includes(q))
      );
    }

    const container = this.els.postList;
    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:32px 16px; color:var(--text-muted); font-size:0.85rem;">
          ${this.searchQuery || this.currentFilter !== 'all'
            ? 'No matching posts found.'
            : 'No posts yet.'}
        </div>`;
    } else {
      container.innerHTML = filtered.map(post => this.renderPostCard(post)).join('');
      container.querySelectorAll('.post-card').forEach(card => {
        card.addEventListener('click', () => this.selectPost(card.dataset.id));
      });
    }

    this.els.postCount.textContent = `${filtered.length} posts`;
  }

  renderPostCard(post) {
    const isActive = post.id === this.currentPostId;
    const title = post.title || 'Untitled';
    const date = new Date(post.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `
      <div class="post-card ${isActive ? 'active' : ''}" data-id="${post.id}">
        <div class="post-card-header">
          <span class="post-card-status ${post.status}">${post.status}</span>
          <div class="post-card-actions">
            <span class="post-card-date">${date}</span>
            <div style="position:relative">
              <button class="card-menu-btn" onclick="event.stopPropagation(); this.nextElementSibling.classList.toggle('show')">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
              </button>
              <div class="card-menu-dropdown">
                <button class="card-menu-item" onclick="event.stopPropagation(); window.inkwell.promptDelete('${post.id}')">Delete Post</button>
              </div>
            </div>
          </div>
        </div>
        <h3 class="post-card-title">${this.escapeHtml(title)}</h3>
      </div>`;
  }

  /* ---- Post Selection ---- */
  async selectPost(id) {
    if (this.currentPostId && this.isDirty) {
      await this.silentSave();
    }

    try {
      const fullPost = await this.api.getPost(id);
      
      this.currentPostId = id;
      this.isDirty = false;
      localStorage.setItem(this.ACTIVE_KEY, id);

      this.els.editorArea.style.display = 'flex';
      this.els.emptyState.style.display = 'none';
      this.els.topbar.style.visibility = 'visible';

      this.els.titleInput.value = fullPost.title || '';
      this.els.contentInput.value = fullPost.content || '';

      this.els.formatBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.format === fullPost.format);
      });

      this.updateStatusUI(fullPost.status);
      this.hideAutoSaveIndicator();
      this.updatePreview();
      this.updateCounts();
      this.renderPostList();

    } catch (e) {
      this.toast('Failed to load post', 'error');
      this.showEmptyState();
    }
  }

  showEmptyState() {
    this.currentPostId = null;
    localStorage.removeItem(this.ACTIVE_KEY);
    this.els.editorArea.style.display = 'none';
    this.els.emptyState.style.display = 'flex';
    this.els.topbar.style.visibility = 'hidden';
  }

  /* ---- Editor Change Handler ---- */
  onEditorChange() {
    this.isDirty = true;
    this.updatePreview();
    this.scheduleAutoSave();
  }

  /* ---- Save / Auto-Save ---- */
  scheduleAutoSave() {
    this.showAutoSaveIndicator('Saving…');
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.silentSave();
      this.showAutoSaveIndicator('Saved');
      setTimeout(() => this.hideAutoSaveIndicator(), 2000);
    }, 2000);
  }

  async silentSave() {
    if (!this.currentPostId) return;
    const post = this.posts.find(p => p.id === this.currentPostId);
    if (!post) return;

    post.title = this.els.titleInput.value;
    post.content = this.els.contentInput.value;
    
    try {
      await this.api.updatePost(this.currentPostId, post);
      this.isDirty = false;
      this.renderPostList(); // updates title in sidebar
    } catch (e) {
      this.toast('Auto-save failed', 'error');
    }
  }

  async saveCurrentPost(manual = false) {
    if (!this.currentPostId) return;
    await this.silentSave();
    if (manual) {
      this.showAutoSaveIndicator('Saved');
      setTimeout(() => this.hideAutoSaveIndicator(), 2500);
      this.toast('Saved successfully', 'success');
    }
  }

  /* ---- Create New Post ---- */
  async createNewPost() {
    if (this.currentPostId && this.isDirty) {
      await this.silentSave();
    }
    try {
      const post = await this.api.createPost({ title: '', content: '', format: 'markdown', status: 'draft' });
      await this.fetchPosts();
      await this.selectPost(post.id);
      this.toast('New draft created', 'success');
      this.els.titleInput.focus();
    } catch (e) {
      this.toast('Failed to create post', 'error');
    }
  }

  /* ---- Publish / Unpublish ---- */
  async togglePublish() {
    if (!this.currentPostId) return;
    const post = this.posts.find(p => p.id === this.currentPostId);
    if (!post) return;

    // save latest content
    post.title = this.els.titleInput.value;
    post.content = this.els.contentInput.value;
    
    const newStatus = post.status === 'published' ? 'draft' : 'published';
    post.status = newStatus;
    
    try {
      await this.api.updatePost(this.currentPostId, post);
      this.isDirty = false;
      this.updateStatusUI(newStatus);
      this.renderPostList();
      
      this.toast(newStatus === 'published' ? 'Post published successfully' : 'Moved to drafts', 'success');
    } catch (e) {
      this.toast('Failed to update status', 'error');
    }
  }

  /* ---- Delete ---- */
  promptDelete(id) {
    this.postToDeleteId = id;
    const post = this.posts.find(p => p.id === id);
    if (post) {
      this.els.deleteMessage.textContent = `"${post.title || 'Untitled'}" will be permanently deleted.`;
    }
    document.querySelectorAll('.card-menu-dropdown').forEach(d => d.classList.remove('show'));
    this.els.deleteDialog.showModal();
  }

  async confirmDelete() {
    if (!this.postToDeleteId) return;
    try {
      await this.api.deletePost(this.postToDeleteId);
      this.els.deleteDialog.close();
      this.toast('Post deleted', 'info');
      await this.fetchPosts();
      
      // If we deleted the currently active post, select another one
      if (this.currentPostId === this.postToDeleteId) {
        if (this.posts.length > 0) {
          await this.selectPost(this.posts[0].id);
        } else {
          this.showEmptyState();
        }
      }
      this.postToDeleteId = null;
    } catch (e) {
      this.toast('Failed to delete post', 'error');
    }
  }

  /* ---- UI Helpers ---- */
  updateStatusUI(status) {
    this.els.statusBadge.className = `status-badge ${status}`;
    this.els.statusBadge.textContent = status === 'published' ? 'Published' : 'Draft';

    const btnPublish = this.els.btnPublish;
    if (status === 'published') {
      btnPublish.innerHTML = `
        <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        <span>Unpublish</span>`;
      btnPublish.classList.remove('btn-primary');
      btnPublish.classList.add('btn-outline');
    } else {
      btnPublish.innerHTML = `
        <svg viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/></svg>
        <span>Publish</span>`;
      btnPublish.classList.remove('btn-outline');
      btnPublish.classList.add('btn-primary');
    }
  }

  showAutoSaveIndicator(text) {
    this.els.autoSaveIndicator.textContent = text;
    this.els.autoSaveIndicator.classList.add('visible');
  }

  hideAutoSaveIndicator() {
    this.els.autoSaveIndicator.classList.remove('visible');
  }

  /* ---- Preview & Counts ---- */
  updatePreview() {
    const content = this.els.contentInput.value;
    const post = this.posts.find(p => p.id === this.currentPostId);
    const format = post ? post.format : 'markdown';

    if (!content.trim()) {
      this.els.previewContent.innerHTML = '<p class="preview-placeholder">Start writing to see the preview…</p>';
      return;
    }

    if (format === 'markdown' && typeof marked !== 'undefined') {
      this.els.previewContent.innerHTML = marked.parse(content);
      if (typeof hljs !== 'undefined') {
        this.els.previewContent.querySelectorAll('pre code:not(.hljs)').forEach(block => {
          hljs.highlightElement(block);
        });
      }
    } else {
      this.els.previewContent.innerHTML = `<div style="white-space:pre-wrap;font-family:var(--font-sans);line-height:1.7">${this.escapeHtml(content)}</div>`;
    }
  }

  updateCounts() {
    const text = this.els.contentInput.value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const readMin = Math.max(1, Math.ceil(words / 200));

    this.els.wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
    this.els.charCount.textContent = `${chars} char${chars !== 1 ? 's' : ''}`;
    this.els.readTime.textContent = `${readMin} min read`;
  }

  togglePreview() {
    this.previewVisible = !this.previewVisible;
    this.els.previewPanel.classList.toggle('hidden', !this.previewVisible);
    this.els.panelDivider.classList.toggle('hidden', !this.previewVisible);
    
    if (this.previewVisible) {
      this.els.editorPanel.style.flex = '1';
      this.els.editorPanel.style.width = '';
      this.els.editorPanel.style.height = '';
    }
  }

  toggleSidebar() {
    this.els.sidebar.classList.toggle('open');
    this.els.sidebarOverlay.classList.toggle('visible');
  }

  closeSidebar() {
    this.els.sidebar.classList.remove('open');
    this.els.sidebarOverlay.classList.remove('visible');
  }

  toast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${this.escapeHtml(message)}</span>`;
    
    this.els.toastContainer.appendChild(toast);
    
    // Force reflow for animation
    void toast.offsetWidth;

    setTimeout(() => {
      toast.classList.add('removing');
      // Fix for toasts not disappearing properly: Listen to transitionend, or just remove after a fixed time.
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300); // 300ms matches transition time in CSS
    }, 3000);
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

/* ---- Initialize ---- */
document.addEventListener('DOMContentLoaded', () => {
  window.inkwell = new BlogApp();
});
