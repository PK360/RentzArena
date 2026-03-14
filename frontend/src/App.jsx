import React, { useState, useEffect } from 'react';
import { Home, Users, Library, Store, Settings, Sparkles, Droplet, Users2, Swords, Check, Info } from 'lucide-react';
import clsx from 'clsx';
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', { autoConnect: false });

function Card({ cardString, onClick, disabled }) {
  if (!cardString) return null;
  const [val, suit] = cardString.split('-');
  const isRed = suit === 'H' || suit === 'D';
  const symbol = suit === 'H' ? '♥' : suit === 'D' ? '♦' : suit === 'C' ? '♣' : '♠';
  
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "relative w-[4.5rem] h-28 md:w-32 md:h-48 rounded-2xl bg-gradient-to-br from-white to-gray-50 shadow-[0_8px_16px_rgba(0,0,0,0.1),inset_0_2px_4px_rgba(255,255,255,1)] border border-gray-200 flex flex-col justify-between p-2 md:p-3 transition-all duration-300 flex-shrink-0 z-10",
        isRed ? "text-red-500" : "text-slate-800",
        !disabled ? "hover:-translate-y-6 hover:rotate-2 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] hover:z-20 cursor-pointer" : "cursor-default"
      )}
    >
      <div className="text-lg md:text-2xl font-display font-bold leading-none tracking-tighter text-left select-none">{val}</div>
      <div className="text-4xl md:text-6xl flex-1 flex items-center justify-center select-none drop-shadow-sm">{symbol}</div>
      <div className="text-lg md:text-2xl font-display font-bold leading-none tracking-tighter text-left rotate-180 select-none">{val}</div>
    </button>
  );
}

