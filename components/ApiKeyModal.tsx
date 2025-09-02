/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';

interface ApiKeyModalProps {
  onSubmit: (apiKey: string) => void;
  onClose: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSubmit, onClose }) => {
  const [key, setKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) {
      onSubmit(key.trim());
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="apiKeyModalTitle"
    >
      <div 
        className="bg-[#1F2937] border border-gray-700 rounded-xl p-6 sm:p-8 max-w-lg w-full text-center shadow-2xl shadow-cyan-500/10 transform transition-all"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="apiKeyModalTitle" className="text-2xl font-bold text-cyan-400 mb-2">Image Generation Suspended!</h2>
        <p className="text-gray-300 mb-4">
          Well, this is awkward. Due to an unexpected surge of new Discord users, our servers are sweating bullets. So, for now, free image generation is taking a little nap.
        </p>
        <p className="text-gray-400 mb-6">
          To keep the magic alive, you'll need to <strong>bring your own API key</strong>. Otherwise, we might have to switch this thing to fully paid, and nobody wants that.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col items-center">
          <label htmlFor="api-key-input" className="sr-only">Gemini API Key</label>
          <input
            id="api-key-input"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste your Gemini API key here"
            className="w-full bg-gray-900/70 border border-gray-600 text-gray-200 rounded-lg p-3 text-base focus:ring-2 focus:ring-cyan-500 focus:outline-none transition"
            autoFocus
          />
          <button
            type="submit"
            disabled={!key.trim()}
            className="w-full mt-4 bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/30 hover:bg-cyan-600 active:scale-95 text-base disabled:bg-gray-700 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </form>
        <p className="text-sm text-gray-500 mt-6 italic">
          Don't have a key? Sit tight, we’ll try to get these broke image-generator junkies their fix soon.
        </p>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300 mt-4 transition-colors">
            Maybe later
        </button>
      </div>
    </div>
  );
};

export default ApiKeyModal;
