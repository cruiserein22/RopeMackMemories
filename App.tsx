/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { generateEditedImage, generateFilteredImage, generateAdjustedImage, generateMemory } from './services/geminiService';
import Header from './components/Header';
import Spinner from './components/Spinner';
import FilterPanel from './components/FilterPanel';
import AdjustmentPanel from './components/AdjustmentPanel';
import CropPanel from './components/CropPanel';
import { UndoIcon, RedoIcon, EyeIcon } from './components/icons';
import StartScreen from './components/StartScreen';
import ApiKeyModal from './components/ApiKeyModal';

// Helper to convert a data URL string to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

type Tab = 'retouch' | 'adjust' | 'filters' | 'crop';

const App: React.FC = () => {
  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editHotspot, setEditHotspot] = useState<{ x: number, y: number } | null>(null);
  const [displayHotspot, setDisplayHotspot] = useState<{ x: number, y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('retouch');
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>();
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const [apiKey, setApiKey] = useState<string | null>(() => sessionStorage.getItem('user-api-key'));
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<((apiKey: string) => void) | null>(null);

  const currentImage = history[historyIndex] ?? null;
  const originalImage = history[0] ?? null;

  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  // Effect to create and revoke object URLs safely for the current image
  useEffect(() => {
    if (currentImage) {
      const url = URL.createObjectURL(currentImage);
      setCurrentImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCurrentImageUrl(null);
    }
  }, [currentImage]);
  
  // Effect to create and revoke object URLs safely for the original image
  useEffect(() => {
    if (originalImage) {
      const url = URL.createObjectURL(originalImage);
      setOriginalImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalImageUrl(null);
    }
  }, [originalImage]);


  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const addImageToHistory = useCallback((newImageFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    // Reset transient states after an action
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, [history, historyIndex]);

  const handleImageUpload = useCallback((file: File) => {
    setError(null);
    setHistory([file]);
    setHistoryIndex(0);
    setEditHotspot(null);
    setDisplayHotspot(null);
    setActiveTab('retouch');
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, []);

  const handleCreateMemory = useCallback(async (faceDataUrl: string, prompt: string) => {
    const action = async (key: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const faceFile = dataURLtoFile(faceDataUrl, `face-${Date.now()}.png`);
            const memoryImageUrl = await generateMemory(key, faceFile, prompt);
            const newImageFile = dataURLtoFile(memoryImageUrl, `memory-${Date.now()}.png`);
            setHistory([newImageFile]);
            setHistoryIndex(0);
            setEditHotspot(null);
            setDisplayHotspot(null);
            setActiveTab('retouch');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(`Failed to create memory. ${errorMessage}`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!apiKey) {
        setPendingAction(() => action);
        setIsApiKeyModalOpen(true);
    } else {
        action(apiKey);
    }
  }, [apiKey]);

  const handleGenerate = useCallback(async () => {
    if (!currentImage) {
      setError('No image loaded to edit.');
      return;
    }
    
    if (!prompt.trim()) {
        setError('Please enter a description for your edit.');
        return;
    }

    if (!editHotspot) {
        setError('Please click on the image to select an area to edit.');
        return;
    }

    const action = async (key: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const editedImageUrl = await generateEditedImage(key, currentImage, prompt, editHotspot);
            const newImageFile = dataURLtoFile(editedImageUrl, `edited-${Date.now()}.png`);
            addImageToHistory(newImageFile);
            setEditHotspot(null);
            setDisplayHotspot(null);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(`Failed to generate the image. ${errorMessage}`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!apiKey) {
        setPendingAction(() => action);
        setIsApiKeyModalOpen(true);
    } else {
        action(apiKey);
    }
  }, [currentImage, prompt, editHotspot, addImageToHistory, apiKey]);
  
  const handleApplyFilter = useCallback(async (filterPrompt: string) => {
    if (!currentImage) {
      setError('No image loaded to apply a filter to.');
      return;
    }
    
    const action = async (key: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const filteredImageUrl = await generateFilteredImage(key, currentImage, filterPrompt);
            const newImageFile = dataURLtoFile(filteredImageUrl, `filtered-${Date.now()}.png`);
            addImageToHistory(newImageFile);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(`Failed to apply the filter. ${errorMessage}`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!apiKey) {
        setPendingAction(() => action);
        setIsApiKeyModalOpen(true);
    } else {
        action(apiKey);
    }
  }, [currentImage, addImageToHistory, apiKey]);
  
  const handleApplyAdjustment = useCallback(async (adjustmentPrompt: string) => {
    if (!currentImage) {
      setError('No image loaded to apply an adjustment to.');
      return;
    }
    
    const action = async (key: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const adjustedImageUrl = await generateAdjustedImage(key, currentImage, adjustmentPrompt);
            const newImageFile = dataURLtoFile(adjustedImageUrl, `adjusted-${Date.now()}.png`);
            addImageToHistory(newImageFile);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(`Failed to apply the adjustment. ${errorMessage}`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!apiKey) {
        setPendingAction(() => action);
        setIsApiKeyModalOpen(true);
    } else {
        action(apiKey);
    }
  }, [currentImage, addImageToHistory, apiKey]);

  const handleApplyCrop = useCallback(() => {
    if (!completedCrop || !imgRef.current) {
        setError('Please select an area to crop.');
        return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        setError('Could not process the crop.');
        return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = completedCrop.width * pixelRatio;
    canvas.height = completedCrop.height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height,
    );
    
    const croppedImageUrl = canvas.toDataURL('image/png');
    const newImageFile = dataURLtoFile(croppedImageUrl, `cropped-${Date.now()}.png`);
    addImageToHistory(newImageFile);

  }, [completedCrop, addImageToHistory]);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex(historyIndex - 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [canUndo, historyIndex]);
  
  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [canRedo, historyIndex]);

  const handleReset = useCallback(() => {
    if (history.length > 0) {
      setHistoryIndex(0);
      setError(null);
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [history]);

  const handleUploadNew = useCallback(() => {
      setHistory([]);
      setHistoryIndex(-1);
      setError(null);
      setPrompt('');
      setEditHotspot(null);
      setDisplayHotspot(null);
  }, []);

  const handleDownload = useCallback(() => {
      if (currentImage) {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(currentImage);
          link.download = `edited-${currentImage.name}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
      }
  }, [currentImage]);
  
  const handleFileSelect = (files: FileList | null) => {
    if (files && files[0]) {
      handleImageUpload(files[0]);
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (activeTab !== 'retouch') return;
    
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    setDisplayHotspot({ x: offsetX, y: offsetY });

    const { naturalWidth, naturalHeight, clientWidth, clientHeight } = img;
    const scaleX = naturalWidth / clientWidth;
    const scaleY = naturalHeight / clientHeight;

    const originalX = Math.round(offsetX * scaleX);
    const originalY = Math.round(offsetY * scaleY);

    setEditHotspot({ x: originalX, y: originalY });
};

  const handleApiKeySubmit = (newApiKey: string) => {
    const trimmedKey = newApiKey.trim();
    if (trimmedKey) {
        setApiKey(trimmedKey);
        sessionStorage.setItem('user-api-key', trimmedKey);
        setIsApiKeyModalOpen(false);
        
        if (pendingAction) {
            setTimeout(() => {
                pendingAction(trimmedKey);
                setPendingAction(null);
            }, 100);
        }
    }
  };


  const renderContent = () => {
    if (error) {
       return (
           <div className="text-center animate-fade-in bg-red-900/50 border border-red-700/50 p-8 rounded-lg max-w-2xl mx-auto flex flex-col items-center gap-4 backdrop-blur-sm">
            <h2 className="text-2xl font-bold text-cyan-400">An Error Occurred</h2>
            <p className="text-md text-red-300">{error}</p>
            <button
                onClick={() => setError(null)}
                className="bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-6 rounded-lg text-md transition-colors"
              >
                Try Again
            </button>
          </div>
        );
    }

    if (isLoading && !currentImageUrl) {
        return (
            <div className="text-center animate-fade-in flex flex-col items-center justify-center gap-4">
                <Spinner />
                <p className="text-gray-300 text-lg">AI is creating your vision...</p>
                <p className="text-gray-500 text-sm">This may take a moment.</p>
            </div>
        );
    }
    
    if (!currentImageUrl) {
      return <StartScreen onFileSelect={handleFileSelect} onCreateMemory={handleCreateMemory} isLoading={isLoading} />;
    }

    const imageDisplay = (
      <div className="relative">
        {/* Base image is the original, always at the bottom */}
        {originalImageUrl && (
            <img
                key={originalImageUrl}
                src={originalImageUrl}
                alt="Original"
                className="w-full h-auto object-contain max-h-[60vh] rounded-xl pointer-events-none"
            />
        )}
        {/* The current image is an overlay that fades in/out for comparison */}
        <img
            ref={imgRef}
            key={currentImageUrl}
            src={currentImageUrl}
            alt="Current"
            onClick={handleImageClick}
            className={`absolute top-0 left-0 w-full h-auto object-contain max-h-[60vh] rounded-xl transition-opacity duration-200 ease-in-out ${isComparing ? 'opacity-0' : 'opacity-100'} ${activeTab === 'retouch' ? 'cursor-crosshair' : ''}`}
        />
      </div>
    );
    
    // For ReactCrop, we need a single image element. We'll use the current one.
    const cropImageElement = (
      <img 
        ref={imgRef}
        key={`crop-${currentImageUrl}`}
        src={currentImageUrl} 
        alt="Crop this image"
        className="w-full h-auto object-contain max-h-[60vh] rounded-xl"
      />
    );


    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-6 animate-fade-in">
        <div className="relative w-full shadow-2xl rounded-xl overflow-hidden bg-black/30">
            {isLoading && (
                <div className="absolute inset-0 bg-black/80 z-30 flex flex-col items-center justify-center gap-4 animate-fade-in">
                    <Spinner />
                    <p className="text-gray-300">AI is working its magic...</p>
                </div>
            )}
            
            {activeTab === 'crop' ? (
              <ReactCrop 
                crop={crop} 
                onChange={c => setCrop(c)} 
                onComplete={c => setCompletedCrop(c)}
                aspect={aspect}
                className="max-h-[60vh]"
              >
                {cropImageElement}
              </ReactCrop>
            ) : imageDisplay }

            {displayHotspot && !isLoading && activeTab === 'retouch' && (
                <div 
                    className="absolute rounded-full w-6 h-6 bg-cyan-500/50 border-2 border-white pointer-events-none -translate-x-1/2 -translate-y-1/2 z-10"
                    style={{ left: `${displayHotspot.x}px`, top: `${displayHotspot.y}px` }}
                >
                    <div className="absolute inset-0 rounded-full w-6 h-6 animate-ping bg-cyan-400"></div>
                </div>
            )}
        </div>
        
        <div className="w-full bg-black/30 border border-gray-800 rounded-lg p-1.5 flex items-center justify-center gap-1 backdrop-blur-sm">
            {(['retouch', 'crop', 'adjust', 'filters'] as Tab[]).map(tab => (
                 <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`w-full capitalize font-semibold py-3 px-5 rounded-md transition-all duration-200 text-sm ${
                        activeTab === tab 
                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' 
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                >
                    {tab}
                </button>
            ))}
        </div>
        
        <div className="w-full">
            {activeTab === 'retouch' && (
                <div className="flex flex-col items-center gap-4">
                    <p className="text-sm text-gray-400">
                        {editHotspot ? 'Great! Now describe your localized edit below.' : 'Click an area on the image to make a precise edit.'}
                    </p>
                    <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} className="w-full flex items-stretch gap-2">
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={editHotspot ? "e.g., 'change my shirt color to blue'" : "First click a point on the image"}
                            className="flex-grow bg-[#1F2937]/70 border border-gray-700 text-gray-200 rounded-lg p-4 text-base focus:ring-2 focus:ring-cyan-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 backdrop-blur-sm"
                            disabled={isLoading || !editHotspot}
                        />
                        <button 
                            type="submit"
                            className="bg-cyan-500 text-white font-bold py-4 px-8 text-base rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/30 hover:bg-cyan-600 active:scale-95 disabled:bg-gray-700 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
                            disabled={isLoading || !prompt.trim() || !editHotspot}
                        >
                            Generate
                        </button>
                    </form>
                </div>
            )}
            {activeTab === 'crop' && <CropPanel onApplyCrop={handleApplyCrop} onSetAspect={setAspect} isLoading={isLoading} isCropping={!!completedCrop?.width && completedCrop.width > 0} />}
            {activeTab === 'adjust' && <AdjustmentPanel onApplyAdjustment={handleApplyAdjustment} isLoading={isLoading} />}
            {activeTab === 'filters' && <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} />}
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
             <button 
                onClick={handleUndo}
                disabled={!canUndo}
                className="flex items-center justify-center text-center bg-gray-800/80 border border-gray-700 text-gray-300 font-semibold py-2 px-4 rounded-md transition-colors duration-200 ease-in-out hover:bg-gray-700 hover:text-white active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Undo last action"
            >
                <UndoIcon className="w-4 h-4 mr-2" />
                Undo
            </button>
            <button 
                onClick={handleRedo}
                disabled={!canRedo}
                className="flex items-center justify-center text-center bg-gray-800/80 border border-gray-700 text-gray-300 font-semibold py-2 px-4 rounded-md transition-colors duration-200 ease-in-out hover:bg-gray-700 hover:text-white active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Redo last action"
            >
                <RedoIcon className="w-4 h-4 mr-2" />
                Redo
            </button>
            
            <div className="h-6 w-px bg-gray-700 mx-1 hidden sm:block"></div>

            {canUndo && (
              <button 
                  onMouseDown={() => setIsComparing(true)}
                  onMouseUp={() => setIsComparing(false)}
                  onMouseLeave={() => setIsComparing(false)}
                  onTouchStart={() => setIsComparing(true)}
                  onTouchEnd={() => setIsComparing(false)}
                  className="flex items-center justify-center text-center bg-gray-800/80 border border-gray-700 text-gray-300 font-semibold py-2 px-4 rounded-md transition-colors duration-200 ease-in-out hover:bg-gray-700 hover:text-white active:scale-95 text-sm"
                  aria-label="Press and hold to see original image"
              >
                  <EyeIcon className="w-4 h-4 mr-2" />
                  Compare
              </button>
            )}

            <button 
                onClick={handleReset}
                disabled={!canUndo}
                className="text-center bg-transparent border border-gray-700 text-gray-300 font-semibold py-2 px-4 rounded-md transition-colors duration-200 ease-in-out hover:bg-gray-800/80 hover:text-white active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset
            </button>
            <button 
                onClick={handleUploadNew}
                className="text-center bg-gray-800/80 border border-gray-700 text-gray-300 font-semibold py-2 px-4 rounded-md transition-colors duration-200 ease-in-out hover:bg-gray-700 hover:text-white active:scale-95 text-sm"
            >
                Upload New
            </button>

            <button 
                onClick={handleDownload}
                className="flex-grow sm:flex-grow-0 ml-auto bg-cyan-500 text-white font-bold py-2 px-5 rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/40 hover:bg-cyan-600 active:scale-95 text-sm"
            >
                Download Image
            </button>
        </div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen text-gray-100 flex flex-col">
      <Header />
      <main className={`flex-grow w-full max-w-[1600px] mx-auto p-4 md:p-8 flex justify-center ${currentImage ? 'items-start' : 'items-center'}`}>
        {renderContent()}
      </main>
      {isApiKeyModalOpen && (
        <ApiKeyModal 
            onSubmit={handleApiKeySubmit}
            onClose={() => {
                setIsApiKeyModalOpen(false);
                setPendingAction(null);
            }}
        />
      )}
    </div>
  );
};

export default App;