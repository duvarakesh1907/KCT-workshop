import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WORD_LIST } from '../data/words';
import { Heart, Trophy, RefreshCw, AlertTriangle } from 'lucide-react';
import { soundManager } from '../utils/SoundManager';

// Types
type Word = {
  id: string;
  text: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  speed: number;
  typedIndex: number; // how many chars matched
  isTarget: boolean;
  isError: boolean;
};

type Particle = {
  id: string;
  x: number;
  y: number;
  color: string;
  velocity: { x: number; y: number };
  life: number;
};

// Constants
const SPAWN_RATE_MS = 1500;
const GAME_LOOP_MS = 16; // ~60fps
const BASE_SPEED = 0.05; // Vertical movement per frame (%)

export default function NeonTypeGame() {
  // Game State
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover'>('start');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [wpm, setWpm] = useState(0);
  const [words, setWords] = useState<Word[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [difficulty, setDifficulty] = useState(1);
  
  // Refs for mutable state in loop
  const wordsRef = useRef<Word[]>([]);
  const lastSpawnTime = useRef(0);
  const requestRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const startTimeRef = useRef(0);
  const typedCharsRef = useRef(0);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const difficultyRef = useRef(1);
  const gameStateRef = useRef<'start' | 'playing' | 'gameover'>('start');
  const livesRef = useRef(5);

  // Sync refs with state for UI
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);

  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);

  // --- Game Loop ---
  const gameLoop = useCallback((time: number) => {
    if (gameStateRef.current !== 'playing') return;

    // 1. Spawn Words
    if (time - lastSpawnTime.current > (SPAWN_RATE_MS / difficultyRef.current)) {
      spawnWord();
      lastSpawnTime.current = time;
    }

    // 2. Move Words
    wordsRef.current = wordsRef.current.map(word => ({
      ...word,
      y: word.y + (word.speed * (1 + (difficultyRef.current * 0.1))),
    }));

    // 3. Check Collisions (Bottom of screen)
    const survivors = [];
    let livesLost = 0;
    
    for (const word of wordsRef.current) {
      if (word.y > 95) { // Hit bottom
        livesLost++;
        createExplosion(word.x, 95, '#ff0055'); // Red explosion
        soundManager.playError();
      } else {
        survivors.push(word);
      }
    }

    if (livesLost > 0) {
      const newLives = livesRef.current - livesLost;
      livesRef.current = newLives;
      setLives(newLives); // Update UI
      
      if (newLives <= 0) {
        endGame();
        return; // Stop loop
      }
    }
    
    wordsRef.current = survivors;
    setWords([...wordsRef.current]); // Trigger render

    // 4. Update Particles
    updateParticles();

    requestRef.current = requestAnimationFrame(gameLoop);
  }, []); // No dependencies, reads from refs

  // --- Helpers ---
  const spawnWord = () => {
    const text = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
    const id = Math.random().toString(36).substr(2, 9);
    const x = 10 + Math.random() * 80; // Keep within 10-90% width
    
    const newWord: Word = {
      id,
      text,
      x,
      y: -5, // Start slightly above
      speed: BASE_SPEED + (Math.random() * 0.05),
      typedIndex: 0,
      isTarget: false,
      isError: false
    };
    
    wordsRef.current.push(newWord);
  };

  const createExplosion = (x: number, y: number, color: string) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 12; i++) {
      newParticles.push({
        id: Math.random().toString(),
        x,
        y,
        color,
        velocity: {
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2
        },
        life: 1.0
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  };

  const updateParticles = () => {
    setParticles(prev => prev.map(p => ({
      ...p,
      x: p.x + p.velocity.x,
      y: p.y + p.velocity.y,
      life: p.life - 0.05
    })).filter(p => p.life > 0));
  };

  const endGame = () => {
    setGameState('gameover');
    gameStateRef.current = 'gameover';
    soundManager.playError();
    cancelAnimationFrame(requestRef.current);
  };

  const startGame = () => {
    soundManager.playStart();
    
    // Reset State
    setScore(0);
    scoreRef.current = 0;
    
    setLives(5);
    livesRef.current = 5;
    
    setWords([]);
    wordsRef.current = [];
    
    setParticles([]);
    
    setDifficulty(1);
    difficultyRef.current = 1;
    
    typedCharsRef.current = 0;
    startTimeRef.current = Date.now();
    
    setGameState('playing');
    gameStateRef.current = 'playing';
    
    lastSpawnTime.current = performance.now();
    
    // Cancel any existing loop just in case
    cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  // --- Input Handling ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') {
        if (e.key === 'Enter') startGame();
        return;
      }

      const char = e.key.toLowerCase();
      if (!/^[a-z0-9]$/.test(char)) return; // Only alphanumeric

      let activeWords = wordsRef.current;
      
      // 1. Find Target
      let targetWord = activeWords.find(w => w.isTarget);
      
      // 2. If no target, search for new target
      if (!targetWord) {
        const potentialTargets = activeWords.filter(w => w.text.toLowerCase().startsWith(char));
        
        if (potentialTargets.length > 0) {
          // Pick the one closest to bottom (highest Y)
          potentialTargets.sort((a, b) => b.y - a.y);
          targetWord = potentialTargets[0];
          targetWord.isTarget = true;
        } else {
          // MISS (No word starts with this char)
          soundManager.playError();
          return;
        }
      }

      // 3. Process Input on Target
      if (targetWord) {
        const nextChar = targetWord.text[targetWord.typedIndex].toLowerCase();
        
        if (char === nextChar) {
          // HIT
          targetWord.typedIndex++;
          targetWord.isError = false;
          typedCharsRef.current++;
          soundManager.playKeystroke();
          
          // Calculate WPM
          const minutes = (Date.now() - startTimeRef.current) / 60000;
          setWpm(Math.round((typedCharsRef.current / 5) / (minutes || 1)));

          // Word Complete?
          if (targetWord.typedIndex >= targetWord.text.length) {
            // Destroy word
            createExplosion(targetWord.x, targetWord.y, '#00ffff'); // Blue explosion
            soundManager.playExplosion();
            scoreRef.current += targetWord.text.length * 10 * difficultyRef.current;
            setScore(scoreRef.current);
            
            // Increase difficulty slightly
            const newDifficulty = Math.min(difficultyRef.current + 0.05, 5);
            difficultyRef.current = newDifficulty;
            setDifficulty(newDifficulty);
            
            // Remove from array
            wordsRef.current = wordsRef.current.filter(w => w.id !== targetWord!.id);
          }
        } else {
          // MISS on Target
          targetWord.isError = true;
          soundManager.playError();
        }
      }
      
      // Force update to show typing progress
      setWords([...wordsRef.current]);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, difficulty]);

  // --- Render ---
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-mono select-none">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
           style={{ 
             backgroundImage: 'linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)',
             backgroundSize: '40px 40px',
             transform: 'perspective(500px) rotateX(60deg) translateY(-100px) scale(2)'
           }} 
      />
      
      {/* Scanlines */}
      <div className="scanlines" />

      {/* HUD */}
      <div className="absolute top-0 left-0 w-full p-4 md:p-6 flex justify-between items-start z-20 pointer-events-none">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 md:gap-3 text-neon-blue">
            <Trophy className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />
            <span className="text-xl md:text-2xl font-bold tracking-wider text-glow-blue">{score.toString().padStart(6, '0')}</span>
          </div>
          <div className="text-[10px] md:text-xs text-cyan-700 uppercase tracking-widest">Score</div>
        </div>

        <div className="flex flex-col items-center gap-1 mx-2">
           <div className="text-xl sm:text-2xl md:text-4xl font-display font-black italic text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 tracking-tighter text-center pr-2">
             WORKSHOP
           </div>
           <div className="text-[10px] md:text-xs text-purple-500 tracking-[0.3em] md:tracking-[0.5em] uppercase">GAME</div>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <div className="flex items-center gap-1 md:gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Heart 
                key={i} 
                className={`w-5 h-5 md:w-6 md:h-6 ${i < lives ? 'text-pink-500 fill-pink-500 text-glow-pink' : 'text-gray-800'}`} 
              />
            ))}
          </div>
          <div className="flex items-center gap-4 mt-2">
             <div className="text-right">
                <div className="text-xl font-bold text-green-400 text-glow-green">{wpm}</div>
                <div className="text-[10px] text-green-800 uppercase">WPM</div>
             </div>
             <div className="text-right">
                <div className="text-xl font-bold text-yellow-400">x{difficulty.toFixed(1)}</div>
                <div className="text-[10px] text-yellow-800 uppercase">Mult</div>
             </div>
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div ref={gameContainerRef} className="absolute inset-0 z-10">
        <AnimatePresence>
          {words.map(word => (
            <motion.div
              key={word.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: 1, 
                scale: word.isTarget ? 1.2 : 1,
                top: `${word.y}%`,
                left: `${word.x}%`,
                x: '-50%' // Center horizontally on coordinate
              }}
              exit={{ opacity: 0, scale: 1.5, filter: 'blur(10px)' }}
              transition={{ duration: 0 }} // Instant update from state for position
              className={`absolute px-3 py-1 rounded-md transition-colors duration-75
                ${word.isTarget 
                  ? 'bg-cyan-900/30 border border-cyan-500/50 box-glow-blue z-20' 
                  : 'bg-black/40 border border-gray-800 z-10'}
                ${word.isError ? 'animate-shake border-red-500 bg-red-900/40' : ''}
              `}
            >
              <span className="text-xl font-mono tracking-wide whitespace-nowrap">
                {/* Typed Part */}
                <span className="text-gray-500">
                  {word.text.slice(0, word.typedIndex)}
                </span>
                {/* Current Char */}
                <span className={`${word.isTarget ? 'text-white text-glow-blue underline decoration-cyan-400 decoration-2 underline-offset-4' : 'text-cyan-400'}`}>
                  {word.text.slice(word.typedIndex, word.typedIndex + 1)}
                </span>
                {/* Remaining Part */}
                <span className={`${word.isTarget ? 'text-cyan-200' : 'text-cyan-700'}`}>
                  {word.text.slice(word.typedIndex + 1)}
                </span>
              </span>
              
              {/* Target Indicator */}
              {word.isTarget && (
                <motion.div 
                  layoutId="target-indicator"
                  className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-4 bg-cyan-400 box-glow-blue"
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Particles */}
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute w-1 h-1 rounded-full pointer-events-none"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              backgroundColor: p.color,
              opacity: p.life,
              transform: `scale(${p.life})`
            }}
          />
        ))}
      </div>

      {/* Start Screen Overlay */}
      {gameState === 'start' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="text-center space-y-8 w-full max-w-4xl">
            <motion.h1 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-5xl md:text-8xl font-display font-black italic text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-blue-600 tracking-tighter drop-shadow-[0_0_15px_rgba(0,255,255,0.5)] px-4 pr-6 max-w-full break-words"
            >
              WORKSHOP<br/>GAME
            </motion.h1>
            <p className="text-gray-400 font-mono text-sm md:text-base max-w-md mx-auto">
              Type the falling words before they breach the firewall.
              <br/>
              <span className="text-cyan-500">Precision is key. Speed is survival.</span>
            </p>
            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: 'rgba(0, 255, 255, 0.1)' }}
              whileTap={{ scale: 0.95 }}
              onClick={startGame}
              className="px-12 py-4 border border-cyan-500 text-cyan-400 font-display font-bold text-xl uppercase tracking-widest hover:box-glow-blue transition-all"
            >
              Initialize System [Enter]
            </motion.button>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-red-900/20 backdrop-blur-md">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-black/90 border border-red-500/50 p-12 rounded-2xl text-center max-w-lg w-full shadow-[0_0_50px_rgba(255,0,85,0.2)]"
          >
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h2 className="text-5xl font-display font-bold text-red-500 mb-2 text-glow-pink">SYSTEM FAILURE</h2>
            <p className="text-red-300/60 font-mono mb-8">Firewall breached. Connection terminated.</p>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gray-900/50 p-4 rounded border border-gray-800">
                <div className="text-xs text-gray-500 uppercase">Final Score</div>
                <div className="text-3xl font-mono text-white">{score}</div>
              </div>
              <div className="bg-gray-900/50 p-4 rounded border border-gray-800">
                <div className="text-xs text-gray-500 uppercase">Peak WPM</div>
                <div className="text-3xl font-mono text-green-400">{wpm}</div>
              </div>
            </div>

            <button
              onClick={startGame}
              className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-display font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Reboot System
            </button>
          </motion.div>
        </div>
      )}
      
      {/* Bottom Danger Zone Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-red-900/20 to-transparent pointer-events-none z-0" />
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-pink-600 to-red-600 opacity-50 box-glow-blue" />
    </div>
  );
}
