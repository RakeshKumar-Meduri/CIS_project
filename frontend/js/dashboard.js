document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  const username = localStorage.getItem('username');
  if (username) {
    document.getElementById('user-greeting').textContent = `- ${username}`;
  }

  // DOM Elements
  const fileInput = document.getElementById('file-input');
  const btnUpload = document.getElementById('btn-upload');
  const fileList = document.getElementById('file-list');
  const btnLogout = document.getElementById('btn-logout');
  const shareModal = document.getElementById('share-modal');
  const shareLinkInput = document.getElementById('share-link-input');
  const btnCopyLink = document.getElementById('btn-copy-link');
  const btnCloseModal = document.getElementById('btn-close-modal');

  // Format Bytes
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Render File
  const renderFileCard = (file) => {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.innerHTML = `
      <div class="file-icon">📄</div>
      <div class="file-name" title="${file.originalName}">${file.originalName}</div>
      <div class="file-meta">
        ${formatBytes(file.size)} <br>
        ${new Date(file.createdAt).toLocaleDateString()}
      </div>
      <div class="file-actions">
        <a href="${API_URL}/files/${file._id}/download" target="_blank" class="btn-secondary" style="background:var(--primary-color);color:white;border:none;">Preview/DL</a>
        <button class="btn-secondary btn-share" data-id="${file._id}">Share</button>
        <button class="btn-danger btn-delete" data-id="${file._id}">Delete</button>
      </div>
    `;
    fileList.prepend(card); // Add to top
  };

  // Load Files
  const loadFiles = async () => {
    try {
      const files = await fetchAPI('/files');
      fileList.innerHTML = '';
      if (files.length === 0) {
        fileList.innerHTML = '<p style="color:var(--text-secondary);grid-column:1/-1;text-align:center;">No files found. Upload something to get started!</p>';
        return;
      }
      files.reverse().forEach(file => renderFileCard(file));
    } catch (err) {
      if (err.message.includes('Token is not valid')) {
        localStorage.clear();
        window.location.href = 'index.html';
      }
      showAlert(err.message, 'error');
    }
  };

  // Upload Logic
  btnUpload.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) {
      showAlert('Please select a file to upload.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const prevText = btnUpload.textContent;
    btnUpload.textContent = 'Uploading...';
    btnUpload.disabled = true;

    try {
      const newFile = await fetchAPI('/files/upload', {
        method: 'POST',
        body: formData,
      });

      showAlert('File uploaded successfully!', 'success');
      
      const emptyState = fileList.querySelector('p');
      if(emptyState) {
          emptyState.remove();
      }
      renderFileCard(newFile);
      fileInput.value = '';
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      btnUpload.textContent = prevText;
      btnUpload.disabled = false;
    }
  });

  // Share and Delete Logic
  fileList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-share')) {
      const fileId = e.target.getAttribute('data-id');
      try {
        const data = await fetchAPI(`/files/${fileId}/share`);
        shareLinkInput.value = data.shareLink;
        shareModal.classList.remove('hidden');
      } catch (err) {
        showAlert(err.message, 'error');
      }
    }

    if (e.target.classList.contains('btn-delete')) {
      const fileId = e.target.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this file?')) {
        try {
          e.target.disabled = true;
          e.target.textContent = 'Deleting...';
          
          await fetchAPI(`/files/${fileId}`, {
            method: 'DELETE'
          });
          
          showAlert('File deleted successfully', 'success');
          e.target.closest('.file-card').remove();
          
          if (fileList.children.length === 0) {
            fileList.innerHTML = '<p style="color:var(--text-secondary);grid-column:1/-1;text-align:center;">No files found. Upload something to get started!</p>';
          }
        } catch (err) {
          e.target.disabled = false;
          e.target.textContent = 'Delete';
          showAlert(err.message, 'error');
        }
      }
    }
  });

  // Modal logic
  btnCloseModal.addEventListener('click', () => {
    shareModal.classList.add('hidden');
  });

  btnCopyLink.addEventListener('click', () => {
    shareLinkInput.select();
    document.execCommand('copy');
    btnCopyLink.textContent = 'Copied!';
    setTimeout(() => {
      btnCopyLink.textContent = 'Copy';
    }, 2000);
  });

  // Logout
  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = 'index.html';
  });

  // Initial load
  loadFiles();
});
