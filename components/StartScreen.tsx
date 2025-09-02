/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { UploadIcon, MagicWandIcon, PaletteIcon, SunIcon, SparkleIcon, PlusIcon, TrashIcon } from './icons';

interface FaceLibraryProps {
    onFaceSelect: (faceDataUrl: string | null) => void;
    isLoading: boolean;
}

const FaceLibrary: React.FC<FaceLibraryProps> = ({ onFaceSelect, isLoading }) => {
    const [faces, setFaces] = useState<string[]>([]);
    const [selectedFace, setSelectedFace] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        try {
            const storedFaces = localStorage.getItem('dad-memory-faces');
            if (storedFaces) {
                setFaces(JSON.parse(storedFaces));
            }
        } catch (e) {
            console.error("Failed to load faces from storage", e);
        }
    }, []);

    const saveFacesToStorage = (updatedFaces: string[]) => {
        try {
            localStorage.setItem('dad-memory-faces', JSON.stringify(updatedFaces));
        } catch (e) {
            console.error("Failed to save faces to storage", e);
        }
    };

    const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const newFace = event.target?.result as string;
                if (faces.length < 5) { // Limit to 5 faces for simplicity
                    const updatedFaces = [...faces, newFace];
                    setFaces(updatedFaces);
                    saveFacesToStorage(updatedFaces);
                } else {
                    alert("You can store up to 5 faces. Please remove one to add a new one.");
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSelectFace = (faceDataUrl: string) => {
        const newSelection = selectedFace === faceDataUrl ? null : faceDataUrl;
        setSelectedFace(newSelection);
        onFaceSelect(newSelection);
    };

    const handleDeleteFace = (faceToDelete: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updatedFaces = faces.filter(face => face !== faceToDelete);
        setFaces(updatedFaces);
        saveFacesToStorage(updatedFaces);
        if (selectedFace === faceToDelete) {
            setSelectedFace(null);
            onFaceSelect(null);
        }
    };

    return (
        <div className="w-full bg-black/30 p-4 rounded-lg border border-gray-800 backdrop-blur-sm">
            <div className="flex items-center gap-3">
                {faces.map((face, index) => (
                    <div
                        key={index}
                        onClick={() => !isLoading && handleSelectFace(face)}
                        className={`relative w-24 h-24 rounded-md overflow-hidden cursor-pointer transition-all duration-200 group ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <img src={face} alt={`Face ${index + 1}`} className="w-full h-full object-cover" />
                         <div className={`absolute inset-0 ring-inset ring-2 transition-all duration-200 ${selectedFace === face ? 'ring-cyan-500' : 'ring-transparent group-hover:ring-cyan-500/50'}`}></div>
                        <button
                            onClick={(e) => !isLoading && handleDeleteFace(face, e)}
                            disabled={isLoading}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 transition-opacity opacity-0 group-hover:opacity-100 disabled:opacity-0"
                            aria-label="Delete face"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                {faces.length < 5 && (
                    <>
                        <input
                            type="file"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileAdd}
                            accept="image/*"
                            disabled={isLoading}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className="w-24 h-24 rounded-md bg-white/5 border-2 border-dashed border-gray-600 flex flex-col items-center justify-center text-gray-400 hover:bg-white/10 hover:border-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Add a new face"
                        >
                            <PlusIcon className="w-8 h-8" />
                            <span className="text-xs mt-1">Add Face</span>
                        </button>
                    </>
                )}
            </div>
             {faces.length === 0 && <p className="text-center text-gray-400 mt-2 text-sm">Upload a source photo to get started.</p>}
        </div>
    );
};

interface StartScreenProps {
  onFileSelect: (files: FileList | null) => void;
  onCreateMemory: (faceDataUrl: string, prompt: string) => void;
  isLoading: boolean;
}

type Tab = 'generate' | 'upload';

const StartScreen: React.FC<StartScreenProps> = ({ onFileSelect, onCreateMemory, isLoading }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('generate');
  const [prompt, setPrompt] = useState('');
  const [selectedFace, setSelectedFace] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileSelect(e.target.files);
  };
  
  const handleGenerateClick = () => {
    if (prompt.trim() && selectedFace && !isLoading) {
      onCreateMemory(selectedFace, prompt);
    }
  }

  const renderUploadTab = () => (
    <div className="flex flex-col items-center gap-4 animate-fade-in">
        <label htmlFor="image-upload-start" className="relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-cyan-500 rounded-lg cursor-pointer group hover:bg-cyan-600 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed" aria-disabled={isLoading} >
            <UploadIcon className="w-6 h-6 mr-3" />
            Upload an Image
        </label>
        <input id="image-upload-start" type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isLoading} />
        <p className="text-sm text-gray-500">or drag and drop a file</p>
    </div>
  );

  const renderGenerateTab = () => (
    <div className="w-full max-w-2xl flex flex-col items-center gap-5 animate-fade-in">
        <div className="w-full text-center">
            <p className="text-lg text-gray-300">1. Choose Your Subject.</p>
            <p className="text-sm text-gray-500 mt-2 max-w-xl mx-auto">I built this to give my dad's batshit crazy anecdotes the cinematic treatment they deserved. His stories were legendary, but frankly, they needed visual aids. I never expected this little project to escape the family group chat, let alone connect with so many others.</p>
        </div>
        <FaceLibrary onFaceSelect={setSelectedFace} isLoading={isLoading} />
        
        <div className="w-full text-center mt-4">
            <p className="text-lg text-gray-300">2. Craft Your Alternate Reality.</p>
            <p className="text-sm text-gray-500 mt-2 max-w-xl mx-auto">This tool is powered by the absolute bleeding-edge of AI image generation (a title it will hold for the next 15 minutes, probably). It's here to bring stories to life, give form to questionable ideas, and visualize memories that were previously only available in your imagination's private collection.</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleGenerateClick(); }} className="w-full flex flex-col items-center gap-4 mt-2">
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={selectedFace ? "e.g., A high definition cinematic mid-shot photograph of a man feeling calm and relaxed while he is fishing on a boat in stormy seas." : "After you have selected a photo above, describe your scene in precise detail"}
                className="w-full bg-[#1F2937]/70 border border-gray-700 text-gray-200 rounded-lg p-4 text-base focus:ring-2 focus:ring-cyan-500 focus:outline-none transition h-28 resize-none disabled:opacity-60 backdrop-blur-sm"
                disabled={isLoading || !selectedFace}
                aria-label="Image generation prompt"
            />
            <button
                type="submit"
                disabled={isLoading || !prompt.trim() || !selectedFace}
                className="w-full max-w-sm relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-cyan-500 rounded-lg group transition-all duration-300 ease-in-out hover:bg-cyan-600 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/30"
            >
                <SparkleIcon className="w-6 h-6 mr-3" />
                Create Memory
            </button>
            <p className="text-xs text-gray-500 mt-1 italic max-w-md mx-auto">
                So, in the spirit of that first gift, this tool is now free for everyone. It's expensive to run, but the results are priceless. I only hope you'll use it to create some special memories of your own, you magnificent, cheap bastards. - CM
            </p>
        </form>
    </div>
  );

  return (
    <div 
      className={`w-full max-w-5xl mx-auto text-center p-8 transition-all duration-300 rounded-2xl border-2 ${isDraggingOver ? 'bg-cyan-500/10 border-dashed border-cyan-400' : 'border-transparent'}`}
      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        onFileSelect(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <div className="text-center">
            <h1 className="text-5xl font-extrabold tracking-tighter text-gray-100 sm:text-6xl md:text-7xl">
                Memories in Motion: <span className="text-cyan-400">Mack Edition</span>
            </h1>
            <p className="max-w-3xl mx-auto mt-2 text-lg text-gray-300 md:text-xl">
                For My Dad's 60th — Now Over-Engineered & Free For Everyone
            </p>
        </div>
        <p className="max-w-3xl text-lg text-gray-400 md:text-xl">
          You might know this app by its original, financially-panicked name, "Rope"—because we were pretty sure we were tying a noose around our own wallets. What started as a birthday gift for my Dad is now... your problem. Upload a photo, describe a scene, and let an AI do all the hard work.
        </p>

        <div className="mt-6 w-full max-w-md bg-black/30 border border-gray-800 rounded-lg p-1.5 flex items-center justify-center gap-1 backdrop-blur-sm">
            {(['generate', 'upload'] as Tab[]).map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`w-full capitalize font-semibold py-3 px-5 rounded-md transition-all duration-200 text-sm flex items-center justify-center gap-2 ${
                        activeTab === tab 
                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' 
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                >
                    {tab === 'generate' ? <SparkleIcon className="w-5 h-5" /> : <UploadIcon className="w-5 h-5" />}
                    {tab === 'generate' ? 'Create a Memory' : 'Edit Your Photo'}
                </button>
            ))}
        </div>
        
        <div className="mt-8 w-full flex justify-center">
            {activeTab === 'upload' ? renderUploadTab() : renderGenerateTab()}
        </div>

        <div className="mt-20 w-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-black/30 p-6 rounded-xl border border-gray-800 flex flex-col items-center text-center backdrop-blur-sm transition-all duration-300 hover:border-cyan-500/50 hover:bg-black/50">
                    <div className="flex items-center justify-center w-12 h-12 bg-gray-900 border border-gray-700 rounded-full mb-4">
                       <MagicWandIcon className="w-6 h-6 text-cyan-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-100">Precise Retouching</h3>
                    <p className="mt-2 text-gray-400 text-sm">Click any point on your image to remove blemishes, change colors, or add elements with godlike precision.</p>
                </div>
                <div className="bg-black/30 p-6 rounded-xl border border-gray-800 flex flex-col items-center text-center backdrop-blur-sm transition-all duration-300 hover:border-cyan-500/50 hover:bg-black/50">
                    <div className="flex items-center justify-center w-12 h-12 bg-gray-900 border border-gray-700 rounded-full mb-4">
                       <PaletteIcon className="w-6 h-6 text-cyan-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-100">Creative Filters</h3>
                    <p className="mt-2 text-gray-400 text-sm">Slap a whole new personality on your photos. From vintage vibes to futuristic glows, find a filter or invent one.</p>
                </div>
                <div className="bg-black/30 p-6 rounded-xl border border-gray-800 flex flex-col items-center text-center backdrop-blur-sm transition-all duration-300 hover:border-cyan-500/50 hover:bg-black/50">
                    <div className="flex items-center justify-center w-12 h-12 bg-gray-900 border border-gray-700 rounded-full mb-4">
                       <SunIcon className="w-6 h-6 text-cyan-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-100">Pro Adjustments</h3>
                    <p className="mt-2 text-gray-400 text-sm">Tweak the lighting, obliterate the background, or completely change the mood. Get studio-quality results without the studio rental fees.</p>
                </div>
            </div>
        </div>
        
        <div className="mt-16 w-full text-center">
            <h2 className="text-2xl font-semibold text-gray-200 tracking-tight">Apparently, People Like This Thing</h2>
            <p className="mt-2 text-gray-400 max-w-2xl mx-auto text-base">I'm incredibly humbled by the recognition this little project has received. And a little terrified.</p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-black/30 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-cyan-400">#1 Product of the Week 11/08/2025 - 17/08/2025</h3>
                    <p className="mt-1 text-gray-300">Product Hunt</p>
                    <a href="https://producthunt.com" target="_blank" rel="noopener noreferrer" className="mt-1 text-sm text-gray-500 hover:text-cyan-400 transition-colors">producthunt.com</a>
                </div>
                <div className="bg-black/30 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-cyan-400">#2 Product of the Day 04/08/2025</h3>
                    <p className="mt-1 text-gray-300">Product Hunt</p>
                    <a href="https://producthunt.com" target="_blank" rel="noopener noreferrer" className="mt-1 text-sm text-gray-500 hover:text-cyan-400 transition-colors">producthunt.com</a>
                </div>
                <div className="bg-black/30 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-cyan-400">Developers Choice Award Runner Up - July 2025</h3>
                    <p className="mt-1 text-gray-300">TechCrunch Disrupt</p>
                    <a href="https://techcrunch.com" target="_blank" rel="noopener noreferrer" className="mt-1 text-sm text-gray-500 hover:text-cyan-400 transition-colors">techcrunch.com</a>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default StartScreen;