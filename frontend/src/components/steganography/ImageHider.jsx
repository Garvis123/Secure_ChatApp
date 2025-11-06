import React, { useState, useRef } from 'react';
import { Upload, Download, Eye, EyeOff, ImageIcon, FileText, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  hideMessageInImage, 
  extractMessageFromImage, 
  canImageHoldMessage, 
  loadImageToCanvas 
} from '@/utils/steganography';

const ImageHider = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [messageToHide, setMessageToHide] = useState('');
  const [extractedMessage, setExtractedMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [canHideMessage, setCanHideMessage] = useState(false);
  const [activeTab, setActiveTab] = useState('hide');
  
  const fileInputRef = useRef(null);
  const extractFileInputRef = useRef(null);
  const canvasRef = useRef(null);

  const handleImageSelect = (file, isForExtraction = false) => {
    if (!file) return;
    
    setError('');
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file must be less than 10MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!isForExtraction) {
        setSelectedImage(file);
        setImagePreview(e.target.result);
        checkMessageCapacity(file);
      } else {
        // For extraction, immediately process the image
        extractMessageFromFile(file);
      }
    };
    reader.readAsDataURL(file);
  };

  const checkMessageCapacity = async (file) => {
    try {
      const canvas = await loadImageToCanvas(file);
      const capacity = canImageHoldMessage(canvas.width, canvas.height, messageToHide);
      setCanHideMessage(capacity);
    } catch (error) {
      console.error('Error checking capacity:', error);
      setCanHideMessage(false);
    }
  };

  const hideMessage = async () => {
    if (!selectedImage || !messageToHide.trim()) return;
    
    setIsProcessing(true);
    setError('');
    
    try {
      const canvas = await loadImageToCanvas(selectedImage);
      
      // Check if image can hold the message
      if (!canImageHoldMessage(canvas.width, canvas.height, messageToHide)) {
        throw new Error('Message is too long for this image. Try a larger image or shorter message.');
      }
      
      const encodedImageUrl = hideMessageInImage(canvas, messageToHide);
      
      // Create download link
      const link = document.createElement('a');
      link.href = encodedImageUrl;
      link.download = `hidden_message_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clear the message for security
      setMessageToHide('');
      
    } catch (error) {
      setError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const extractMessageFromFile = async (file) => {
    setIsProcessing(true);
    setError('');
    setExtractedMessage('');
    
    try {
      const canvas = await loadImageToCanvas(file);
      const message = extractMessageFromImage(canvas);
      
      if (message) {
        setExtractedMessage(message);
      } else {
        setExtractedMessage('No hidden message found in this image.');
      }
      
    } catch (error) {
      setError('Failed to extract message from image');
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateCapacity = () => {
    if (!selectedImage) return 0;
    // Rough calculation: 1 pixel can hold 1 bit, 8 bits per character
    return Math.floor((selectedImage.width * selectedImage.height) / 8);
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Steganography - Hide Messages in Images
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="hide" className="flex items-center gap-2">
              <EyeOff className="h-4 w-4" />
              Hide Message
            </TabsTrigger>
            <TabsTrigger value="extract" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Extract Message
            </TabsTrigger>
          </TabsList>
          
          {/* Hide Message Tab */}
          <TabsContent value="hide" className="space-y-4 mt-4">
            {/* Image upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Cover Image</label>
              <div 
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <div className="space-y-2">
                    <img 
                      src={imagePreview} 
                      alt="Selected" 
                      className="max-h-32 mx-auto rounded"
                    />
                    <p className="text-sm text-muted-foreground">
                      {selectedImage?.name}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to select an image (PNG, JPG, WEBP)
                    </p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageSelect(e.target.files[0])}
                className="hidden"
              />
            </div>

            {/* Message input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Secret Message</label>
              <Textarea
                value={messageToHide}
                onChange={(e) => {
                  setMessageToHide(e.target.value);
                  if (selectedImage) checkMessageCapacity(selectedImage);
                }}
                placeholder="Enter your secret message here..."
                className="min-h-[100px]"
              />
              
              {/* Capacity indicator */}
              {selectedImage && (
                <div className="flex items-center gap-2">
                  <Badge variant={canHideMessage ? 'default' : 'destructive'}>
                    {messageToHide.length} / {calculateCapacity()} characters
                  </Badge>
                  {!canHideMessage && messageToHide.length > 0 && (
                    <span className="text-xs text-destructive">
                      Message too long for this image
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Hide button */}
            <Button 
              onClick={hideMessage}
              disabled={!selectedImage || !messageToHide.trim() || !canHideMessage || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Hiding Message...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Hide Message & Download
                </>
              )}
            </Button>
          </TabsContent>
          
          {/* Extract Message Tab */}
          <TabsContent value="extract" className="space-y-4 mt-4">
            {/* Image upload for extraction */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Image with Hidden Message</label>
              <div 
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => extractFileInputRef.current?.click()}
              >
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to select an image to extract message from
                  </p>
                </div>
              </div>
              <input
                ref={extractFileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageSelect(e.target.files[0], true)}
                className="hidden"
              />
            </div>

            {/* Extracted message */}
            {extractedMessage && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Extracted Message</label>
                <div className="p-3 bg-muted rounded-lg border">
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {extractedMessage}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Processing indicator */}
            {isProcessing && activeTab === 'extract' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                Extracting hidden message...
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Error display */}
        {error && (
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Security notice */}
        <Alert className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Security Notice:</strong> Steganography provides security through obscurity. 
            For sensitive data, always encrypt your message before hiding it in images.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default ImageHider;