function App() {
  const [theme, setTheme] = useState('theme-frutiger-lime');
  const [activeTab, setActiveTab] = useState('play');
  
  // Lobby / Game State
  const [inLobby, setInLobby] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [players, setPlayers] = useState([]);
  const [nameInput, setNameInput] = useState(''); 
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [gameStarted, setGameStarted] = useState(false);
  const [hand, setHand] = useState([]);
  const [cardCounts, setCardCounts] = useState({});
  const [currentTrick, setCurrentTrick] = useState([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [myIndex, setMyIndex] = useState(-1);
  const [animatingWinner, setAnimatingWinner] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  useEffect(() => {
    socket.connect();
    
    socket.on('lobby_update', ({ players }) => {
      setPlayers(players);
    });

    socket.on('game_started', ({ message, hand, playerIndex, turnIndex, cardCounts }) => {
      setGameStarted(true);
      setHand(hand);
      setMyIndex(playerIndex);
      setTurnIndex(turnIndex);
      if (cardCounts) setCardCounts(cardCounts);
    });
    
    socket.on('game_update', ({ currentTrick, turnIndex, trickSuit, cardCounts }) => {
      setCurrentTrick(currentTrick);
      setTurnIndex(turnIndex);
      if (cardCounts) setCardCounts(cardCounts);
    });
    
    socket.on('hand_update', (newHand) => {
      setHand(newHand);
    });
    
    socket.on('trick_won', ({ winnerName }) => {
      setAnimatingWinner(winnerName);
    });
    
    socket.on('trick_end', ({ nextTurnIndex }) => {
      setTurnIndex(nextTurnIndex);
      setCurrentTrick([]); 
      setAnimatingWinner(null);
    });
    
    socket.on('game_error', (msg) => { 
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 3000);
    });

    return () => {
      socket.off('lobby_update');
      socket.off('game_started');
      socket.off('game_update');
      socket.off('hand_update');
      socket.off('trick_won');
      socket.off('trick_end');
      socket.off('game_error');
    };
  }, []);

  const handleAuth = () => {
    if (!nameInput) return;
    const userId = Math.random().toString(36).substring(7);
    socket.emit('authenticate', { userId, name: nameInput });
    setIsAuthenticated(true);
  };

  const handleCreateLobby = () => {
    socket.emit('create_lobby', {}, (res) => {
      if (res.success) {
        setRoomId(res.roomId);
        setInLobby(true);
        setPlayers([{ socketId: socket.id, name: nameInput, isReady: true }]);
      }
    });
  };

  const handleJoinLobby = () => {
    if (!joinInput) return;
    socket.emit('join_lobby', { roomId: joinInput.toUpperCase() }, (res) => {
      if (res.success) {
        setRoomId(res.roomId);
        setInLobby(true);
        setPlayers(res.lobby.players);
      } else {
        alert(res.error);
      }
    });
  };

  const toggleReady = () => socket.emit('toggle_ready', { roomId });
  const startGame = () => socket.emit('start_game', { roomId }, (res) => { if (res.error) alert(res.error); });
  const playCard = (card) => socket.emit('play_card', { roomId, card });

  const navItems = [
    { id: 'play', label: 'Play', icon: Home },
    { id: 'friends', label: 'Friends', icon: Users },
    { id: 'library', label: 'Library', icon: Library },
    { id: 'market', label: 'Marketplace', icon: Store },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const themes = [
    { id: 'theme-frutiger-lime', label: 'Lime' },
    { id: 'theme-dark-glass', label: 'Dark' },
    { id: 'theme-light-gloss', label: 'Gloss' },
    { id: 'theme-colorful-aero', label: 'Aero' }
  ];

  const amIHost = inLobby && players.length > 0 && players[0].socketId === socket.id;
  const amIReady = inLobby && players.find(p => p.socketId === socket.id)?.isReady;
  const isMyTurn = myIndex === turnIndex;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-0 md:p-8 lg:p-12 relative overflow-hidden font-sans pt-12 md:pt-8 transition-colors duration-700">
      <div className="macos-window w-full max-w-7xl h-[100dvh] md:h-[88vh] flex flex-col relative z-20 shadow-2xl transition-all duration-700 ease-in-out border border-[var(--glass-border)]">
        
        {/* Title Bar */}
        <div className="h-14 border-b border-[var(--glass-border)] flex items-center px-5 shrink-0 relative z-30 shadow-sm transition-colors duration-500" style={{ background: 'var(--glass-bg)' }}>
          <div className="flex gap-2.5 w-24">
            <div className="w-3.5 h-3.5 rounded-full bg-[#ff5f56] shadow-[inset_0_1px_4px_rgba(0,0,0,0.2)] border border-[#e0443e]"></div>
            <div className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e] shadow-[inset_0_1px_4px_rgba(0,0,0,0.2)] border border-[#dea123]"></div>
            <div className="w-3.5 h-3.5 rounded-full bg-[#27c93f] shadow-[inset_0_1px_4px_rgba(0,0,0,0.2)] border border-[#1aab29]"></div>
          </div>
          <div className="flex-1 flex justify-center items-center gap-2">
            <Droplet fill="currentColor" className="w-4 h-4 text-[var(--text-primary)] opacity-40 drop-shadow-md" />
            <span className="font-display font-semibold tracking-widest text-[10px] sm:text-xs text-[var(--text-primary)] opacity-60 uppercase">
              Rentz Arena
            </span>
          </div>
          <div className="w-24"></div>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
          
          {/* Sidebar */}
          <aside className="hidden md:flex flex-col w-72 border-r border-[var(--glass-border)] shrink-0 p-5 relative z-20 transition-colors duration-500" style={{ background: 'var(--glass-bg)' }}>
            <div className="flex items-center gap-3 mb-10 mt-2 px-3">
              <Sparkles fill="currentColor" className="w-8 h-8 text-[var(--text-primary)] drop-shadow-lg opacity-80" />
              <h1 className="text-3xl font-display font-black tracking-tighter text-[var(--text-primary)] drop-shadow-sm">Rentz</h1>
            </div>
            
            <nav className="flex flex-col gap-1.5 flex-1 relative z-20">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={clsx(
                      "flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 font-medium text-left",
                      isActive ? "font-bold text-[var(--nav-active-text)] translate-x-2" : "hover:bg-black/5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    )}
                    style={isActive ? { background: 'var(--nav-active-bg)', boxShadow: 'var(--nav-active-shadow)' } : {}}
                  >
                    <item.icon className={clsx("w-5 h-5 relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-transform duration-300", isActive && "scale-110")} />
                    <span className="relative z-10 tracking-wide text-[15px]">{item.label}</span>
                  </button>
                )
              })}
            </nav>

            <div className="mt-auto pt-6 border-t border-[var(--glass-border)]">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-4 block px-2 opacity-70">Aesthetic</span>
              <div className="grid grid-cols-2 gap-2.5">
                {themes.map(t => (
                  <button key={t.id} onClick={() => setTheme(t.id)} className={clsx("px-2 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300", theme === t.id ? "frutiger-button shadow-lg scale-[1.02]" : "bg-white/30 backdrop-blur-md hover:bg-white/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-[var(--glass-border)]")}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Main View */}
          <main className="flex-1 h-full overflow-y-auto overflow-x-hidden p-6 md:p-12 pb-32 md:pb-12 scroll-smooth relative z-10 flex flex-col">
            <header className="mb-6 flex flex-col gap-3 shrink-0">
              <h2 className="text-4xl md:text-5xl font-display font-black capitalize tracking-tight text-[var(--text-primary)] drop-shadow-sm flex items-center gap-4">
                {activeTab === 'play' && !inLobby && <Swords className="w-10 h-10 opacity-70" />}
                {activeTab}
              </h2>
              <div className="h-1.5 w-24 rounded-full" style={{ background: 'var(--button-bg)', boxShadow: 'var(--nav-active-shadow)' }}></div>
            </header>

            {/* TAB CONTENT: PLAY */}
            {activeTab === 'play' && (
              <div className="glass-panel flex-1 min-h-[60vh] p-4 md:p-8 flex flex-col relative overflow-hidden transition-all duration-700 w-full">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-50 pointer-events-none"></div>

                {errorMsg && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-6 py-2 rounded-full shadow-lg font-bold flex items-center gap-2 z-50 animate-bounce">
                    <Info className="w-5 h-5"/> {errorMsg}
                  </div>
                )}
                
                {/* 1. Auth */}
                {!isAuthenticated ? (
                  <div className="relative z-10 m-auto max-w-sm w-full flex flex-col gap-4 text-center">
                    <h3 className="text-3xl font-display font-bold text-[var(--text-primary)] mb-2">Welcome Player</h3>
                    <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Enter a display name..." className="w-full px-5 py-4 rounded-2xl bg-white/40 border border-[var(--glass-border)] text-[var(--text-primary)] font-bold tracking-wide shadow-inner focus:outline-none focus:ring-4 focus:ring-[var(--accent-glow)]"/>
                    <button onClick={handleAuth} className="frutiger-button py-4 text-lg w-full">Enter Arena</button>
                  </div>
                ) : !inLobby ? (
                /* 2. Matchmaking */
                  <div className="relative z-10 m-auto w-full max-w-lg flex flex-col gap-6">
                    <div className="p-8 rounded-3xl bg-white/20 border border-[var(--glass-border)] shadow-glass text-left">
                      <h3 className="text-2xl font-display font-bold text-[var(--text-primary)] mb-4">Host Game</h3>
                      <button onClick={handleCreateLobby} className="frutiger-button py-4 text-lg w-full">Create Private Lobby</button>
                    </div>
                    <div className="p-8 rounded-3xl bg-white/20 border border-[var(--glass-border)] shadow-glass text-left">
                      <h3 className="text-2xl font-display font-bold text-[var(--text-primary)] mb-4">Join Friends</h3>
                      <div className="flex gap-3">
                        <input value={joinInput} onChange={e => setJoinInput(e.target.value)} placeholder="Code (eg. ABCDEF)" className="flex-1 px-5 py-4 rounded-2xl bg-white/40 border border-[var(--glass-border)] text-[var(--text-primary)] font-bold tracking-widest uppercase shadow-inner focus:outline-none focus:ring-4 focus:ring-[var(--accent-glow)]"/>
                        <button onClick={handleJoinLobby} className="frutiger-button px-6 text-lg font-bold">Join</button>
                      </div>
                    </div>
                  </div>
                ) : gameStarted ? (
                /* 3. GAME TABLE UI */
                  <div className="relative z-10 flex-1 flex flex-col w-full h-full justify-between">
                    
                    {/* Top Stats / Opponents */}
                    <div className="flex justify-between items-center bg-white/30 backdrop-blur-md rounded-2xl p-4 border border-[var(--glass-border)] shadow-sm shrink-0">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="text-[var(--text-primary)] font-bold uppercase tracking-wider text-sm flex gap-2 items-center bg-black/5 px-3 py-1.5 rounded-xl">
                          <Users2 className="w-5 h-5"/> {players.length}
                        </div>
                        {/* Show Opponent Card Counts */}
                        {players.map((p, i) => i !== myIndex && (
                          <div key={i} className={clsx("flex items-center gap-2 px-3 py-1 rounded-full border shadow-sm text-xs font-bold transition-all", i === turnIndex ? "bg-[var(--accent-glow)] text-white border-white scale-105 shadow-md" : "bg-white/40 border-[var(--glass-border)] text-[var(--text-secondary)]")}>
                            {p.name.substring(0,6)} <span className="bg-white/50 text-[var(--text-primary)] px-2 rounded-full border border-black/5 shadow-inner">{cardCounts[p.userId] || 0}</span>
                          </div>
                        ))}
                      </div>
                      <div className={clsx("px-4 py-1.5 rounded-full font-bold border whitespace-nowrap hidden md:block", isMyTurn ? "bg-[var(--accent-glow)] border-white shadow-md text-white animate-pulse" : "bg-black/5 text-[var(--text-secondary)] border-black/10")}>
                        {isMyTurn ? "Your Turn!" : `${players[turnIndex]?.name}'s Turn`}
                      </div>
                    </div>

                    {/* The Green Felt / Card Table Area */}
                    <div className="flex-1 flex items-center justify-center my-4 relative">
                      <div className="absolute inset-4 rounded-[3rem] border border-[var(--glass-border)] shadow-inner opacity-40 mix-blend-overlay pointer-events-none" style={{ background: 'var(--accent-glow)' }}></div>
                      
                      {/* Played Cards (Current Trick) */}
                      <div className="flex justify-center items-center gap-[-2rem] md:gap-4 relative z-20">
                        {currentTrick.map((play, i) => (
                          <div key={i} className={clsx("flex flex-col items-center gap-2 transform transition-all duration-700", animatingWinner ? "translate-y-[-200px] scale-0 opacity-0" : "hover:scale-105 hover:z-30")} style={!animatingWinner ? { transform: `rotate(${(i - currentTrick.length/2)*10}deg) translateY(${Math.abs(i-currentTrick.length/2)*10}px)` } : {}}>
                            <span className="bg-black/40 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md border border-white/20 whitespace-nowrap">{play.playerName}</span>
                            <Card cardString={play.card} disabled={true} />
                          </div>
                        ))}
                        {currentTrick.length === 0 && !animatingWinner && (
                          <div className="text-[var(--text-primary)] opacity-40 font-display text-2xl font-bold tracking-widest uppercase">Played Cards Appear Here</div>
                        )}
                      </div>
                    </div>

                    {/* My Hand (Always Visible Flex Wrap) */}
                    <div className="shrink-0 w-full mb-8 md:mb-2 flex flex-col items-center">
                      <div className={clsx("flex items-center gap-2 mb-3 px-2 font-bold text-sm md:text-base tracking-widest uppercase rounded-full py-1 px-4 border shadow-sm transition-all", isMyTurn ? "bg-[var(--accent-glow)] text-white border-white animate-pulse shadow-md" : "text-[var(--text-primary)] bg-white/40 backdrop-blur-md border-[var(--glass-border)] ")}>
                        Your Hand <span className="bg-black/20 text-white px-2 py-0.5 rounded-full text-xs shadow-inner border border-white/20">{hand.length}</span>
                      </div>
                      
                      {/* Flex wrap container guarantees all cards are visible without scrolling on most screens */}
                      <div className="flex flex-wrap justify-center gap-[-1rem] md:gap-2 max-w-full px-2">
                        {hand.sort().map((card, i) => (
                           <div key={i} className="transition-transform duration-300 hover:z-30 hover:-translate-y-4 -ml-4 md:ml-0 first:ml-0">
                             <Card cardString={card} onClick={() => playCard(card)} disabled={!isMyTurn} />
                           </div>
                        ))}
                        {hand.length === 0 && (
                          <div className="w-full flex justify-center items-center font-display text-xl opacity-50 font-bold p-8">Waiting for next round...</div>
                        )}
                      </div>
                    </div>

                  </div>
                ) : (
                /* 4. Lobby Waiting Room */
                  <div className="relative z-10 w-full max-w-3xl m-auto flex flex-col">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-3xl font-display font-extrabold text-[var(--text-primary)]">Lobby <span className="text-[var(--text-secondary)] tracking-widest ml-2 bg-white/30 px-4 py-1.5 rounded-xl border border-[var(--glass-border)]">{roomId}</span></h3>
                    </div>
                    <div className="grid gap-3 mb-8">
                      {players.map((p, i) => (
                        <div key={i} className="flex justify-between items-center p-5 rounded-2xl bg-white/30 border border-[var(--glass-border)] shadow-sm">
                          <span className="font-bold text-xl drop-shadow-sm flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-display text-white shadow-inner border border-white/50 text-sm" style={{ background: 'var(--button-bg)' }}>{p.name.charAt(0).toUpperCase()}</div>
                            {p.name} {p.socketId === socket.id ? '(You)' : ''}
                          </span>
                          {p.isReady ? (
                            <span className="px-4 py-1.5 rounded-full bg-green-500/20 text-green-700 font-bold border border-green-500/30 flex items-center gap-1"><Check className="w-4 h-4"/> Ready</span>
                          ) : (
                            <span className="px-4 py-1.5 rounded-full bg-black/5 text-[var(--text-secondary)] font-bold border border-black/5">Not Ready</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-4">
                      <button onClick={toggleReady} className={clsx("flex-1 px-8 py-4 rounded-2xl font-bold uppercase tracking-widest transition-all text-lg shadow-glass border", amIReady ? "bg-green-500 text-white border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.5)] scale-105" : "bg-blue-600/90 text-white border-blue-500 shadow-[0_4px_16px_rgba(37,99,235,0.4)] hover:bg-blue-500")}>
                        {amIReady ? 'READY!' : 'Ready Up'}
                      </button>
                      {amIHost && (
                        <button onClick={startGame} className="flex-1 frutiger-button px-8 py-4 text-lg">Start Match</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {activeTab !== 'play' && (
              <div className="glass-panel min-h-[60vh] p-8 flex flex-col items-center justify-center text-center">
                 <h3 className="text-3xl font-display font-extrabold text-[var(--text-primary)]">Module Coming Soon</h3>
              </div>
            )}
          </main>
        </div>
      </div>

      <nav className="md:hidden fixed bottom-6 left-4 right-4 glass-panel rounded-[1.8rem] z-50 flex justify-around p-2 shadow-[0_20px_40px_rgba(0,0,0,0.2)] border border-[var(--glass-border)]">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={clsx("flex flex-col items-center justify-center w-[3.75rem] h-[3.75rem] rounded-[1.4rem] transition-all duration-500 relative", isActive ? "scale-110 -translate-y-4" : "text-[var(--text-secondary)]")}>
              {isActive && <div className="absolute inset-0 rounded-[1.4rem] shadow-[var(--nav-active-shadow)]" style={{ background: 'var(--nav-active-bg)' }}></div>}
              <item.icon className={clsx("w-6 h-6 relative z-10 drop-shadow-md", isActive ? "text-[max(var(--nav-active-text),_white)]" : "currentColor")} />
            </button>
          )
        })}
      </nav>
    </div>
  );
}

export default App;
