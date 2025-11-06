// client/src/components/chat/FileUpload.jsx - UPDATE
import { useState } from 'react';
import { Upload, X, File, Shield, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../config/api';

const FileUpload = ({ roomId, onClose, onUpload }) => {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { sendMessage } = useChat();
  const { token } = useAuth();

  const handleFileSelect = async (file) => {
    if (!file) return;

    // Check if roomId is valid (not a mock room)
    const isMockRoom = !roomId || roomId.startsWith('dm-') || roomId.startsWith('room-');
    if (isMockRoom) {
      alert('Please create or join a real room to upload files. Mock rooms are not supported for file uploads.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (roomId) {
        formData.append('roomId', roomId);
      }

      // Get auth token
      const authToken = token || localStorage.getItem('token');
      
      const response = await fetch(getApiUrl('/api/file/upload'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in again.');
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'File upload failed');
      }

      const data = await response.json();
      
      if (data.success) {
        // Send file message
        await sendMessage(roomId, `File: ${data.data.fileName}`, {
          type: 'file',
          fileMetadata: {
            fileName: data.data.fileName,
            fileSize: data.data.fileSize,
            mimeType: data.data.mimeType,
            url: data.data.url
          }
        });
        
        onUpload(data.data);
        onClose();
      } else {
        throw new Error(data.message || 'File upload failed');
      }
    } catch (error) {
      console.error('File upload failed:', error);
      alert(error.message || 'Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gradient-card border-border/50 shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Secure File Upload</span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={uploading}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border'
            } ${uploading ? 'opacity-50' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {uploading ? (
              <Loader2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-spin" />
            ) : (
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            )}
            
            <p className="text-sm text-muted-foreground mb-4">
              {uploading ? 'Encrypting and uploading...' : 'Drag and drop files here, or click to select'}
            </p>
            
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files[0])}
              disabled={uploading}
            />
            
            <Button 
              variant="outline" 
              onClick={() => document.getElementById('file-upload').click()}
              disabled={uploading}
            >
              Choose Files
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Files are encrypted before upload. Max size: 10MB
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FileUpload;