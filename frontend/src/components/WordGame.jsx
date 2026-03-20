import { useState } from "react";
import "./WordGame.css";

const WORD_LIST = [
  "python", "react", "gemini", "network", "laptop", "cookie",
  "dragon", "castle", "planet", "rocket", "jungle", "flower",
  "bridge", "music", "cloud", "pencil", "guitar", "window",
  "bottle", "mirror", "garden", "tennis", "silver", "coffee",
  "camera", "safari", "desert", "forest", "pirate", "wizard",
];

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

function newGame() {
  const word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
  console.log("[WordGame] answer:", word);
  return { word, guessed: [], wrong: [], maxAttempts: 6 };
}

function getDisplay(word, guessed) {
  return word.split("").map((c) => (guessed.includes(c) ? c : "_"));
}

function getStatus(word, guessed, wrong, maxAttempts) {
  if (!guessed.includes("_") && word.split("").every((c) => guessed.includes(c))) return "won";
  if (wrong.length >= maxAttempts) return "lost";
  return "playing";
}

export default function WordGame() {
  const [game, setGame] = useState(null);

  function start() { setGame(newGame()); }

  function guess(letter) {
    if (!game || game.status === "won" || game.status === "lost") return;
    if (game.guessed.includes(letter)) return;

    setGame((g) => {
      const guessed = [...g.guessed, letter];
      const wrong   = g.wrong.includes(letter) || g.word.includes(letter)
        ? g.wrong
        : [...g.wrong, letter];
      const wrongNew = !g.word.includes(letter) && !g.wrong.includes(letter)
        ? [...g.wrong, letter]
        : g.wrong;
      return { ...g, guessed, wrong: wrongNew };
    });
  }

  const display      = game ? getDisplay(game.word, game.guessed) : [];
  const status       = game ? getStatus(game.word, game.guessed, game.wrong, game.maxAttempts) : null;
  const attemptsLeft = game ? game.maxAttempts - game.wrong.length : 6;

  return (
    <div className="word-game">
      <div className="game-header">
        <h2>Word Guessing Game</h2>
        <p className="game-desc">Guess the hidden word — one letter at a time. You have 6 attempts.</p>
      </div>

      {!game ? (
        <div className="game-start">
          <button className="btn btn-primary btn-lg" onClick={start}>Start New Game</button>
        </div>
      ) : (
        <div className="game-body">
          <Hangman wrong={game.wrong.length} />

          <div className="word-display">
            {display.map((c, i) => (
              <span key={i} className="letter-box">{c !== "_" ? c : ""}</span>
            ))}
          </div>

          <div className="stats">
            <span>Attempts left: <strong>{attemptsLeft}</strong></span>
            {game.wrong.length > 0 && (
              <span>Wrong: <strong>{game.wrong.join(", ")}</strong></span>
            )}
          </div>

          {status === "playing" && (
            <div className="keyboard">
              {ALPHABET.map((l) => {
                const isWrong   = game.wrong.includes(l);
                const isCorrect = game.guessed.includes(l) && game.word.includes(l);
                return (
                  <button
                    key={l}
                    className={`key ${isWrong ? "wrong" : ""} ${isCorrect ? "correct" : ""}`}
                    onClick={() => guess(l)}
                    disabled={isWrong || isCorrect}
                  >{l}</button>
                );
              })}
            </div>
          )}

          {status === "won" && (
            <div className="result win">🎉 You won! The word was <strong>{game.word}</strong></div>
          )}
          {status === "lost" && (
            <div className="result lose">💀 Game over! The word was <strong>{game.word}</strong></div>
          )}

          {status !== "playing" && (
            <button className="btn btn-primary" onClick={start}>Play Again</button>
          )}
        </div>
      )}
    </div>
  );
}

function Hangman({ wrong }) {
  return (
    <div className="hangman">
      <svg viewBox="0 0 120 140" width="120" height="140">
        <line x1="10" y1="130" x2="110" y2="130" stroke="rgba(0,0,0,0.3)" strokeWidth="3" strokeLinecap="round" />
        <line x1="30" y1="130" x2="30"  y2="10"  stroke="rgba(0,0,0,0.3)" strokeWidth="3" strokeLinecap="round" />
        <line x1="30" y1="10"  x2="70"  y2="10"  stroke="rgba(0,0,0,0.3)" strokeWidth="3" strokeLinecap="round" />
        <line x1="70" y1="10"  x2="70"  y2="25"  stroke="rgba(0,0,0,0.3)" strokeWidth="3" strokeLinecap="round" />
        {wrong >= 1 && <circle cx="70" cy="34" r="9" stroke="#FF3B30" strokeWidth="2.5" fill="none" />}
        {wrong >= 2 && <line x1="70" y1="43" x2="70" y2="80" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round" />}
        {wrong >= 3 && <line x1="70" y1="55" x2="50" y2="68" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round" />}
        {wrong >= 4 && <line x1="70" y1="55" x2="90" y2="68" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round" />}
        {wrong >= 5 && <line x1="70" y1="80" x2="50" y2="100" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round" />}
        {wrong >= 6 && <line x1="70" y1="80" x2="90" y2="100" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round" />}
      </svg>
    </div>
  );
}
