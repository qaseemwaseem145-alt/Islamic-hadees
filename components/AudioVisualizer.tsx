import React from 'react';

interface Props {
  volume: number;
  isActive: boolean;
}

const AudioVisualizer: React.FC<Props> = ({ volume, isActive }) => {
  // Volume is 0-255 roughly
  const normalized = Math.min(Math.max(volume / 50, 0), 1); // Normalize roughly 0-1
  
  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {isActive ? (
        <>
          <div className="w-2 bg-emerald-500 rounded-full transition-all duration-75" style={{ height: `${20 + normalized * 80}%` }}></div>
          <div className="w-2 bg-emerald-500 rounded-full transition-all duration-75 delay-75" style={{ height: `${30 + normalized * 60}%` }}></div>
          <div className="w-2 bg-emerald-500 rounded-full transition-all duration-75 delay-100" style={{ height: `${50 + normalized * 100}%` }}></div>
          <div className="w-2 bg-emerald-500 rounded-full transition-all duration-75 delay-75" style={{ height: `${30 + normalized * 60}%` }}></div>
          <div className="w-2 bg-emerald-500 rounded-full transition-all duration-75" style={{ height: `${20 + normalized * 80}%` }}></div>
        </>
      ) : (
        <div className="text-gray-400 text-sm">مائکروفون بند ہے (Mic Off)</div>
      )}
    </div>
  );
};

export default AudioVisualizer;
