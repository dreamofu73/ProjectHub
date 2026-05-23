export function uploadFilesWithProgress<T = any>(
  url: string,
  files: File[],
  additionalData: Record<string, string>,
  onProgress: (progress: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('token');
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 401) {
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        } catch { /* ignore */ }
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.assign('/login');
        }
        reject(new Error('Unauthorized'));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload failed with status ${xhr.status}`));
        return;
      }
      try {
        const response = JSON.parse(xhr.responseText);
        resolve(response);
      } catch {
        reject(new Error('Upload response was not valid JSON'));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed due to network error'));
    });

    xhr.open('POST', url, true);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    const formData = new FormData();
    files.forEach(file => {
      formData.append('file', file);
    });

    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });

    xhr.send(formData);
  });
}
