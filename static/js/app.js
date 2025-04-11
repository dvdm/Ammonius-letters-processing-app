// JavaScript for the Latin Processing Web Application

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const selectedFiles = document.getElementById('selected-files');
    const processBtn = document.getElementById('process-btn');
    const processingStatus = document.getElementById('processing-status');
    const statusMessage = document.getElementById('status-message');
    const progressBar = document.querySelector('.progress-bar');
    const resultsContainer = document.getElementById('results-container');
    const resultsList = document.getElementById('results-list');
    
    // Global variables
    let currentTaskId = null;
    let statusCheckInterval = null;
    
    // Handle file selection via click
    if (dropZone) {
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Handle drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('active');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('active');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('active');
            
            if (e.dataTransfer.files.length > 0) {
                handleFiles(e.dataTransfer.files);
            }
        });
    }
    
    // Handle file input change
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleFiles(fileInput.files);
            }
        });
    }
    
    // Process button click
    if (processBtn) {
        processBtn.addEventListener('click', () => {
            uploadAndProcessFiles();
        });
    }
    
    // Handle selected files
    function handleFiles(files) {
        selectedFiles.innerHTML = '';
        let validFiles = 0;
        let invalidFiles = 0;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Check if file is a DOCX
            if (file.name.endsWith('.docx')) {
                validFiles++;
                
                // Create file item
                const fileItem = document.createElement('div');
                fileItem.className = 'alert alert-primary d-flex justify-content-between align-items-center';
                fileItem.innerHTML = `
                    <span>${file.name} (${formatFileSize(file.size)})</span>
                    <button type="button" class="btn-close" aria-label="Remove"></button>
                `;
                
                // Add remove functionality
                const removeBtn = fileItem.querySelector('.btn-close');
                removeBtn.addEventListener('click', () => {
                    fileItem.remove();
                    updateProcessButton();
                });
                
                selectedFiles.appendChild(fileItem);
            } else {
                invalidFiles++;
            }
        }
        
        // Show warning for invalid files
        if (invalidFiles > 0) {
            const warningItem = document.createElement('div');
            warningItem.className = 'alert alert-warning mt-2';
            warningItem.textContent = `${invalidFiles} file(s) were skipped. Only DOCX files are supported.`;
            selectedFiles.appendChild(warningItem);
        }
        
        updateProcessButton();
    }
    
    // Update process button state
    function updateProcessButton() {
        const fileItems = selectedFiles.querySelectorAll('.alert-primary');
        processBtn.disabled = fileItems.length === 0;
    }
    
    // Format file size
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' bytes';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
    }
    
    // Upload and process files
    function uploadAndProcessFiles() {
        // Get selected files
        const fileItems = selectedFiles.querySelectorAll('.alert-primary');
        if (fileItems.length === 0) return;
        
        // Create FormData
        const formData = new FormData();
        
        // Add files from file input
        for (let i = 0; i < fileInput.files.length; i++) {
            const file = fileInput.files[i];
            if (file.name.endsWith('.docx')) {
                formData.append('files[]', file);
            }
        }
        
        // Show processing status
        processingStatus.style.display = 'block';
        
        // Hide upload form
        dropZone.style.display = 'none';
        selectedFiles.style.display = 'none';
        processBtn.style.display = 'none';
        
        // Update status
        statusMessage.textContent = 'Uploading files...';
        progressBar.style.width = '5%';
        
        // Upload files
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Store task ID
            currentTaskId = data.task_id;
            
            // Update status
            statusMessage.textContent = 'Files uploaded successfully. Starting processing...';
            progressBar.style.width = '15%';
            
            // Start processing
            return fetch(`/process/${currentTaskId}`, {
                method: 'POST'
            });
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Start checking status
            statusMessage.textContent = 'Processing started. This may take several minutes...';
            startStatusCheck();
        })
        .catch(error => {
            console.error('Error:', error);
            statusMessage.textContent = `Error: ${error.message}`;
            progressBar.style.width = '0%';
            
            // Add retry button
            const retryBtn = document.createElement('button');
            retryBtn.className = 'btn btn-primary mt-3';
            retryBtn.textContent = 'Retry';
            retryBtn.addEventListener('click', () => {
                // Remove retry button
                retryBtn.remove();
                
                // Try again
                uploadAndProcessFiles();
            });
            
            processingStatus.appendChild(retryBtn);
        });
    }
    
    // Start checking status
    function startStatusCheck() {
        if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
        }
        
        statusCheckInterval = setInterval(() => {
            checkStatus();
        }, 2000);
    }
    
    // Check processing status
    function checkStatus() {
        if (!currentTaskId) return;
        
        fetch(`/status/${currentTaskId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Update progress
            progressBar.style.width = `${data.progress}%`;
            statusMessage.textContent = data.message;
            
            // Check if processing is complete
            if (data.status === 'completed') {
                clearInterval(statusCheckInterval);
                showResults(data);
            }
            // Check if there was an error
            else if (data.status === 'error') {
                clearInterval(statusCheckInterval);
                statusMessage.textContent = `Error: ${data.message}`;
                
                // Add retry button
                const retryBtn = document.createElement('button');
                retryBtn.className = 'btn btn-primary mt-3';
                retryBtn.textContent = 'Retry';
                retryBtn.addEventListener('click', () => {
                    // Remove retry button
                    retryBtn.remove();
                    
                    // Try again
                    uploadAndProcessFiles();
                });
                
                processingStatus.appendChild(retryBtn);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            // Don't stop checking status on network errors
        });
    }
    
    // Show results
    function showResults(data) {
        processingStatus.style.display = 'none';
        resultsContainer.style.display = 'block';
        
        resultsList.innerHTML = '';
        
        // Add processed files
        if (data.processed_files && data.processed_files.length > 0) {
            data.processed_files.forEach((file, index) => {
                const resultCard = document.createElement('div');
                resultCard.className = 'col-md-6 mb-4';
                resultCard.innerHTML = `
                    <div class="card document-card">
                        <div class="document-thumbnail">
                            <i class="bi bi-file-earmark-word"></i>
                        </div>
                        <div class="card-body">
                            <h5 class="card-title">${file.original_name}</h5>
                            <p class="card-text">Successfully processed with Latin correction and Dutch translation.</p>
                            <div class="d-flex justify-content-between">
                                <button class="btn btn-outline-primary btn-sm preview-btn" data-filename="${file.processed_name}">Preview</button>
                                <a href="${file.download_url}" class="btn btn-primary btn-sm download-btn">Download</a>
                            </div>
                        </div>
                        <span class="status-badge completed">Completed</span>
                    </div>
                `;
                
                resultsList.appendChild(resultCard);
                
                // Add preview functionality
                const previewBtn = resultCard.querySelector('.preview-btn');
                previewBtn.addEventListener('click', () => {
                    showPreview(file.processed_name);
                });
            });
        }
        
        // Add compiled document card if available
        if (data.compiled_doc) {
            const compiledCard = document.createElement('div');
            compiledCard.className = 'col-12 mt-3';
            compiledCard.innerHTML = `
                <div class="card bg-light">
                    <div class="card-body">
                        <h5 class="card-title">Compiled Document</h5>
                        <p class="card-text">All processed documents combined into a single file with table of contents.</p>
                        <div class="d-flex justify-content-between">
                            <button class="btn btn-outline-success preview-compiled-btn" data-filename="${data.compiled_doc.name}">Preview</button>
                            <a href="${data.compiled_doc.download_url}" class="btn btn-success download-btn">Download Compiled Document</a>
                        </div>
                    </div>
                </div>
            `;
            
            resultsList.appendChild(compiledCard);
            
            // Add preview functionality for compiled document
            const previewCompiledBtn = compiledCard.querySelector('.preview-compiled-btn');
            previewCompiledBtn.addEventListener('click', () => {
                showPreview(data.compiled_doc.name);
            });
        }
        
        // Add "Process More" button
        const processMoreBtn = document.createElement('div');
        processMoreBtn.className = 'col-12 mt-4 text-center';
        processMoreBtn.innerHTML = `
            <button class="btn btn-outline-primary" id="process-more-btn">Process More Documents</button>
        `;
        
        resultsList.appendChild(processMoreBtn);
        
        // Add event listener for "Process More" button
        document.getElementById('process-more-btn').addEventListener('click', () => {
            // Reset the UI
            resultsContainer.style.display = 'none';
            dropZone.style.display = 'block';
            selectedFiles.style.display = 'block';
            processBtn.style.display = 'block';
            selectedFiles.innerHTML = '';
            updateProcessButton();
            
            // Reset task ID
            currentTaskId = null;
        });
    }
    
    // Show preview modal
    function showPreview(filename) {
        // Create modal if it doesn't exist
        let previewModal = document.getElementById('preview-modal');
        if (!previewModal) {
            previewModal = document.createElement('div');
            previewModal.className = 'modal fade preview-modal';
            previewModal.id = 'preview-modal';
            previewModal.setAttribute('tabindex', '-1');
            previewModal.setAttribute('aria-labelledby', 'preview-modal-label');
            previewModal.setAttribute('aria-hidden', 'true');
            
            previewModal.innerHTML = `
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="preview-modal-label">Document Preview</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="spinner-container">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                            </div>
                            <div id="preview-content" style="display: none;"></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <a href="#" class="btn btn-primary" id="preview-download-btn">Download</a>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(previewModal);
        }
        
        // Update modal content
        const previewContent = document.getElementById('preview-content');
        const spinnerContainer = document.querySelector('.spinner-container');
        const previewDownloadBtn = document.getElementById('preview-download-btn');
        
        // Show spinner, hide content
        spinnerContainer.style.display = 'flex';
        previewContent.style.display = 'none';
        previewContent.innerHTML = '';
        
        // Update download button
        previewDownloadBtn.href = `/download/${filename}`;
        
        // Show modal
        const modal = new bootstrap.Modal(previewModal);
        modal.show();
        
        // Load preview
        fetch(`/preview/${filename}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Preview not available');
            }
            return response.blob();
        })
        .then(blob => {
            // Create object URL
            const url = URL.createObjectURL(blob);
            
            // Create preview content based on file type
            if (filename.endsWith('.docx')) {
                // For DOCX, use an iframe with PDF viewer
                previewContent.innerHTML = `
                    <div class="alert alert-info">
                        DOCX preview is not available directly in the browser. Please download the file to view it.
                    </div>
                    <div class="text-center mt-3">
                        <img src="/static/images/docx_preview.png" alt="DOCX Preview" class="img-fluid" style="max-height: 400px;">
                    </div>
                `;
            } else if (filename.endsWith('.pdf')) {
                // For PDF, use an iframe
                previewContent.innerHTML = `
                    <iframe src="${url}" class="preview-iframe"></iframe>
                `;
            } else {
                // For other files, show a message
                previewContent.innerHTML = `
                    <div class="alert alert-info">
                        Preview not available for this file type. Please download the file to view it.
                    </div>
                `;
            }
            
            // Hide spinner, show content
            spinnerContainer.style.display = 'none';
            previewContent.style.display = 'block';
        })
        .catch(error => {
            console.error('Error:', error);
            
            // Show error message
            previewContent.innerHTML = `
                <div class="alert alert-danger">
                    Preview not available: ${error.message}
                </div>
                <div class="text-center mt-3">
                    <p>Please download the file to view it.</p>
                </div>
            `;
            
            // Hide spinner, show content
            spinnerContainer.style.display = 'none';
            previewContent.style.display = 'block';
        });
    }
});
